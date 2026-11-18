import { randomBytes, createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { pool } from './db.js';
import { currentSession, digestPassword, fail } from './identity.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const validId = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s);
async function membership(request: FastifyRequest, orgId: string, roles: string[]) {
  const session = await currentSession(request);
  if (!session?.active_membership_id) return null;
  const { rows } = await pool.query('SELECT id,org_id,user_id,role,athlete_id FROM memberships WHERE id=$1 AND user_id=$2 AND org_id=$3', [session.active_membership_id, session.user_id, orgId]);
  return rows[0] && roles.includes(rows[0].role) ? { session, member: rows[0] } : null;
}
export async function athleteContext(request: FastifyRequest, athleteId: string, ticketId?: string) {
  const session = await currentSession(request);
  if (!session) return { error: 'unauthenticated' as const };
  const { rows: athletes } = await pool.query('SELECT id,org_id,display_name,birth_date,status FROM athletes WHERE id=$1', [athleteId]);
  const athlete = athletes[0];
  if (!athlete) return { error: 'not_found' as const };
  const { rows: staff } = await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1', [session.user_id]);
  if (staff.length) {
    if (!ticketId) return { error: 'not_found' as const };
    const ticket = await pool.query("SELECT 1 FROM tickets WHERE id=$1 AND status='open'", [ticketId]);
    if (!ticket.rowCount) return { error: 'not_found' as const };
    await pool.query("INSERT INTO audit_events(actor_user_id,org_id,athlete_id,ticket_id,action,object_type,object_id,ip) VALUES($1,$2,$3,$4,'support.athlete.read','athlete',$3,$5)", [session.user_id, athlete.org_id, athlete.id, ticketId, request.ip]);
    return { session, athlete, role: 'platform_staff' };
  }
  const { rows: m } = await pool.query('SELECT role,athlete_id FROM memberships WHERE id=$1 AND user_id=$2 AND org_id=$3', [session.active_membership_id, session.user_id, athlete.org_id]);
  if (!m[0]) return { error: 'not_found' as const };
  const role = m[0].role as string;
  if (role === 'coach') {
    const assigned = await pool.query('SELECT 1 FROM coach_assignments WHERE org_id=$1 AND coach_user_id=$2 AND athlete_id=$3', [athlete.org_id, session.user_id, athlete.id]);
    if (!assigned.rowCount) return { error: 'not_found' as const };
  } else if (role === 'guardian') {
    const linked = await pool.query('SELECT 1 FROM guardian_links WHERE org_id=$1 AND guardian_user_id=$2 AND athlete_id=$3', [athlete.org_id, session.user_id, athlete.id]);
    if (!linked.rowCount) return { error: 'not_found' as const };
  } else if (role === 'athlete' && m[0].athlete_id !== athlete.id) return { error: 'not_found' as const };
  else if (!['org_admin','athlete'].includes(role)) return { error: 'not_found' as const };
  return { session, athlete, role };
}
export async function activeGate(athlete: { id: string; org_id: string; birth_date: string; status: string }) {
  if (athlete.status !== 'active') return false;
  const age = await pool.query("SELECT date_part('year', age((now() AT TIME ZONE 'Asia/Seoul')::date, $1::date))::int AS years", [athlete.birth_date]);
  if (age.rows[0].years >= 14) return true;
  const grant = await pool.query("SELECT ce.granted FROM consent_events ce JOIN policy_versions pv ON pv.id=ce.policy_version_id WHERE ce.athlete_id=$1 AND ce.purpose='child_account' AND pv.kind='privacy' AND pv.effective_at<=now() ORDER BY ce.created_at DESC LIMIT 1", [athlete.id]);
  return grant.rows[0]?.granted === true;
}
function bodyText(v: unknown, max = 2000) { return typeof v === 'string' && v.trim().length > 0 && v.length <= max; }
function dateOnly(v: unknown) { if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false; const date = new Date(`${v}T00:00:00.000Z`); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v; }

export async function registerProductRoutes(app: FastifyInstance) {
  app.get('/api/status', async () => {
    const { rows } = await pool.query('SELECT maintenance,message FROM platform_settings WHERE id=true');
    return rows[0] ?? { maintenance: false, message: '' };
  });
  app.get('/api/legal/policies/current', async () => {
    const { rows } = await pool.query('SELECT id,kind,version,body_sha256,effective_at,counsel_reviewed FROM policy_versions WHERE effective_at<=now() ORDER BY effective_at DESC');
    return { policies: rows };
  });
  app.post<{Body:{kind?:string;version?:string;body?:string;effectiveAt?:string}}>('/api/ops/policies',async(request,reply)=>{
    const session=await currentSession(request);if(!session||!(await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1',[session.user_id])).rowCount)return fail(reply,404,'not_found','요청을 찾을 수 없습니다.');
    const {kind,version,body,effectiveAt}=request.body??{};
    if(!['privacy','terms','billing'].includes(kind??'')||!bodyText(version,40)||!bodyText(body,100000))return fail(reply,400,'invalid_input','정책 종류, 버전, 본문을 확인해 주세요.');
    const bodyHash=createHash('sha256').update(String(body)).digest('hex');
    const {rows}=await pool.query('INSERT INTO policy_versions(kind,version,body_sha256,effective_at,counsel_reviewed) VALUES($1,$2,$3,coalesce($4::timestamptz,now()),false) RETURNING id,kind,version,body_sha256,effective_at,counsel_reviewed',[kind,version,bodyHash,effectiveAt??null]);
    await pool.query("INSERT INTO audit_events(actor_user_id,action,object_type,object_id,ip) VALUES($1,'policy.create','policy_version',$2::uuid::text,$3)",[session.user_id,rows[0].id,request.ip]);return reply.code(201).send(rows[0]);
  });
  app.post<{Params:{id:string};Body:{reviewNote?:string}}>('/api/ops/policies/:id/counsel-review',async(request,reply)=>{
    const session=await currentSession(request);if(!session||!(await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1',[session.user_id])).rowCount)return fail(reply,404,'not_found','요청을 찾을 수 없습니다.');
    if(!bodyText(request.body?.reviewNote,1000))return fail(reply,400,'invalid_input','검토 내역을 기록해 주세요.');
    const {rows}=await pool.query('UPDATE policy_versions SET counsel_reviewed=true WHERE id=$1 RETURNING id,kind,version,counsel_reviewed',[request.params.id]);if(!rows[0])return fail(reply,404,'not_found','정책 버전을 찾을 수 없습니다.');
    await pool.query("INSERT INTO audit_events(actor_user_id,action,object_type,object_id,ip) VALUES($1,'policy.counsel_reviewed','policy_version',$2::uuid::text,$3)",[session.user_id,rows[0].id,request.ip]);
    return rows[0];
  });
  app.post<{ Body: Record<string, unknown> }>('/api/ops/orgs', async (request, reply) => {
    const session = await currentSession(request);
    if (!session) return fail(reply, 401, 'unauthenticated', '로그인이 필요합니다.');
    if (!(await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1', [session.user_id])).rowCount) return fail(reply, 404, 'not_found', '요청을 찾을 수 없습니다.');
    if (!bodyText(request.body?.name, 160)) return fail(reply, 400, 'invalid_input', '기관명을 확인해 주세요.');
    const { rows } = await pool.query('INSERT INTO orgs(name,legal_name,business_number,representative_name,business_address,tax_invoice_email) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name', [request.body.name, request.body.legalName ?? null, request.body.businessNumber ?? null, request.body.representativeName ?? null, request.body.businessAddress ?? null, request.body.taxInvoiceEmail ?? null]);
    await pool.query("INSERT INTO audit_events(actor_user_id,org_id,action,object_type,object_id,ip) VALUES($1,$2,'org.create','org',$2,$3)", [session.user_id, rows[0].id, request.ip]);
    return reply.code(201).send(rows[0]);
  });
  app.get<{ Params: { orgId: string } }>('/api/orgs/:orgId/teams', async (request, reply) => {
    const ctx = await membership(request, request.params.orgId, ['org_admin','coach']);
    if (!ctx) return fail(reply, 404, 'not_found', '기관을 찾을 수 없습니다.');
    const { rows } = await pool.query('SELECT id,name,sport FROM teams WHERE org_id=$1 ORDER BY name', [request.params.orgId]);
    return { teams: rows };
  });
  app.post<{ Params: { orgId: string }; Body: { name?: string; sport?: string } }>('/api/orgs/:orgId/teams', async (request, reply) => {
    const ctx = await membership(request, request.params.orgId, ['org_admin']);
    if (!ctx) return fail(reply, 404, 'not_found', '기관을 찾을 수 없습니다.');
    if (!bodyText(request.body?.name, 100) || (request.body.sport && request.body.sport !== 'baseball')) return fail(reply, 400, 'invalid_input', '야구 팀 정보를 확인해 주세요.');
    const { rows } = await pool.query('INSERT INTO teams(org_id,name,sport) VALUES($1,$2,\'baseball\') RETURNING id,name,sport', [request.params.orgId, request.body.name]);
    return reply.code(201).send(rows[0]);
  });
  app.get<{ Params: { orgId: string } }>('/api/orgs/:orgId/athletes', async (request, reply) => {
    const ctx = await membership(request, request.params.orgId, ['org_admin','coach','guardian','athlete']);
    if (!ctx) return fail(reply, 404, 'not_found', '기관을 찾을 수 없습니다.');
    const { member, session } = ctx;
    const where = member.role === 'coach' ? 'AND EXISTS(SELECT 1 FROM coach_assignments ca WHERE ca.athlete_id=a.id AND ca.coach_user_id=$2)' : member.role === 'guardian' ? 'AND EXISTS(SELECT 1 FROM guardian_links gl WHERE gl.athlete_id=a.id AND gl.guardian_user_id=$2)' : member.role === 'athlete' ? 'AND a.id=$3' : '';
    const params = member.role === 'athlete' ? [request.params.orgId, session.user_id, member.athlete_id] : [request.params.orgId, session.user_id];
    const { rows } = await pool.query(`SELECT a.id,a.display_name,a.birth_date,a.status,a.team_id,t.name team_name,EXISTS(SELECT 1 FROM memberships am WHERE am.athlete_id=a.id AND am.role='athlete') has_athlete_user FROM athletes a JOIN teams t ON t.id=a.team_id WHERE a.org_id=$1 ${where} ORDER BY a.display_name`, params);
    return { athletes: rows.map((a) => a.status === 'draft' ? { id: a.id, displayName: a.display_name, birthDate: a.birth_date, status: a.status, teamId: a.team_id, hasAthleteUser: a.has_athlete_user } : { id: a.id, displayName: a.display_name, birthDate: a.birth_date, status: a.status, teamId: a.team_id, teamName: a.team_name, hasAthleteUser: a.has_athlete_user }) };
  });
  app.post<{ Params: { orgId: string }; Body: { displayName?: string; birthDate?: string; teamId?: string } }>('/api/orgs/:orgId/athletes', async (request, reply) => {
    const ctx = await membership(request, request.params.orgId, ['org_admin','coach']);
    if (!ctx) return fail(reply, 404, 'not_found', '기관을 찾을 수 없습니다.');
    const { displayName, birthDate, teamId } = request.body ?? {};
    if (!bodyText(displayName, 100) || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate ?? '') || !validId(teamId)) return fail(reply, 400, 'invalid_input', '선수 이름, 생년월일, 팀을 확인해 주세요.');
    const team = await pool.query('SELECT 1 FROM teams WHERE id=$1 AND org_id=$2', [teamId, request.params.orgId]);
    if (!team.rowCount) return fail(reply, 404, 'not_found', '팀을 찾을 수 없습니다.');
    const count = await pool.query("SELECT count(*)::int n FROM athletes WHERE org_id=$1 AND status<>'erased'", [request.params.orgId]);
    const org = await pool.query('SELECT seat_athletes FROM orgs WHERE id=$1', [request.params.orgId]);
    if (count.rows[0].n >= org.rows[0].seat_athletes) return fail(reply, 409, 'seat_limit', '선수 좌석 한도에 도달했습니다.');
    const { rows } = await pool.query('INSERT INTO athletes(org_id,team_id,display_name,birth_date) VALUES($1,$2,$3,$4) RETURNING id,display_name,birth_date,status,team_id', [request.params.orgId, teamId, String(displayName).trim(), String(birthDate)]);
    if (ctx.member.role === 'coach') await pool.query('INSERT INTO coach_assignments(org_id,coach_user_id,athlete_id) VALUES($1,$2,$3)', [request.params.orgId, ctx.session.user_id, rows[0].id]);
    return reply.code(201).send({ id: rows[0].id, displayName: rows[0].display_name, birthDate: rows[0].birth_date, status: rows[0].status, teamId: rows[0].team_id });
  });
  app.post<{ Params: { orgId: string }; Body: { email?: string; role?: string; athleteId?: string } }>('/api/orgs/:orgId/invites', async (request, reply) => {
    const ctx = await membership(request, request.params.orgId, ['org_admin']);
    const requester = await currentSession(request);
    const platformStaff = requester !== null && Boolean((await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1', [requester.user_id])).rowCount);
    if (!ctx && !platformStaff) return fail(reply, 404, 'not_found', '기관을 찾을 수 없습니다.');
    const { email, role, athleteId } = request.body ?? {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['org_admin','coach','guardian','athlete'].includes(role ?? '') || (['guardian','athlete'].includes(role ?? '') && !validId(athleteId))) return fail(reply, 400, 'invalid_input', '초대 정보를 확인해 주세요.');
    const sub = await pool.query("SELECT status FROM subscriptions WHERE org_id=$1 AND status<>'canceled' ORDER BY created_at DESC LIMIT 1", [request.params.orgId]);
    if (sub.rowCount && ['past_due','incomplete'].includes(sub.rows[0].status)) return fail(reply, 409, 'subscription_required', '재계약 후 멤버를 초대할 수 있습니다.');
    if (['guardian','athlete'].includes(role ?? '') && !(await pool.query('SELECT 1 FROM athletes WHERE id=$1 AND org_id=$2', [athleteId, request.params.orgId])).rowCount) return fail(reply, 404, 'not_found', '선수를 찾을 수 없습니다.');
    const limits = await pool.query('SELECT seat_coaches,seat_org_admins FROM orgs WHERE id=$1', [request.params.orgId]);
    const count = await pool.query('SELECT count(*)::int n FROM memberships WHERE org_id=$1 AND role=$2', [request.params.orgId, role]);
    if (role === 'coach' && count.rows[0].n >= limits.rows[0].seat_coaches || role === 'org_admin' && count.rows[0].n >= limits.rows[0].seat_org_admins) return fail(reply, 409, 'seat_limit', '해당 역할의 좌석 한도에 도달했습니다.');
    if (role === 'guardian') {
      const guardianCount = await pool.query('SELECT count(*)::int n FROM guardian_links WHERE athlete_id=$1', [athleteId]);
      const guardianLimit = await pool.query('SELECT seat_guardians_per_athlete FROM orgs WHERE id=$1', [request.params.orgId]);
      if (guardianCount.rows[0].n >= guardianLimit.rows[0].seat_guardians_per_athlete) return fail(reply, 409, 'seat_limit', '선수의 보호자 좌석 한도에 도달했습니다.');
    }
    const raw = randomBytes(32).toString('base64url');
    const { rows } = await pool.query('INSERT INTO invites(org_id,role,email,athlete_id,token_hash,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval \'7 days\') RETURNING id,expires_at', [request.params.orgId, role, email.toLowerCase(), athleteId ?? null, sha(raw)]);
    await pool.query("INSERT INTO email_outbox(idempotency_key,to_email,template,payload,status) VALUES($1,$2,'organization_invite',jsonb_build_object('token',$3),'queued')", [`invite:${rows[0].id}`, email.toLowerCase(), raw]);
    return reply.code(201).send({ id: rows[0].id, expiresAt: rows[0].expires_at });
  });
  app.post<{ Body: { token?: string; password?: string; name?: string } }>('/api/invites/accept', async (request, reply) => {
    const { token, password, name } = request.body ?? {};
    if (typeof token !== 'string' || !bodyText(name, 100) || (password !== undefined && (password.length < 10 || password.length > 128))) return fail(reply, 400, 'invalid_input', '초대 수락 정보를 확인해 주세요.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query("SELECT * FROM invites WHERE token_hash=$1 AND accepted_at IS NULL AND expires_at>now() FOR UPDATE", [sha(token)]);
      if (!found.rowCount) { await client.query('ROLLBACK'); return fail(reply, 400, 'invite_invalid', '초대 링크가 만료되었거나 이미 사용되었습니다.'); }
      const inv = found.rows[0];
      if (inv.role === 'athlete') {
        const age = await client.query("SELECT date_part('year',age((now() AT TIME ZONE 'Asia/Seoul')::date,a.birth_date))::int years FROM athletes a WHERE id=$1", [inv.athlete_id]);
        if (!age.rowCount || age.rows[0].years < 14) { await client.query('ROLLBACK'); return fail(reply, 400, 'athlete_account_not_allowed', '만 14세 미만 선수 계정은 만들 수 없습니다.'); }
      }
      let user = await client.query('SELECT id FROM users WHERE email=$1', [inv.email]);
      if (!user.rowCount) {
        if (!password) { await client.query('ROLLBACK'); return fail(reply, 400, 'password_required', '새 계정 비밀번호를 입력해 주세요.'); }
        user = await client.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id', [inv.email, await digestPassword(password), String(name).trim()]);
      }
      const member = inv.role === 'athlete'
        ? await client.query('INSERT INTO memberships(org_id,user_id,role,athlete_id) VALUES($1,$2,$3,$4) ON CONFLICT(org_id,user_id,role) DO UPDATE SET athlete_id=EXCLUDED.athlete_id WHERE memberships.athlete_id IS NULL OR memberships.athlete_id=EXCLUDED.athlete_id RETURNING id', [inv.org_id, user.rows[0].id, inv.role, inv.athlete_id])
        : await client.query('INSERT INTO memberships(org_id,user_id,role,athlete_id) VALUES($1,$2,$3,$4) ON CONFLICT(org_id,user_id,role) DO UPDATE SET athlete_id=memberships.athlete_id RETURNING id', [inv.org_id, user.rows[0].id, inv.role, null]);
      if (!member.rowCount) { await client.query('ROLLBACK'); return fail(reply, 409, 'membership_exists', '이미 다른 선수로 등록된 계정입니다.'); }
      if (inv.role === 'guardian') await client.query('INSERT INTO guardian_links(org_id,guardian_user_id,athlete_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [inv.org_id, user.rows[0].id, inv.athlete_id]);
      if (inv.role === 'coach' && inv.athlete_id) await client.query('INSERT INTO coach_assignments(org_id,coach_user_id,athlete_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [inv.org_id, user.rows[0].id, inv.athlete_id]);
      await client.query('UPDATE invites SET accepted_at=now() WHERE id=$1', [inv.id]);
      await client.query('COMMIT');
      return reply.code(201).send({ userId: user.rows[0].id, membershipId: member.rows[0].id });
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  });
  app.get<{ Params: { orgId: string } }>('/api/orgs/:orgId/members', async (request, reply) => {
    const ctx = await membership(request, request.params.orgId, ['org_admin']);
    if (!ctx) return fail(reply, 404, 'not_found', '기관을 찾을 수 없습니다.');
    const { rows } = await pool.query('SELECT m.id,m.role,m.athlete_id,u.id user_id,u.name,u.email,m.created_at FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=$1 ORDER BY u.name,m.role LIMIT 1000', [request.params.orgId]);
    return { members: rows };
  });
  app.post<{ Params: { orgId: string; id: string }; Body: { coachUserId?: string } }>('/api/orgs/:orgId/athletes/:id/assignments', async (request, reply) => {
    const ctx = await membership(request, request.params.orgId, ['org_admin']);
    if (!ctx) return fail(reply, 404, 'not_found', '기관을 찾을 수 없습니다.');
    if (!validId(request.body?.coachUserId)) return fail(reply, 400, 'invalid_input', '코치 계정을 확인해 주세요.');
    const athlete = await pool.query('SELECT 1 FROM athletes WHERE id=$1 AND org_id=$2', [request.params.id,request.params.orgId]);
    const coach = await pool.query("SELECT 1 FROM memberships WHERE user_id=$1 AND org_id=$2 AND role='coach'", [request.body.coachUserId,request.params.orgId]);
    if (!athlete.rowCount || !coach.rowCount) return fail(reply, 404, 'not_found', '선수 또는 코치를 찾을 수 없습니다.');
    await pool.query('INSERT INTO coach_assignments(org_id,coach_user_id,athlete_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [request.params.orgId,request.body.coachUserId,request.params.id]);
    return reply.code(201).send({ athleteId: request.params.id, coachUserId: request.body.coachUserId });
  });
  app.delete<{ Params: { orgId: string; id: string }; Querystring: { coachUserId?: string } }>('/api/orgs/:orgId/athletes/:id/assignments', async (request, reply) => {
    if (!await membership(request,request.params.orgId,['org_admin'])) return fail(reply,404,'not_found','기관을 찾을 수 없습니다.');
    if (!validId(request.query.coachUserId)) return fail(reply,400,'invalid_input','코치 계정을 확인해 주세요.');
    const removed = await pool.query('DELETE FROM coach_assignments WHERE org_id=$1 AND athlete_id=$2 AND coach_user_id=$3', [request.params.orgId,request.params.id,request.query.coachUserId]);
    if (!removed.rowCount) return fail(reply,404,'not_found','배정 정보를 찾을 수 없습니다.');
    return reply.code(204).send();
  });
  app.post<{ Params: { id: string } }>('/api/athletes/:id/activate', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    const { athlete, session, role } = ctx;
    const age = await pool.query("SELECT date_part('year', age((now() AT TIME ZONE 'Asia/Seoul')::date,$1::date))::int years", [athlete.birth_date]);
    const under14 = age.rows[0].years < 14;
    if (under14 && role !== 'guardian') return fail(reply, 403, 'guardian_required', '보호자 계정에서 동의를 완료해 주세요.');
    if (!under14 && !['athlete','org_admin'].includes(role)) return fail(reply, 403, 'forbidden', '활성화 권한이 없습니다.');
    if (under14 && !(await pool.query("SELECT ce.granted FROM consent_events ce JOIN policy_versions p ON p.id=ce.policy_version_id WHERE ce.athlete_id=$1 AND ce.guardian_user_id=$2 AND ce.purpose='child_account' AND p.kind='privacy' ORDER BY ce.created_at DESC LIMIT 1", [athlete.id, session.user_id])).rows[0]?.granted) return fail(reply, 409, 'athlete_not_active', '보호자 동의가 확인되지 않았습니다.');
    if (process.env.APP_ENV === 'pilot' && !(await pool.query("SELECT 1 FROM policy_versions WHERE kind='privacy' AND counsel_reviewed=true AND effective_at<=now() ORDER BY effective_at DESC LIMIT 1")).rowCount) return fail(reply, 409, 'counsel_pending', '개인정보 처리방침의 검토가 완료되지 않았습니다.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const activated = await client.query("UPDATE athletes SET status='active' WHERE id=$1 AND status='draft'", [athlete.id]);
      if (!activated.rowCount) { await client.query('ROLLBACK'); return fail(reply, 409, 'athlete_not_draft', '초안 상태의 선수만 활성화할 수 있습니다.'); }
      await client.query("INSERT INTO goals(org_id,athlete_id,title,metric,target_numeric) VALUES($1,$2,'주간 훈련 5일','week_training_days',5),($1,$2,'월간 타율 0.320','month_batting_average',0.320),($1,$2,'시즌 안타 30개','season_hits',30) ON CONFLICT(athlete_id,metric) DO NOTHING", [athlete.org_id, athlete.id]);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    return { id: athlete.id, status: 'active' };
  });
  app.post<{ Params: { id: string }; Body: { policyVersionId?: string; purposes?: string[]; granted?: boolean } }>('/api/athletes/:id/consents', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (ctx.role !== 'guardian') return fail(reply, 403, 'forbidden', '보호자만 동의를 제출할 수 있습니다.');
    const { policyVersionId, purposes } = request.body ?? {};
    if (!validId(policyVersionId) || !Array.isArray(purposes) || purposes.some(p => !['child_account','portrait','report_email'].includes(p))) return fail(reply, 400, 'invalid_input', '동의 항목을 확인해 주세요.');
    const policy = await pool.query("SELECT id FROM policy_versions WHERE id=$1 AND kind='privacy' AND effective_at<=now()", [policyVersionId]);
    if (!policy.rowCount) return fail(reply, 400, 'policy_version_invalid', '유효한 약관 버전을 확인할 수 없습니다.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const granted = request.body.granted !== false;
      for (const purpose of purposes) await client.query('INSERT INTO consent_events(org_id,athlete_id,guardian_user_id,policy_version_id,purpose,granted,ip,user_agent) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [ctx.athlete.org_id, ctx.athlete.id, ctx.session.user_id, policyVersionId, purpose, granted, request.ip, request.headers['user-agent'] ?? null]);
      if (!granted && purposes.includes('child_account')) await client.query("UPDATE athletes SET status='draft' WHERE id=$1", [ctx.athlete.id]);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    return reply.code(201).send({ granted: request.body.granted !== false ? purposes : [] });
  });
  app.get<{ Params: { id: string }; Querystring: { ticketId?: string } }>('/api/athletes/:id/training', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id, request.query.ticketId);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (!(await activeGate(ctx.athlete))) return fail(reply, 409, 'athlete_not_active', '보호자 동의가 확인될 때까지 기록을 이용할 수 없습니다.');
    const { rows } = await pool.query('SELECT id,trained_on,type,minutes,intensity,memo,author_user_id FROM training_sessions WHERE org_id=$1 AND athlete_id=$2 ORDER BY trained_on DESC,id DESC LIMIT 100', [ctx.athlete.org_id, ctx.athlete.id]);
    return { training: rows };
  });
  app.post<{ Params: { id: string }; Body: { trainedOn?: string; type?: string; minutes?: number; intensity?: string; memo?: string } }>('/api/athletes/:id/training', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (!(await activeGate(ctx.athlete))) return fail(reply, 409, 'athlete_not_active', '보호자 동의가 확인될 때까지 기록을 이용할 수 없습니다.');
    const athleteUser = await pool.query("SELECT 1 FROM memberships WHERE org_id=$1 AND athlete_id=$2 AND role='athlete'", [ctx.athlete.org_id, ctx.athlete.id]);
    const allowed = athleteUser.rowCount ? ctx.role === 'athlete' : ctx.role === 'coach';
    if (!allowed) return fail(reply, 403, 'forbidden', '기록을 작성할 권한이 없습니다.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(request.body?.trainedOn ?? '') || !bodyText(request.body?.type, 80) || !Number.isInteger(request.body?.minutes) || (request.body?.minutes ?? 0) < 1 || (request.body?.minutes ?? 1441) > 1440 || !['low','mid','high'].includes(request.body?.intensity ?? '')) return fail(reply, 400, 'invalid_input', '훈련 기록을 확인해 주세요.');
    const { rows } = await pool.query('INSERT INTO training_sessions(org_id,athlete_id,trained_on,type,minutes,intensity,memo,author_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [ctx.athlete.org_id, ctx.athlete.id, request.body.trainedOn, request.body.type, request.body.minutes, request.body.intensity, request.body.memo ?? '', ctx.session.user_id]);
    return reply.code(201).send(rows[0]);
  });
  app.patch<{ Params: { id: string; rowId: string }; Body: { trainedOn?: string; type?: string; minutes?: number; intensity?: string; memo?: string } }>('/api/athletes/:id/training/:rowId', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (!(await activeGate(ctx.athlete))) return fail(reply, 409, 'athlete_not_active', '보호자 동의가 확인될 때까지 기록을 이용할 수 없습니다.');
    const b=request.body??{};
    if((b.trainedOn!==undefined&&!/^\d{4}-\d{2}-\d{2}$/.test(b.trainedOn))||(b.type!==undefined&&!bodyText(b.type,80))||(b.minutes!==undefined&&(!Number.isInteger(b.minutes)||b.minutes<1||b.minutes>1440))||(b.intensity!==undefined&&!['low','mid','high'].includes(b.intensity))||(b.memo!==undefined&&typeof b.memo!=='string'))return fail(reply,400,'invalid_input','훈련 기록을 확인해 주세요.');
    const { rows } = await pool.query('UPDATE training_sessions SET trained_on=coalesce($1::date,trained_on),type=coalesce($2,type),minutes=coalesce($3,minutes),intensity=coalesce($4,intensity),memo=coalesce($5,memo) WHERE id=$6 AND athlete_id=$7 AND org_id=$8 AND author_user_id=$9 RETURNING *', [b.trainedOn ?? null, b.type ?? null, b.minutes ?? null, b.intensity ?? null, b.memo ?? null, request.params.rowId, ctx.athlete.id, ctx.athlete.org_id, ctx.session.user_id]);
    if (!rows[0]) return fail(reply, 403, 'forbidden', '본인이 작성한 기록만 수정할 수 있습니다.');
    return rows[0];
  });
  app.delete<{ Params: { id: string; rowId: string } }>('/api/athletes/:id/training/:rowId', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (!(await activeGate(ctx.athlete))) return fail(reply,409,'athlete_not_active','보호자 동의가 확인될 때까지 기록을 이용할 수 없습니다.');
    const result = await pool.query('DELETE FROM training_sessions WHERE id=$1 AND athlete_id=$2 AND org_id=$3 AND author_user_id=$4', [request.params.rowId, ctx.athlete.id, ctx.athlete.org_id, ctx.session.user_id]);
    if (!result.rowCount) return fail(reply, 403, 'forbidden', '본인이 작성한 기록만 삭제할 수 있습니다.');
    return reply.code(204).send();
  });
  app.get<{ Params: { id: string } }>('/api/athletes/:id/games', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (!(await activeGate(ctx.athlete))) return fail(reply, 409, 'athlete_not_active', '보호자 동의가 확인될 때까지 기록을 이용할 수 없습니다.');
    const { rows } = await pool.query('SELECT id,played_on,competition,opponent,result,score,performance,at_bats,hits,walks,author_user_id FROM game_appearances WHERE org_id=$1 AND athlete_id=$2 ORDER BY played_on DESC,id DESC LIMIT 100', [ctx.athlete.org_id, ctx.athlete.id]);
    return { games: rows };
  });
  app.post<{ Params: { id: string }; Body: { playedOn?: string; competition?: string; opponent?: string; result?: string; score?: string; performance?: string; atBats?: number; hits?: number; walks?: number } }>('/api/athletes/:id/games', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (!(await activeGate(ctx.athlete))) return fail(reply, 409, 'athlete_not_active', '보호자 동의가 확인될 때까지 기록을 이용할 수 없습니다.');
    const athleteUser = await pool.query("SELECT 1 FROM memberships WHERE org_id=$1 AND athlete_id=$2 AND role='athlete'", [ctx.athlete.org_id, ctx.athlete.id]);
    if (athleteUser.rowCount ? ctx.role !== 'athlete' : ctx.role !== 'coach') return fail(reply, 403, 'forbidden', '기록을 작성할 권한이 없습니다.');
    const b = request.body ?? {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.playedOn ?? '') || !Number.isInteger(b.atBats) || !Number.isInteger(b.hits) || !Number.isInteger(b.walks) || (b.atBats ?? -1) < 0 || (b.hits ?? -1) < 0 || (b.hits ?? 0) > (b.atBats ?? 0) || (b.walks ?? -1) < 0) return fail(reply, 400, 'invalid_input', '경기 기록을 확인해 주세요.');
    const { rows } = await pool.query('INSERT INTO game_appearances(org_id,athlete_id,played_on,competition,opponent,result,score,performance,at_bats,hits,walks,author_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *', [ctx.athlete.org_id, ctx.athlete.id, b.playedOn, b.competition ?? '', b.opponent ?? '', b.result ?? '', b.score ?? '', b.performance ?? '', b.atBats, b.hits, b.walks, ctx.session.user_id]);
    return reply.code(201).send(rows[0]);
  });
  app.patch<{ Params: { id: string; rowId: string }; Body: Record<string, unknown> }>('/api/athletes/:id/games/:rowId', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (!(await activeGate(ctx.athlete))) return fail(reply, 409, 'athlete_not_active', '보호자 동의가 확인될 때까지 기록을 이용할 수 없습니다.');
    const b = request.body ?? {};
    if((b.playedOn!==undefined&&(typeof b.playedOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.playedOn)))||(['atBats','hits','walks'].some(k=>b[k]!==undefined&&(!Number.isInteger(b[k])||Number(b[k])<0)))||(typeof b.atBats==='number'&&typeof b.hits==='number'&&b.hits>b.atBats)||Object.entries(b).some(([k,v])=>!['playedOn','competition','opponent','result','score','performance','atBats','hits','walks'].includes(k)||(typeof v!=='string'&&typeof v!=='number')))return fail(reply,400,'invalid_input','경기 기록을 확인해 주세요.');
    const { rows } = await pool.query('UPDATE game_appearances SET played_on=coalesce($1::date,played_on),competition=coalesce($2,competition),opponent=coalesce($3,opponent),result=coalesce($4,result),score=coalesce($5,score),performance=coalesce($6,performance),at_bats=coalesce($7,at_bats),hits=coalesce($8,hits),walks=coalesce($9,walks) WHERE id=$10 AND athlete_id=$11 AND org_id=$12 AND author_user_id=$13 RETURNING *', [b.playedOn ?? null,b.competition ?? null,b.opponent ?? null,b.result ?? null,b.score ?? null,b.performance ?? null,b.atBats ?? null,b.hits ?? null,b.walks ?? null,request.params.rowId,ctx.athlete.id,ctx.athlete.org_id,ctx.session.user_id]);
    if (!rows[0]) return fail(reply, 403, 'forbidden', '본인이 작성한 기록만 수정할 수 있습니다.');
    return rows[0];
  });
  app.delete<{ Params: { id: string; rowId: string } }>('/api/athletes/:id/games/:rowId', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (!(await activeGate(ctx.athlete))) return fail(reply,409,'athlete_not_active','보호자 동의가 확인될 때까지 기록을 이용할 수 없습니다.');
    const result = await pool.query('DELETE FROM game_appearances WHERE id=$1 AND athlete_id=$2 AND org_id=$3 AND author_user_id=$4', [request.params.rowId,ctx.athlete.id,ctx.athlete.org_id,ctx.session.user_id]);
    if (!result.rowCount) return fail(reply, 403, 'forbidden', '본인이 작성한 기록만 삭제할 수 있습니다.');
    return reply.code(204).send();
  });
  app.get<{ Params: { id: string; goalId: string } }>('/api/athletes/:id/goals/:goalId', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (!(await activeGate(ctx.athlete))) return fail(reply, 409, 'athlete_not_active', '보호자 동의가 확인될 때까지 목표를 이용할 수 없습니다.');
    if (ctx.role === 'guardian' && !(await pool.query("SELECT 1 FROM athlete_profiles WHERE athlete_id=$1 AND goals_visibility='team'", [ctx.athlete.id])).rowCount) return fail(reply, 404, 'not_found', '목표를 찾을 수 없습니다.');
    const { rows } = await pool.query('SELECT id,title,metric,target_numeric,due_on FROM goals WHERE id=$1 AND athlete_id=$2 AND org_id=$3', [request.params.goalId,ctx.athlete.id,ctx.athlete.org_id]);
    if (!rows[0]) return fail(reply, 404, 'not_found', '목표를 찾을 수 없습니다.');
    return rows[0];
  });
  app.put<{ Params: { id: string; goalId: string }; Body: { title?: string; targetNumeric?: number } }>('/api/athletes/:id/goals/:goalId', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (ctx.role !== 'coach') return fail(reply, 403, 'forbidden', '코치만 목표를 수정할 수 있습니다.');
    if (!(await activeGate(ctx.athlete))) return fail(reply, 409, 'athlete_not_active', '보호자 동의가 확인될 때까지 목표를 이용할 수 없습니다.');
    if (!bodyText(request.body?.title, 120) || typeof request.body?.targetNumeric !== 'number' || request.body.targetNumeric <= 0) return fail(reply, 400, 'invalid_input', '목표 이름과 수치를 확인해 주세요.');
    const { rows } = await pool.query('UPDATE goals SET title=$1,target_numeric=$2 WHERE id=$3 AND athlete_id=$4 AND org_id=$5 RETURNING id,title,metric,target_numeric,due_on', [request.body.title,request.body.targetNumeric,request.params.goalId,ctx.athlete.id,ctx.athlete.org_id]);
    if (!rows[0]) return fail(reply, 404, 'not_found', '목표를 찾을 수 없습니다.');
    return rows[0];
  });
  app.get<{ Params: { id: string } }>('/api/athletes/:id/notes', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (!(await activeGate(ctx.athlete))) return fail(reply, 409, 'athlete_not_active', '보호자 동의가 확인될 때까지 기록을 이용할 수 없습니다.');
    const guardian = ctx.role === 'guardian';
    const { rows } = await pool.query(`SELECT id,body,visible_to_guardian,author_user_id,created_at FROM coach_notes WHERE org_id=$1 AND athlete_id=$2 ${guardian ? 'AND visible_to_guardian=true' : ''} ORDER BY created_at DESC LIMIT 100`, [ctx.athlete.org_id, ctx.athlete.id]);
    return { notes: rows };
  });
  app.post<{ Params: { id: string }; Body: { body?: string; visibleToGuardian?: boolean } }>('/api/athletes/:id/notes', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (ctx.role !== 'coach') return fail(reply, 403, 'forbidden', '코치만 메모를 작성할 수 있습니다.');
    if (!(await activeGate(ctx.athlete))) return fail(reply, 409, 'athlete_not_active', '보호자 동의가 확인될 때까지 기록을 이용할 수 없습니다.');
    if (!bodyText(request.body?.body)) return fail(reply, 400, 'invalid_input', '메모를 입력해 주세요.');
    const { rows } = await pool.query('INSERT INTO coach_notes(org_id,athlete_id,author_user_id,body,visible_to_guardian) VALUES($1,$2,$3,$4,$5) RETURNING *', [ctx.athlete.org_id, ctx.athlete.id, ctx.session.user_id, request.body.body, request.body.visibleToGuardian === true]);
    return reply.code(201).send(rows[0]);
  });
  app.get<{ Params: { id: string } }>('/api/athletes/:id/requests', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (!['guardian','coach','org_admin'].includes(ctx.role)) return fail(reply, 403, 'forbidden', '요청을 볼 권한이 없습니다.');
    if (!(await activeGate(ctx.athlete))) return fail(reply, 409, 'athlete_not_active', '보호자 동의가 확인될 때까지 기록을 이용할 수 없습니다.');
    const { rows } = await pool.query('SELECT id,body,status,author_user_id,created_at FROM coach_requests WHERE org_id=$1 AND athlete_id=$2 ORDER BY created_at DESC', [ctx.athlete.org_id, ctx.athlete.id]);
    return { requests: rows };
  });
  app.post<{ Params: { id: string }; Body: { body?: string } }>('/api/athletes/:id/requests', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (ctx.role !== 'guardian') return fail(reply, 403, 'forbidden', '보호자만 코치에게 요청할 수 있습니다.');
    if (!(await activeGate(ctx.athlete))) return fail(reply, 409, 'athlete_not_active', '보호자 동의가 확인될 때까지 기록을 이용할 수 없습니다.');
    if (!bodyText(request.body?.body)) return fail(reply, 400, 'invalid_input', '요청 내용을 입력해 주세요.');
    const { rows } = await pool.query('INSERT INTO coach_requests(org_id,athlete_id,author_user_id,body) VALUES($1,$2,$3,$4) RETURNING *', [ctx.athlete.org_id, ctx.athlete.id, ctx.session.user_id, request.body.body]);
    return reply.code(201).send(rows[0]);
  });
  app.get<{Params:{id:string}}>('/api/athletes/:id/cheers',async(request,reply)=>{
    const ctx=await athleteContext(request,request.params.id);
    if('error'in ctx)return fail(reply,ctx.error==='unauthenticated'?401:404,String(ctx.error),'선수를 찾을 수 없습니다.');
    if(!(await activeGate(ctx.athlete)))return fail(reply,409,'athlete_not_active','보호자 동의가 확인될 때까지 응원을 이용할 수 없습니다.');
    const {rows}=await pool.query('SELECT id,body,author_user_id,created_at FROM cheers WHERE org_id=$1 AND athlete_id=$2 ORDER BY created_at DESC LIMIT 100',[ctx.athlete.org_id,ctx.athlete.id]);
    return {cheers:rows};
  });
  app.post<{Params:{id:string};Body:{body?:string}}>('/api/athletes/:id/cheers',async(request,reply)=>{
    const ctx=await athleteContext(request,request.params.id);
    if('error'in ctx)return fail(reply,ctx.error==='unauthenticated'?401:404,String(ctx.error),'선수를 찾을 수 없습니다.');
    if(ctx.role!=='guardian')return fail(reply,403,'forbidden','보호자만 응원을 남길 수 있습니다.');
    if(!(await activeGate(ctx.athlete)))return fail(reply,409,'athlete_not_active','보호자 동의가 확인될 때까지 응원을 이용할 수 없습니다.');
    if(!bodyText(request.body?.body,500))return fail(reply,400,'invalid_input','응원 내용을 입력해 주세요.');
    const {rows}=await pool.query('INSERT INTO cheers(org_id,athlete_id,author_user_id,body) VALUES($1,$2,$3,$4) RETURNING id,body,author_user_id,created_at',[ctx.athlete.org_id,ctx.athlete.id,ctx.session.user_id,String(request.body.body).trim()]);
    return reply.code(201).send(rows[0]);
  });
  app.patch<{ Params: { id: string; requestId: string }; Body: { status?: string } }>('/api/athletes/:id/requests/:requestId', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (ctx.role !== 'coach' || !['pending','done'].includes(request.body?.status ?? '')) return fail(reply, 403, 'forbidden', '코치만 요청 상태를 변경할 수 있습니다.');
    if (!(await activeGate(ctx.athlete))) return fail(reply,409,'athlete_not_active','보호자 동의가 확인될 때까지 기록을 이용할 수 없습니다.');
    const { rows } = await pool.query('UPDATE coach_requests SET status=$1 WHERE id=$2 AND org_id=$3 AND athlete_id=$4 RETURNING *', [request.body.status, request.params.requestId, ctx.athlete.org_id, ctx.athlete.id]);
    if (!rows[0]) return fail(reply, 404, 'not_found', '요청을 찾을 수 없습니다.');
    return rows[0];
  });
  app.get<{ Params: { id: string } }>('/api/athletes/:id/visibility', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (!['athlete','org_admin'].includes(ctx.role)) return fail(reply,403,'forbidden','공개 범위를 볼 권한이 없습니다.');
    const { rows } = await pool.query('SELECT profile_visibility AS profile,training_visibility AS training,games_visibility AS games,goals_visibility AS goals FROM athlete_profiles WHERE athlete_id=$1',[ctx.athlete.id]);
    return rows[0] ?? {profile:'private',training:'private',games:'private',goals:'private'};
  });
  app.delete<{ Params: { id: string; requestId: string } }>('/api/athletes/:id/requests/:requestId', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (ctx.role !== 'guardian') return fail(reply, 403, 'forbidden', '보호자만 요청을 취소할 수 있습니다.');
    if (!(await activeGate(ctx.athlete))) return fail(reply,409,'athlete_not_active','보호자 동의가 확인될 때까지 기록을 이용할 수 없습니다.');
    const result = await pool.query('DELETE FROM coach_requests WHERE id=$1 AND athlete_id=$2 AND author_user_id=$3', [request.params.requestId, ctx.athlete.id, ctx.session.user_id]);
    if (!result.rowCount) return fail(reply, 404, 'not_found', '요청을 찾을 수 없습니다.');
    return reply.code(204).send();
  });
  app.get<{ Params: { id: string } }>('/api/athletes/:id/summary', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (!(await activeGate(ctx.athlete))) return fail(reply, 409, 'athlete_not_active', '보호자 동의가 확인될 때까지 기록을 이용할 수 없습니다.');
    const { rows } = await pool.query(`WITH RECURSIVE dates AS (SELECT (now() AT TIME ZONE 'Asia/Seoul')::date today), streak(day,n) AS (SELECT today,1 FROM dates WHERE EXISTS(SELECT 1 FROM training_sessions WHERE org_id=$1 AND athlete_id=$2 AND trained_on=today) UNION ALL SELECT streak.day-1,streak.n+1 FROM streak WHERE EXISTS(SELECT 1 FROM training_sessions WHERE org_id=$1 AND athlete_id=$2 AND trained_on=streak.day-1)), t AS (SELECT COALESCE(sum(minutes) FILTER(WHERE trained_on BETWEEN today-6 AND today),0) week_minutes, count(DISTINCT trained_on) FILTER(WHERE trained_on BETWEEN today-6 AND today) week_days, COALESCE(sum(minutes) FILTER(WHERE trained_on>=date_trunc('month',today)::date),0) month_minutes FROM training_sessions CROSS JOIN dates WHERE org_id=$1 AND athlete_id=$2 AND trained_on>=date_trunc('year',today)::date), g AS (SELECT sum(hits) FILTER(WHERE played_on>=date_trunc('year',today)::date)::int season_hits,sum(hits) FILTER(WHERE played_on>=date_trunc('month',today)::date)::int month_hits,sum(at_bats) FILTER(WHERE played_on>=date_trunc('month',today)::date)::int month_abs FROM game_appearances CROSS JOIN dates WHERE org_id=$1 AND athlete_id=$2 AND played_on>=date_trunc('year',today)::date), goal_rows AS (SELECT coalesce(json_agg(json_build_object('id',id,'title',title,'metric',metric,'targetNumeric',target_numeric)),'[]') items FROM goals WHERE org_id=$1 AND athlete_id=$2) SELECT t.*,g.season_hits,CASE WHEN g.month_abs=0 THEN NULL ELSE round(g.month_hits::numeric/g.month_abs,3) END month_batting_average,coalesce((SELECT max(n) FROM streak),0) streak,goal_rows.items goals FROM t,g,goal_rows`, [ctx.athlete.org_id, ctx.athlete.id]);
    const summary = rows[0];
    if (ctx.role === 'guardian' && !(await pool.query("SELECT 1 FROM athlete_profiles WHERE athlete_id=$1 AND goals_visibility='team'", [ctx.athlete.id])).rowCount) summary.goals = [];
    return summary;
  });
  app.put<{ Params: { id: string }; Body: { visibility?: Record<string,string> } }>('/api/athletes/:id/visibility', async (request, reply) => {
    const ctx = await athleteContext(request, request.params.id);
    if ('error' in ctx) return fail(reply, ctx.error === 'unauthenticated' ? 401 : 404, String(ctx.error), '선수를 찾을 수 없습니다.');
    if (!['athlete','org_admin'].includes(ctx.role)) return fail(reply, 403, 'forbidden', '공개 범위를 변경할 권한이 없습니다.');
    const vis = request.body?.visibility ?? {};
    if (Object.values(vis).some(v => !['private','team'].includes(v))) return fail(reply, 400, 'invalid_visibility', '공개 범위는 비공개 또는 팀 공개만 선택할 수 있습니다.');
    const { rows } = await pool.query('INSERT INTO athlete_profiles(org_id,athlete_id,profile_visibility,training_visibility,games_visibility,goals_visibility) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(athlete_id) DO UPDATE SET profile_visibility=$3,training_visibility=$4,games_visibility=$5,goals_visibility=$6 RETURNING *', [ctx.athlete.org_id, ctx.athlete.id, vis.profile ?? 'private', vis.training ?? 'private', vis.games ?? 'private', vis.goals ?? 'private']);
    return rows[0];
  });
  app.get<{ Params: { orgId: string } }>('/api/orgs/:orgId/subscription', async (request, reply) => {
    if (!await membership(request, request.params.orgId, ['org_admin'])) return fail(reply, 404, 'not_found', '기관을 찾을 수 없습니다.');
    const { rows } = await pool.query('SELECT s.*,p.supply_krw,p.vat_krw FROM subscriptions s JOIN plans p ON p.code=s.plan_code WHERE s.org_id=$1 ORDER BY s.created_at DESC LIMIT 1', [request.params.orgId]);
    return { subscription: rows[0] ?? null };
  });
  app.get<{ Params: { orgId: string } }>('/api/orgs/:orgId/invoices', async (request, reply) => {
    if (!await membership(request, request.params.orgId, ['org_admin'])) return fail(reply, 404, 'not_found', '기관을 찾을 수 없습니다.');
    const { rows } = await pool.query('SELECT id,period_start,supply_krw,vat_krw,total_krw,due_on,status,evidence FROM invoices WHERE org_id=$1 ORDER BY period_start DESC LIMIT 36', [request.params.orgId]);
    return { invoices: rows };
  });
  app.post<{Body:{title?:string;body?:string;category?:string}}>('/api/tickets',async(request,reply)=>{
    const session=await currentSession(request);if(!session)return fail(reply,401,'unauthenticated','로그인이 필요합니다.');
    const member=await pool.query('SELECT org_id FROM memberships WHERE id=$1 AND user_id=$2',[session.active_membership_id,session.user_id]);
    if(!member.rowCount)return fail(reply,404,'not_found','소속을 찾을 수 없습니다.');
    if(!bodyText(request.body?.title,160)||!bodyText(request.body?.body,5000)||!['account','privacy','billing','other'].includes(request.body?.category??''))return fail(reply,400,'invalid_input','문의 내용을 확인해 주세요.');
    const {rows}=await pool.query('INSERT INTO tickets(org_id,user_id,title,body,category) VALUES($1,$2,$3,$4,$5) RETURNING id,status,created_at',[member.rows[0].org_id,session.user_id,request.body.title,request.body.body,request.body.category]);
    return reply.code(201).send(rows[0]);
  });
  app.get('/api/ops/tickets',async(request,reply)=>{
    const session=await currentSession(request);if(!session||!(await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1',[session.user_id])).rowCount)return fail(reply,404,'not_found','요청을 찾을 수 없습니다.');
    const {rows}=await pool.query('SELECT id,org_id,user_id,title,body,category,status,created_at FROM tickets ORDER BY created_at DESC LIMIT 200');return {tickets:rows};
  });
  app.get('/api/ops/orgs',async(request,reply)=>{
    const session=await currentSession(request);if(!session||!(await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1',[session.user_id])).rowCount)return fail(reply,404,'not_found','요청을 찾을 수 없습니다.');
    const {rows}=await pool.query("SELECT o.id,o.name,o.legal_name,o.business_number,o.status,o.seat_athletes,o.seat_coaches,(SELECT s.status FROM subscriptions s WHERE s.org_id=o.id ORDER BY s.created_at DESC LIMIT 1) subscription_status,(SELECT count(*)::int FROM athletes a WHERE a.org_id=o.id AND a.status<>'erased') athletes_count FROM orgs o ORDER BY o.created_at DESC LIMIT 500");return {orgs:rows};
  });
  app.get<{Querystring:{status?:string}}>('/api/ops/invoices',async(request,reply)=>{
    const session=await currentSession(request);if(!session||!(await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1',[session.user_id])).rowCount)return fail(reply,404,'not_found','요청을 찾을 수 없습니다.');
    const status=request.query.status??'open';
    if(!['open','overdue','due','paid','refunded'].includes(status))return fail(reply,400,'invalid_input','청구서 상태를 확인해 주세요.');
    const statuses=status==='due'?['open','overdue']:[status];
    const {rows}=await pool.query("SELECT i.id,i.org_id,o.name org_name,i.subscription_id,i.period_start,i.due_on,i.supply_krw,i.vat_krw,i.total_krw,i.status,coalesce(charge.amount_krw,0)::int paid_krw,coalesce(refund.amount_krw,0)::int refunded_krw,greatest(coalesce(charge.amount_krw,0)-coalesce(refund.amount_krw,0),0)::int refundable_krw FROM invoices i JOIN orgs o ON o.id=i.org_id LEFT JOIN LATERAL(SELECT amount_krw FROM payments WHERE invoice_id=i.id AND kind='charge' AND status='paid' ORDER BY created_at DESC LIMIT 1) charge ON true LEFT JOIN LATERAL(SELECT coalesce(sum(amount_krw),0)::int amount_krw FROM payments WHERE invoice_id=i.id AND kind='refund' AND status='refunded') refund ON true WHERE i.status=ANY($1::text[]) ORDER BY i.due_on,i.period_start LIMIT 200",[statuses]);
    return {invoices:rows};
  });
  app.get<{Querystring:{orgId?:string;limit?:string}}>('/api/ops/audit',async(request,reply)=>{
    const session=await currentSession(request);if(!session||!(await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1',[session.user_id])).rowCount)return fail(reply,404,'not_found','요청을 찾을 수 없습니다.');
    const limit=Math.min(Math.max(Number(request.query.limit)||100,1),500);
    const {rows}=await pool.query('SELECT id,at,actor_user_id,org_id,athlete_id,ticket_id,action,object_type,object_id FROM audit_events WHERE ($1::uuid IS NULL OR org_id=$1) ORDER BY at DESC LIMIT $2',[request.query.orgId??null,limit]);return {events:rows};
  });
  app.patch<{Params:{id:string};Body:{status?:string}}>('/api/ops/tickets/:id',async(request,reply)=>{
    const session=await currentSession(request);if(!session||!(await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1',[session.user_id])).rowCount)return fail(reply,404,'not_found','요청을 찾을 수 없습니다.');
    if(!['open','in_progress','resolved'].includes(request.body?.status??''))return fail(reply,400,'invalid_input','문의 상태를 확인해 주세요.');
    const {rows}=await pool.query('UPDATE tickets SET status=$1 WHERE id=$2 RETURNING id,org_id,status',[request.body.status,request.params.id]);if(!rows[0])return fail(reply,404,'not_found','문의를 찾을 수 없습니다.');
    await pool.query("INSERT INTO audit_events(actor_user_id,org_id,ticket_id,action,object_type,object_id,ip) VALUES($1,$2,$3,'ticket.update','ticket',$3::uuid::text,$4)",[session.user_id,rows[0].org_id,rows[0].id,request.ip]);return rows[0];
  });
  app.get('/api/notices',async()=>{const {rows}=await pool.query("SELECT id,title,body,created_at FROM notices WHERE status='published' ORDER BY created_at DESC LIMIT 50");return {notices:rows};});
  app.post<{Body:{title?:string;body?:string;status?:string}}>('/api/ops/notices',async(request,reply)=>{
    const session=await currentSession(request);if(!session||!(await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1',[session.user_id])).rowCount)return fail(reply,404,'not_found','요청을 찾을 수 없습니다.');
    if(!bodyText(request.body?.title,160)||!bodyText(request.body?.body,5000)||!['draft','published'].includes(request.body?.status??'published'))return fail(reply,400,'invalid_input','공지 내용을 확인해 주세요.');
    const {rows}=await pool.query('INSERT INTO notices(title,body,status) VALUES($1,$2,$3) RETURNING id,title,status,created_at',[request.body.title,request.body.body,request.body.status??'published']);
    await pool.query("INSERT INTO audit_events(actor_user_id,action,object_type,object_id,ip) VALUES($1,'notice.create','notice',$2::uuid::text,$3)",[session.user_id,rows[0].id,request.ip]);return reply.code(201).send(rows[0]);
  });
  app.get('/api/ops/notices',async(request,reply)=>{
    const session=await currentSession(request);if(!session||!(await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1',[session.user_id])).rowCount)return fail(reply,404,'not_found','요청을 찾을 수 없습니다.');
    const {rows}=await pool.query('SELECT id,title,body,status,created_at FROM notices ORDER BY created_at DESC LIMIT 200');return {notices:rows};
  });
  app.patch<{Params:{id:string};Body:{status?:string}}>('/api/ops/notices/:id',async(request,reply)=>{
    const session=await currentSession(request);if(!session||!(await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1',[session.user_id])).rowCount)return fail(reply,404,'not_found','요청을 찾을 수 없습니다.');
    if(!['draft','published','archived'].includes(request.body?.status??''))return fail(reply,400,'invalid_input','공지 상태를 확인해 주세요.');
    const {rows}=await pool.query('UPDATE notices SET status=$1 WHERE id=$2 RETURNING id,title,status',[request.body.status,request.params.id]);if(!rows[0])return fail(reply,404,'not_found','공지를 찾을 수 없습니다.');
    await pool.query("INSERT INTO audit_events(actor_user_id,action,object_type,object_id,ip) VALUES($1,'notice.update','notice',$2::uuid::text,$3)",[session.user_id,rows[0].id,request.ip]);return rows[0];
  });
  app.put<{Body:{maintenance?:boolean;message?:string;supportEmail?:string}}>('/api/ops/settings',async(request,reply)=>{
    const session=await currentSession(request);if(!session||!(await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1',[session.user_id])).rowCount)return fail(reply,404,'not_found','요청을 찾을 수 없습니다.');
    if(typeof request.body?.maintenance!=='boolean'||(request.body.message!==undefined&&typeof request.body.message!=='string')||(request.body.supportEmail!==undefined&&typeof request.body.supportEmail!=='string'))return fail(reply,400,'invalid_input','사이트 설정을 확인해 주세요.');
    const {rows}=await pool.query('UPDATE platform_settings SET maintenance=$1,message=$2,support_email=$3 WHERE id=true RETURNING maintenance,message,support_email',[request.body.maintenance,request.body.message??'',request.body.supportEmail??'']);
    await pool.query("INSERT INTO audit_events(actor_user_id,action,object_type,object_id,ip) VALUES($1,'settings.update','platform_settings','singleton',$2)",[session.user_id,request.ip]);return rows[0];
  });
  app.post<{ Params: { orgId: string }; Body: { planCode?: string; trialDays?: number } }>('/api/ops/orgs/:orgId/subscription', async (request, reply) => {
    const session = await currentSession(request);
    if (!session || !(await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1', [session.user_id])).rowCount) return fail(reply, 404, 'not_found', '요청을 찾을 수 없습니다.');
    const { planCode, trialDays = 0 } = request.body ?? {};
    if (planCode !== 'academy_monthly_v1' || !Number.isInteger(trialDays) || trialDays < 0 || trialDays > 30) return fail(reply, 400, 'invalid_input', '구독 플랜 또는 체험 기간을 확인해 주세요.');
    const plan = await pool.query('SELECT * FROM plans WHERE code=$1', [planCode]);
    if (!plan.rowCount) return fail(reply, 400, 'plan_not_found', '구독 플랜을 찾을 수 없습니다.');
    const start = await pool.query("SELECT (now() AT TIME ZONE 'Asia/Seoul')::date d");
    const end = trialDays
      ? await pool.query('SELECT ($1::date + $2::int) d', [start.rows[0].d, trialDays])
      : await pool.query("SELECT ($1::date + interval '1 month')::date d", [start.rows[0].d]);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const sub = await client.query("INSERT INTO subscriptions(org_id,plan_code,status,current_period_start,current_period_end) VALUES($1,$2,$3,$4,$5) RETURNING *", [request.params.orgId, planCode, trialDays ? 'trialing' : 'incomplete', start.rows[0].d, end.rows[0].d]);
      let invoice = null;
      if (!trialDays) invoice = (await client.query("INSERT INTO invoices(org_id,subscription_id,period_start,supply_krw,vat_krw,total_krw,due_on,status) VALUES($1,$2,$3,$4,$5,$6,$3::date+14,'open') RETURNING *", [request.params.orgId, sub.rows[0].id, start.rows[0].d, plan.rows[0].supply_krw, plan.rows[0].vat_krw, plan.rows[0].supply_krw + plan.rows[0].vat_krw])).rows[0];
      await client.query("INSERT INTO audit_events(actor_user_id,org_id,action,object_type,object_id,ip) VALUES($1,$2,'subscription.create','subscription',$3,$4)", [session.user_id, request.params.orgId, sub.rows[0].id, request.ip]);
      await client.query('COMMIT');
      return reply.code(201).send({ subscription: sub.rows[0], invoice });
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  });
  app.post<{ Params: { id: string }; Body: { amountKrw?: number; evidence?: string } }>('/api/ops/invoices/:id/mark-paid', async (request, reply) => {
    const session = await currentSession(request);
    if (!session || !(await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1', [session.user_id])).rowCount) return fail(reply, 404, 'not_found', '요청을 찾을 수 없습니다.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const inv = await client.query("SELECT * FROM invoices WHERE id=$1 AND status='open' FOR UPDATE", [request.params.id]);
      if (!inv.rowCount) { await client.query('ROLLBACK'); return fail(reply, 404, 'not_found', '청구서를 찾을 수 없습니다.'); }
      if (request.body?.amountKrw !== inv.rows[0].total_krw) { await client.query('ROLLBACK'); return fail(reply, 400, 'amount_mismatch', '입금액이 청구 금액과 일치하지 않습니다.'); }
      const idem = `manual-paid:${inv.rows[0].id}`;
      await client.query("INSERT INTO payments(invoice_id,kind,amount_krw,status,idempotency_key) VALUES($1,'charge',$2,'paid',$3) ON CONFLICT(idempotency_key) DO NOTHING", [inv.rows[0].id, inv.rows[0].total_krw, idem]);
      await client.query("UPDATE invoices SET status='paid',evidence=$2 WHERE id=$1", [inv.rows[0].id, request.body.evidence ?? null]);
      await client.query("UPDATE subscriptions SET status='active',grace_until=NULL WHERE id=$1", [inv.rows[0].subscription_id]);
      await client.query("INSERT INTO audit_events(actor_user_id,org_id,action,object_type,object_id,ip) VALUES($1,$2,'invoice.mark_paid','invoice',$3,$4)", [session.user_id, inv.rows[0].org_id, inv.rows[0].id, request.ip]);
      await client.query('COMMIT');
      return { id: inv.rows[0].id, status: 'paid' };
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  });
  app.post<{ Params: { id: string }; Body: { amountKrw?: number; reason?: string } }>('/api/ops/invoices/:id/refund', async (request, reply) => {
    const session = await currentSession(request);
    if (!session || !(await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1', [session.user_id])).rowCount) return fail(reply, 404, 'not_found', '요청을 찾을 수 없습니다.');
    const amountKrw=request.body?.amountKrw;
    const reason=request.body?.reason;
    if(typeof amountKrw!=='number'||!Number.isInteger(amountKrw)||amountKrw<=0||!bodyText(reason,500))return fail(reply,400,'invalid_input','환불 금액과 사유를 확인해 주세요.');
    const idempotencyKey=request.headers['idempotency-key'];
    if(typeof idempotencyKey!=='string'||!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey))return fail(reply,400,'idempotency_required','환불 요청 식별자가 필요합니다.');
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const invoice=await client.query('SELECT id,org_id,status FROM invoices WHERE id=$1 FOR UPDATE',[request.params.id]);
      if(!invoice.rowCount){await client.query('ROLLBACK');return fail(reply,404,'not_found','결제 내역을 찾을 수 없습니다.');}
      const prior=await client.query('SELECT id,invoice_id,kind,amount_krw,refund_of_payment_id FROM payments WHERE idempotency_key=$1',[idempotencyKey]);
      if(prior.rowCount){
        if(prior.rows[0].invoice_id!==request.params.id||prior.rows[0].kind!=='refund'||prior.rows[0].amount_krw!==amountKrw){await client.query('ROLLBACK');return fail(reply,409,'idempotency_conflict','이미 처리된 요청 식별자가 다른 환불에 사용되었습니다.');}
        const balance=await client.query("SELECT p.amount_krw-coalesce(sum(r.amount_krw),0)::int remaining FROM payments p LEFT JOIN payments r ON r.kind='refund' AND r.refund_of_payment_id=p.id WHERE p.id=$1 GROUP BY p.id",[prior.rows[0].refund_of_payment_id]);
        await client.query('COMMIT');
        return {id:prior.rows[0].id,invoiceId:request.params.id,status:invoice.rows[0].status,amountKrw:prior.rows[0].amount_krw,remainingKrw:balance.rows[0]?.remaining??0};
      }
      if(invoice.rows[0].status!=='paid'){await client.query('ROLLBACK');return fail(reply,409,'invoice_not_refundable','결제가 완료된 청구서만 환불할 수 있습니다.');}
      const charge=await client.query("SELECT p.id,p.amount_krw paid,coalesce(sum(r.amount_krw),0)::int refunded FROM payments p LEFT JOIN payments r ON r.kind='refund' AND r.refund_of_payment_id=p.id WHERE p.invoice_id=$1 AND p.kind='charge' AND p.status='paid' GROUP BY p.id ORDER BY p.created_at DESC LIMIT 1",[request.params.id]);
      if(!charge.rowCount){await client.query('ROLLBACK');return fail(reply,404,'not_found','결제 내역을 찾을 수 없습니다.');}
      const remaining=charge.rows[0].paid-charge.rows[0].refunded;
      if(amountKrw>remaining){await client.query('ROLLBACK');return fail(reply,400,'amount_mismatch','환불 금액이 남은 결제 금액을 초과합니다.');}
      const refund=await client.query("INSERT INTO payments(invoice_id,kind,amount_krw,status,refund_of_payment_id,idempotency_key) VALUES($1,'refund',$2,'refunded',$3,$4) RETURNING id",[request.params.id,amountKrw,charge.rows[0].id,idempotencyKey]);
      const fullyRefunded=amountKrw===remaining;
      await client.query("UPDATE invoices SET status=CASE WHEN $2 THEN 'refunded' ELSE status END,evidence=concat(coalesce(evidence,''),CASE WHEN $2 THEN ' | 환불: ' ELSE ' | 부분 환불: ' END,$3::text) WHERE id=$1",[request.params.id,fullyRefunded,reason]);
      await client.query("INSERT INTO audit_events(actor_user_id,org_id,action,object_type,object_id,ip) VALUES($1,$2,'invoice.refund','invoice',$3,$4)",[session.user_id,invoice.rows[0].org_id,request.params.id,request.ip]);
      await client.query('COMMIT');
      return {id:refund.rows[0].id,invoiceId:request.params.id,status:fullyRefunded?'refunded':'paid',amountKrw,remainingKrw:remaining-amountKrw};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
  app.post<{Params:{id:string};Body:{status?:string;ntsApprovalNumber?:string;issuedOn?:string}}>('/api/ops/invoices/:id/tax-invoice',async(request,reply)=>{
    const session=await currentSession(request);if(!session||!(await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1',[session.user_id])).rowCount)return fail(reply,404,'not_found','요청을 찾을 수 없습니다.');
    const {status,ntsApprovalNumber,issuedOn}=request.body??{};
    const issuedDate=dateOnly(issuedOn);
    if(!['draft','issued_manual','void'].includes(status??'')||(status==='issued_manual'&&(!bodyText(ntsApprovalNumber,80)||!issuedDate)))return fail(reply,400,'invalid_input','세금계산서 상태와 승인 정보를 확인해 주세요.');
    const invoice=await pool.query('SELECT i.id,i.org_id,o.legal_name,o.business_number,o.representative_name,o.business_address,o.business_type,o.business_item,o.tax_invoice_email FROM invoices i JOIN orgs o ON o.id=i.org_id WHERE i.id=$1',[request.params.id]);
    if(!invoice.rowCount)return fail(reply,404,'not_found','청구서를 찾을 수 없습니다.');
    if(status==='issued_manual'&&(!/^\d{10}$/.test(invoice.rows[0].business_number??'')||['legal_name','representative_name','business_address','business_type','business_item','tax_invoice_email'].some(key=>!invoice.rows[0][key])))return fail(reply,409,'billing_profile_incomplete','사업자 정보가 완성된 뒤 세금계산서를 등록할 수 있습니다.');
    const {rows}=await pool.query('INSERT INTO tax_invoices(invoice_id,nts_approval_number,status,issued_on) VALUES($1,$2,$3,$4) ON CONFLICT(invoice_id) DO UPDATE SET nts_approval_number=EXCLUDED.nts_approval_number,status=EXCLUDED.status,issued_on=EXCLUDED.issued_on RETURNING *',[request.params.id,ntsApprovalNumber??null,status,issuedOn??null]);
    await pool.query("INSERT INTO audit_events(actor_user_id,org_id,action,object_type,object_id,ip) VALUES($1,$2,'tax_invoice.update','tax_invoice',$3::uuid::text,$4)",[session.user_id,invoice.rows[0].org_id,rows[0].id,request.ip]);return rows[0];
  });
  app.post<{ Params: { id: string }; Body: { when?: string } }>('/api/ops/subscriptions/:id/cancel', async (request, reply) => {
    const session = await currentSession(request);
    if (!session || !(await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1', [session.user_id])).rowCount) return fail(reply, 404, 'not_found', '요청을 찾을 수 없습니다.');
    if (request.body?.when !== 'period_end') return fail(reply, 400, 'invalid_input', '기간 종료 해지만 지원합니다.');
    const { rows } = await pool.query("UPDATE subscriptions SET cancel_at=current_period_end WHERE id=$1 AND status<>'canceled' RETURNING *", [request.params.id]);
    if (!rows[0]) return fail(reply, 404, 'not_found', '구독을 찾을 수 없습니다.');
    await pool.query("INSERT INTO audit_events(actor_user_id,org_id,action,object_type,object_id,ip) VALUES($1,$2,'subscription.cancel_scheduled','subscription',$3,$4)", [session.user_id, rows[0].org_id, request.params.id, request.ip]);
    return { id: rows[0].id, cancelAt: rows[0].cancel_at };
  });
  app.post<{ Params: { provider: string } }>('/api/billing/webhooks/:provider', async (_request, reply) => fail(reply, 501, 'provider_unconfigured', '결제 웹훅 제공자가 아직 설정되지 않았습니다.'));
}
