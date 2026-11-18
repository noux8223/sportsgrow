import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { pool } from './db.js';

const COOKIE = 'sg_session';
const NATIVE_HEADER = 'x-sg-client';
const IDLE_MS = 12 * 60 * 60 * 1000;
const ABSOLUTE_MS = 14 * 24 * 60 * 60 * 1000;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const digestPassword = (password: string) => argon2.hash(password, {
  type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1,
});
const dummyPasswordHash = digestPassword(randomBytes(32).toString('base64url'));
const fail = (reply: { code: (code: number) => { send: (body: unknown) => unknown } }, status: number, error: string, message: string) =>
  reply.code(status).send({ error, message });

function bearerToken(request: FastifyRequest) {
  const header = request.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length);
  if (!token || /\s/.test(token)) return null;
  return token;
}

const isNativeClient = (request: FastifyRequest) => request.headers[NATIVE_HEADER] === 'native';

async function currentSession(request: FastifyRequest) {
  const token = request.cookies[COOKIE] || bearerToken(request);
  if (!token) return null;
  const result = await pool.query(`
    SELECT s.id, s.user_id, s.active_membership_id, u.email, u.name
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.idle_expires_at > now() AND s.absolute_expires_at > now()
  `, [hash(token)]);
  if (!result.rowCount) return null;
  await pool.query('UPDATE sessions SET last_seen_at = now(), idle_expires_at = LEAST(now() + interval \'12 hours\', absolute_expires_at) WHERE id = $1', [result.rows[0].id]);
  return result.rows[0] as { id: string; user_id: string; active_membership_id: string | null; email: string; name: string };
}

export async function registerIdentityRoutes(app: FastifyInstance) {
  app.post<{ Body: { email?: string; password?: string } }>('/api/auth/login', async (request, reply) => {
    const email = request.body?.email?.trim().toLowerCase();
    const password = request.body?.password;
    if (!email || typeof password !== 'string' || password.length > 128) return fail(reply, 400, 'invalid_input', '이메일과 비밀번호를 확인해 주세요.');
    const clientIp = request.ip;
    const emailKey = hash(email);
    const ipKey = hash(clientIp);
    const limited = await pool.query(`SELECT scope FROM login_attempts WHERE created_at > now() - CASE scope WHEN 'ip' THEN interval '60 seconds' ELSE interval '1 hour' END AND ((scope='ip' AND key_hash=$1) OR (scope='email' AND key_hash=$2)) GROUP BY scope HAVING count(*) >= CASE scope WHEN 'ip' THEN 5 ELSE 10 END`, [ipKey, emailKey]);
    if (limited.rowCount) return fail(reply, 429, 'login_rate_limited', '로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.');
    const found = await pool.query('SELECT id, password_hash, name FROM users WHERE email=$1', [email]);
    const passwordHash = found.rowCount ? found.rows[0].password_hash as string : await dummyPasswordHash;
    const valid = await argon2.verify(passwordHash, password).catch(() => false);
    if (!valid) {
      await pool.query("INSERT INTO login_attempts(scope,key_hash) VALUES ('ip',$1),('email',$2)", [ipKey, emailKey]);
      return fail(reply, 401, 'invalid_credentials', '이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    const userId = found.rows[0].id as string;
    const memberships = await pool.query(`SELECT m.id, m.org_id, o.name AS org_name, m.role, m.athlete_id FROM memberships m JOIN orgs o ON o.id=m.org_id WHERE m.user_id=$1 ORDER BY o.name,m.role`, [userId]);
    const staff = await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1', [userId]);
    const token = randomBytes(32).toString('base64url');
    const active = memberships.rowCount === 1 ? memberships.rows[0].id : null;
    const expires = new Date(Date.now() + ABSOLUTE_MS);
    await pool.query('INSERT INTO sessions(user_id,token_hash,active_membership_id,idle_expires_at,absolute_expires_at,user_agent,ip) VALUES($1,$2,$3,LEAST(now()+interval \'12 hours\',$4),$4,$5,$6)', [userId, hash(token), active, expires, request.headers['user-agent'] ?? null, clientIp]);
    reply.setCookie(COOKIE, token, { httpOnly: true, secure: process.env.APP_ENV === 'pilot' || process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires });
    await pool.query("INSERT INTO audit_events(actor_user_id,action,object_type,object_id,ip) VALUES($1::uuid,'auth.login','user',$1::uuid::text,$2)", [userId, clientIp]);
    const platformStaff = Boolean(staff.rowCount);
    const body = { user: { id: userId, email, name: found.rows[0].name, platformStaff }, memberships: memberships.rows.map((m) => ({ id: m.id, orgId: m.org_id, orgName: m.org_name, role: m.role, athleteIds: m.athlete_id ? [m.athlete_id] : [] })), activeMembershipId: active, platformStaff };
    return isNativeClient(request) ? { ...body, sessionToken: token } : body;
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies[COOKIE] || bearerToken(request);
    if (token) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [hash(token)]);
    reply.clearCookie(COOKIE, { path: '/', httpOnly: true, sameSite: 'lax' });
    return reply.code(204).send();
  });

  app.post<{ Body: { email?: string } }>('/api/auth/password/forgot', async (request, reply) => {
    const email = request.body?.email?.trim().toLowerCase();
    if (email && email.length <= 320) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const user = await client.query('SELECT id FROM users WHERE email=$1 FOR UPDATE', [email]);
        if (user.rowCount) {
          const recent = await client.query("SELECT count(*)::int AS count FROM email_outbox WHERE template='password_reset' AND to_email=$1 AND created_at > now()-interval '1 hour'", [email]);
          if ((recent.rows[0].count as number) < 5) {
            const token = randomBytes(32).toString('base64url');
            await client.query('INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'1 hour\')', [hash(token), user.rows[0].id]);
            await client.query("INSERT INTO email_outbox(idempotency_key,to_email,template,payload,status) VALUES($1,$2,'password_reset',jsonb_build_object('token',$3),'queued') ON CONFLICT(idempotency_key) DO NOTHING", [`password-reset:${hash(token)}`, email, token]);
          }
        }
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    }
    return reply.code(202).send({ message: '계정이 확인되면 비밀번호 재설정 안내를 보내드립니다.' });
  });
  app.post<{ Body: { token?: string; password?: string } }>('/api/auth/password/reset', async (request, reply) => {
    const { token, password } = request.body ?? {};
    if (typeof token !== 'string' || typeof password !== 'string' || password.length < 10 || password.length > 128) return fail(reply, 400, 'invalid_input', '비밀번호는 10자 이상 128자 이하로 입력해 주세요.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query('SELECT user_id FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE', [hash(token)]);
      if (!result.rowCount) { await client.query('ROLLBACK'); return fail(reply, 400, 'reset_token_invalid', '재설정 링크가 만료되었거나 이미 사용되었습니다.'); }
      await client.query('UPDATE users SET password_hash=$1 WHERE id=$2', [await digestPassword(password), result.rows[0].user_id]);
      await client.query('UPDATE password_reset_tokens SET used_at=now() WHERE token_hash=$1', [hash(token)]);
      await client.query('DELETE FROM sessions WHERE user_id=$1', [result.rows[0].user_id]);
      await client.query('COMMIT');
      return { message: '비밀번호가 변경되었습니다. 다시 로그인해 주세요.' };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });

  app.get('/api/me', async (request, reply) => {
    const session = await currentSession(request);
    if (!session) return fail(reply, 401, 'unauthenticated', '로그인이 필요합니다.');
    const memberships = await pool.query('SELECT m.id,m.org_id,o.name AS org_name,m.role,m.athlete_id FROM memberships m JOIN orgs o ON o.id=m.org_id WHERE m.user_id=$1 ORDER BY o.name,m.role', [session.user_id]);
    const staff = await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1', [session.user_id]);
    return { user: { id: session.user_id, email: session.email, name: session.name, platformStaff: Boolean(staff.rowCount) }, memberships: memberships.rows.map((m) => ({ id: m.id, orgId: m.org_id, orgName: m.org_name, role: m.role, athleteIds: m.athlete_id ? [m.athlete_id] : [] })), activeMembershipId: session.active_membership_id };
  });

  app.post<{ Body: { membershipId?: string } }>('/api/session/active-membership', async (request, reply) => {
    const session = await currentSession(request);
    if (!session) return fail(reply, 401, 'unauthenticated', '로그인이 필요합니다.');
    const result = await pool.query('UPDATE sessions SET active_membership_id=$1 WHERE id=$2 AND EXISTS (SELECT 1 FROM memberships WHERE id=$1 AND user_id=$3) RETURNING id', [request.body?.membershipId, session.id, session.user_id]);
    if (!result.rowCount) return fail(reply, 404, 'membership_not_found', '선택한 소속을 찾을 수 없습니다.');
    return { activeMembershipId: request.body?.membershipId };
  });
}

export { currentSession, digestPassword, fail };
