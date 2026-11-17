import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/index.js';
import { jobPool, pool } from '../src/db.js';
import { digestPassword } from '../src/identity.js';
import { hasCurrentReportConsent, runWeeklyReports } from '../src/reports.js';
import sharp from 'sharp';
import { reencodePhoto } from '../src/media.js';
import pg from 'pg';
const maintenancePool = new pg.Pool({ connectionString: 'postgres://sportsgrow_migrate:local_migrate_password@localhost:5432/sportsgrow' });

let app: FastifyInstance;
before(async () => { app = await buildApp(); });
after(async () => { await app.close(); await pool.end(); await jobPool.end(); await maintenancePool.end(); });

test('all API responses disable caching', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/missing' });
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-frame-options'], 'DENY');
});

test('pilot state-changing requests require the custom CSRF header', async () => {
  const prior = process.env.APP_ENV;
  process.env.APP_ENV = 'pilot';
  try {
    const rejected = await app.inject({ method: 'POST', url: '/api/tickets', payload: { title: 'test', body: 'test', category: 'other' } });
    assert.equal(rejected.statusCode, 403);
    assert.equal(rejected.json().error, 'csrf_rejected');
    const protectedRequest = await app.inject({ method: 'POST', url: '/api/tickets', headers: { 'x-sportsgrow-client': '1' }, payload: { title: 'test', body: 'test', category: 'other' } });
    assert.equal(protectedRequest.statusCode, 401);
    assert.equal(protectedRequest.json().error, 'unauthenticated');
    const providerWebhook = await app.inject({ method: 'POST', url: '/api/billing/webhooks/manual', payload: {} });
    assert.equal(providerWebhook.statusCode, 501);
  } finally {
    if (prior === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prior;
  }
});

test('health endpoint verifies PostgreSQL connectivity', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok', database: 'ok' });
});

test('login rejects malformed input without creating a session', async () => {
  const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: {} });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, 'invalid_input');
  assert.equal(response.headers['cache-control'], 'no-store');
});

test('logout is idempotent and expires the session cookie', async () => {
  const response = await app.inject({ method: 'POST', url: '/api/auth/logout' });
  assert.equal(response.statusCode, 204);
  assert.match(response.headers['set-cookie'] ?? '', /sg_session=/);
});

test('login creates an HttpOnly session and /me resolves membership from the database', async () => {
  const email = `api-test-${Date.now()}@example.invalid`;
  const user = await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id', [email, await digestPassword('testing-password-123'), 'API test']);
  const org = await pool.query('INSERT INTO orgs(name) VALUES($1) RETURNING id', [`API test ${Date.now()}`]);
  await pool.query("INSERT INTO memberships(org_id,user_id,role) VALUES($1,$2,'org_admin')", [org.rows[0].id, user.rows[0].id]);
  try {
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: 'testing-password-123' } });
    assert.equal(login.statusCode, 200, login.body);
    assert.match(login.headers['set-cookie'] ?? '', /HttpOnly/i);
    const cookie = login.headers['set-cookie']!.split(';')[0];
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });
    assert.equal(me.statusCode, 200);
    assert.equal(me.json().memberships[0].role, 'org_admin');
    const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    assert.equal(logout.statusCode, 204);
    const afterLogout = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });
    assert.equal(afterLogout.statusCode, 401);
  } finally {
    await maintenancePool.query('DELETE FROM audit_events WHERE actor_user_id=$1', [user.rows[0].id]);
    await pool.query('DELETE FROM users WHERE id=$1', [user.rows[0].id]);
    await pool.query('DELETE FROM orgs WHERE id=$1', [org.rows[0].id]);
  }
});

test('draft athletes cannot access product records before activation', async () => {
  const email = `coach-test-${Date.now()}@example.invalid`;
  const user = await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id', [email, await digestPassword('testing-password-456'), 'Coach test']);
  const org = await pool.query('INSERT INTO orgs(name) VALUES($1) RETURNING id', [`Draft test ${Date.now()}`]);
  const team = await pool.query("INSERT INTO teams(org_id,name,sport) VALUES($1,'Test team','baseball') RETURNING id", [org.rows[0].id]);
  await pool.query("INSERT INTO memberships(org_id,user_id,role) VALUES($1,$2,'coach')", [org.rows[0].id,user.rows[0].id]);
  try {
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: 'testing-password-456' } });
    const cookie = login.headers['set-cookie']!.split(';')[0];
    const created = await app.inject({ method: 'POST', url: `/api/orgs/${org.rows[0].id}/athletes`, headers: { cookie }, payload: { displayName: 'Draft player', birthDate: '2015-01-01', teamId: team.rows[0].id } });
    assert.equal(created.statusCode, 201, created.body);
    const athleteId = created.json().id;
    const roster=await app.inject({method:'GET',url:`/api/orgs/${org.rows[0].id}/athletes`,headers:{cookie}});
    assert.equal(roster.statusCode,200,roster.body);
    assert.equal(roster.json().athletes[0].hasAthleteUser,false);
    const get = await app.inject({ method: 'GET', url: `/api/athletes/${athleteId}/training`, headers: { cookie } });
    assert.equal(get.statusCode, 409);
    assert.equal(get.json().error, 'athlete_not_active');
    const goals = await pool.query('SELECT count(*)::int n FROM goals WHERE athlete_id=$1', [athleteId]);
    assert.equal(goals.rows[0].n, 0);
  } finally {
    await maintenancePool.query('DELETE FROM audit_events WHERE actor_user_id=$1 OR org_id=$2', [user.rows[0].id, org.rows[0].id]);
    await pool.query('DELETE FROM orgs WHERE id=$1', [org.rows[0].id]);
    await pool.query('DELETE FROM users WHERE id=$1', [user.rows[0].id]);
  }
});

test('guardian consent activates an under-14 athlete, creates goals once, and revocation closes records', async () => {
  const suffix=Date.now();const coachEmail=`consent-coach-${suffix}@example.invalid`;const guardianEmail=`consent-guardian-${suffix}@example.invalid`;
  const coach=await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id',[coachEmail,await digestPassword('testing-password-789'),'Consent coach']);
  const guardian=await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id',[guardianEmail,await digestPassword('testing-password-987'),'Consent guardian']);
  const org=await pool.query('INSERT INTO orgs(name) VALUES($1) RETURNING id',[`Consent org ${suffix}`]);
  const team=await pool.query("INSERT INTO teams(org_id,name,sport) VALUES($1,'Consent team','baseball') RETURNING id",[org.rows[0].id]);
  await pool.query("INSERT INTO memberships(org_id,user_id,role) VALUES($1,$2,'coach')",[org.rows[0].id,coach.rows[0].id]);
  await pool.query("INSERT INTO memberships(org_id,user_id,role) VALUES($1,$2,'guardian')",[org.rows[0].id,guardian.rows[0].id]);
  const policy=await pool.query("INSERT INTO policy_versions(kind,version,body_sha256,counsel_reviewed) VALUES('privacy',$1,$2,true) RETURNING id",[`consent-${suffix}`,'b'.repeat(64)]);
  try{
    const coachLogin=await app.inject({method:'POST',url:'/api/auth/login',payload:{email:coachEmail,password:'testing-password-789'}});const coachCookie=coachLogin.headers['set-cookie']!.split(';')[0];
    const created=await app.inject({method:'POST',url:`/api/orgs/${org.rows[0].id}/athletes`,headers:{cookie:coachCookie},payload:{displayName:'Consent athlete',birthDate:'2015-01-01',teamId:team.rows[0].id}});assert.equal(created.statusCode,201,created.body);const athleteId=created.json().id;
    await pool.query('INSERT INTO guardian_links(org_id,guardian_user_id,athlete_id) VALUES($1,$2,$3)',[org.rows[0].id,guardian.rows[0].id,athleteId]);
    const guardianLogin=await app.inject({method:'POST',url:'/api/auth/login',payload:{email:guardianEmail,password:'testing-password-987'}});const guardianCookie=guardianLogin.headers['set-cookie']!.split(';')[0];
    const granted=await app.inject({method:'POST',url:`/api/athletes/${athleteId}/consents`,headers:{cookie:guardianCookie},payload:{policyVersionId:policy.rows[0].id,purposes:['child_account']}});assert.equal(granted.statusCode,201,granted.body);
    const activated=await app.inject({method:'POST',url:`/api/athletes/${athleteId}/activate`,headers:{cookie:guardianCookie}});assert.equal(activated.statusCode,200,activated.body);
    const goals=await pool.query('SELECT count(*)::int n FROM goals WHERE athlete_id=$1',[athleteId]);assert.equal(goals.rows[0].n,3);
    const saved=await app.inject({method:'POST',url:`/api/athletes/${athleteId}/training`,headers:{cookie:coachCookie},payload:{trainedOn:'2026-11-17',type:'practice',minutes:60,intensity:'mid',memo:''}});assert.equal(saved.statusCode,201,saved.body);
    const revoked=await app.inject({method:'POST',url:`/api/athletes/${athleteId}/consents`,headers:{cookie:guardianCookie},payload:{policyVersionId:policy.rows[0].id,purposes:['child_account'],granted:false}});assert.equal(revoked.statusCode,201,revoked.body);
    const blocked=await app.inject({method:'GET',url:`/api/athletes/${athleteId}/training`,headers:{cookie:coachCookie}});assert.equal(blocked.statusCode,409);assert.equal(blocked.json().error,'athlete_not_active');
    const after=await pool.query('SELECT count(*)::int n FROM goals WHERE athlete_id=$1',[athleteId]);assert.equal(after.rows[0].n,3);
  }finally{
    await maintenancePool.query('DELETE FROM audit_events WHERE actor_user_id=ANY($1::uuid[]) OR org_id=$2',[[coach.rows[0].id,guardian.rows[0].id],org.rows[0].id]);
    await pool.query('DELETE FROM orgs WHERE id=$1',[org.rows[0].id]);await pool.query('DELETE FROM policy_versions WHERE id=$1',[policy.rows[0].id]);await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[coach.rows[0].id,guardian.rows[0].id]]);
  }
});

test('media uploads remain closed until private storage is configured', async () => {
  const response = await app.inject({ method: 'POST', url: '/api/athletes/00000000-0000-4000-8000-000000000001/media/uploads', payload: { contentType: 'image/jpeg', contentLength: 100, kind: 'gallery' } });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, 'media_disabled');
});

test('photo processing re-encodes supported images as bounded JPEGs without metadata',async()=>{
  const source=await sharp({create:{width:80,height:40,channels:3,background:{r:120,g:20,b:40}}}).png().withMetadata({exif:{IFD0:{Artist:'private metadata'}}}).toBuffer();
  const result=await reencodePhoto(source);const metadata=await sharp(result).metadata();
  assert.equal(metadata.format,'jpeg');assert.equal(metadata.width,80);assert.equal(metadata.height,40);assert.equal(metadata.exif,undefined);
  await assert.rejects(()=>reencodePhoto(Buffer.from('not an image')));
});

test('export requests require authentication before checking private storage configuration', async () => {
  const response = await app.inject({ method: 'POST', url: '/api/me/export', payload: { athleteId: '00000000-0000-4000-8000-000000000001' } });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error, 'unauthenticated');
});

test('privacy routes authenticate and authorize before reporting missing storage configuration', async () => {
  const suffix=Date.now();
  const coachEmail=`privacy-coach-${suffix}@example.invalid`;
  const adminEmail=`privacy-admin-${suffix}@example.invalid`;
  const coach=await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id',[coachEmail,await digestPassword('privacy-test-password-123'),'Privacy coach']);
  const admin=await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id',[adminEmail,await digestPassword('privacy-test-password-456'),'Privacy admin']);
  const org=await pool.query('INSERT INTO orgs(name) VALUES($1) RETURNING id',[`Privacy org ${suffix}`]);
  const team=await pool.query("INSERT INTO teams(org_id,name,sport) VALUES($1,'Privacy team','baseball') RETURNING id",[org.rows[0].id]);
  const athlete=await pool.query("INSERT INTO athletes(org_id,team_id,display_name,birth_date,status) VALUES($1,$2,'Privacy athlete','2005-01-01','active') RETURNING id",[org.rows[0].id,team.rows[0].id]);
  await pool.query("INSERT INTO memberships(org_id,user_id,role) VALUES($1,$2,'coach'),($1,$3,'org_admin')",[org.rows[0].id,coach.rows[0].id,admin.rows[0].id]);
  await pool.query('INSERT INTO coach_assignments(org_id,coach_user_id,athlete_id) VALUES($1,$2,$3)',[org.rows[0].id,coach.rows[0].id,athlete.rows[0].id]);
  try{
    const anonymousExport=await app.inject({method:'POST',url:'/api/me/export',payload:{athleteId:athlete.rows[0].id}});
    assert.equal(anonymousExport.statusCode,401);
    const anonymousErasure=await app.inject({method:'POST',url:`/api/athletes/${athlete.rows[0].id}/erasure`});
    assert.equal(anonymousErasure.statusCode,401);

    const coachLogin=await app.inject({method:'POST',url:'/api/auth/login',payload:{email:coachEmail,password:'privacy-test-password-123'}});
    const coachCookie=coachLogin.headers['set-cookie']!.split(';')[0];
    const deniedExport=await app.inject({method:'POST',url:'/api/me/export',headers:{cookie:coachCookie},payload:{athleteId:athlete.rows[0].id}});
    assert.equal(deniedExport.statusCode,403);
    const deniedErasure=await app.inject({method:'POST',url:`/api/athletes/${athlete.rows[0].id}/erasure`,headers:{cookie:coachCookie}});
    assert.equal(deniedErasure.statusCode,403);

    const adminLogin=await app.inject({method:'POST',url:'/api/auth/login',payload:{email:adminEmail,password:'privacy-test-password-456'}});
    const adminCookie=adminLogin.headers['set-cookie']!.split(';')[0];
    const unavailableExport=await app.inject({method:'POST',url:'/api/me/export',headers:{cookie:adminCookie},payload:{athleteId:athlete.rows[0].id}});
    assert.equal(unavailableExport.statusCode,503);
    assert.equal(unavailableExport.json().error,'export_unconfigured');
    const unavailableErasure=await app.inject({method:'POST',url:`/api/athletes/${athlete.rows[0].id}/erasure`,headers:{cookie:adminCookie}});
    assert.equal(unavailableErasure.statusCode,503);
    assert.equal(unavailableErasure.json().error,'erasure_unconfigured');
    await pool.query("UPDATE athletes SET status='erasure_pending' WHERE id=$1",[athlete.rows[0].id]);
    const exportDuringErasure=await app.inject({method:'POST',url:'/api/me/export',headers:{cookie:adminCookie},payload:{athleteId:athlete.rows[0].id}});
    assert.equal(exportDuringErasure.statusCode,409);
    assert.equal(exportDuringErasure.json().error,'athlete_not_active');
  }finally{
    await maintenancePool.query('DELETE FROM audit_events WHERE actor_user_id=ANY($1::uuid[]) OR org_id=$2',[[coach.rows[0].id,admin.rows[0].id],org.rows[0].id]);
    await pool.query('DELETE FROM orgs WHERE id=$1',[org.rows[0].id]);
    await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[coach.rows[0].id,admin.rows[0].id]]);
  }
});

test('weekly reports are snapshotted only for a guardian with report consent', async () => {
  const suffix = Date.now();
  const coachEmail = `report-coach-${suffix}@example.invalid`;
  const guardianEmail = `report-parent-${suffix}@example.invalid`;
  const otherGuardianEmail = `report-other-${suffix}@example.invalid`;
  const coach = await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id', [coachEmail, 'test-hash', 'Report coach']);
  const guardian = await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id', [guardianEmail, 'test-hash', 'Report guardian']);
  const otherGuardian = await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id', [otherGuardianEmail, 'test-hash', 'Other guardian']);
  const org = await pool.query('INSERT INTO orgs(name) VALUES($1) RETURNING id', [`Report org ${suffix}`]);
  const team = await pool.query("INSERT INTO teams(org_id,name,sport) VALUES($1,'Report team','baseball') RETURNING id", [org.rows[0].id]);
  const athlete = await pool.query("INSERT INTO athletes(org_id,team_id,display_name,birth_date,status) VALUES($1,$2,'Report athlete','2005-01-01','active') RETURNING id", [org.rows[0].id,team.rows[0].id]);
  const policy = await pool.query("INSERT INTO policy_versions(kind,version,body_sha256) VALUES('privacy',$1,$2) RETURNING id", [`test-${suffix}`, 'a'.repeat(64)]);
  await pool.query("INSERT INTO consent_events(org_id,athlete_id,guardian_user_id,policy_version_id,purpose,granted) VALUES($1,$2,$3,$4,'report_email',true)", [org.rows[0].id,athlete.rows[0].id,guardian.rows[0].id,policy.rows[0].id]);
  await pool.query("INSERT INTO memberships(org_id,user_id,role) VALUES($1,$2,'coach')", [org.rows[0].id,coach.rows[0].id]);
  await pool.query("INSERT INTO memberships(org_id,user_id,role) VALUES($1,$2,'guardian')", [org.rows[0].id,guardian.rows[0].id]);
  await pool.query("INSERT INTO memberships(org_id,user_id,role) VALUES($1,$2,'guardian')", [org.rows[0].id,otherGuardian.rows[0].id]);
  await pool.query('INSERT INTO guardian_links(org_id,guardian_user_id,athlete_id) VALUES($1,$2,$3)', [org.rows[0].id,guardian.rows[0].id,athlete.rows[0].id]);
  await pool.query('INSERT INTO guardian_links(org_id,guardian_user_id,athlete_id) VALUES($1,$2,$3)', [org.rows[0].id,otherGuardian.rows[0].id,athlete.rows[0].id]);
  await pool.query("INSERT INTO athlete_profiles(org_id,athlete_id,profile_visibility,goals_visibility) VALUES($1,$2,'team','private')",[org.rows[0].id,athlete.rows[0].id]);
  try {
    await runWeeklyReports(new Date('2026-11-15T21:59:00.000Z'));
    assert.equal((await pool.query('SELECT 1 FROM weekly_reports WHERE athlete_id=$1', [athlete.rows[0].id])).rowCount, 0);
    await runWeeklyReports(new Date('2026-11-15T22:00:00.000Z'));
    const report = await pool.query('SELECT body_json FROM weekly_reports WHERE athlete_id=$1 ORDER BY week_start DESC LIMIT 1', [athlete.rows[0].id]);
    assert.equal(report.rowCount, 1);
    await runWeeklyReports(new Date('2026-11-17T00:00:00.000Z'));
    assert.equal((await pool.query('SELECT count(*)::int n FROM weekly_reports WHERE athlete_id=$1', [athlete.rows[0].id])).rows[0].n, 1);
    assert.equal(report.rows[0].body_json.athleteName, 'Report athlete');
    const mail = await pool.query("SELECT count(*)::int n FROM email_outbox WHERE idempotency_key LIKE $1", [`weekly-report:${athlete.rows[0].id}:%`]);
    assert.equal(mail.rows[0].n, 1);
    const recipients=await pool.query("SELECT to_email FROM email_outbox WHERE idempotency_key LIKE $1",[`weekly-report:${athlete.rows[0].id}:%`]);
    assert.deepEqual(recipients.rows.map((row)=>row.to_email),[guardianEmail]);
    assert.equal(await hasCurrentReportConsent(athlete.rows[0].id,guardian.rows[0].id),true);
    await pool.query("INSERT INTO consent_events(org_id,athlete_id,guardian_user_id,policy_version_id,purpose,granted) VALUES($1,$2,$3,$4,'report_email',false)",[org.rows[0].id,athlete.rows[0].id,guardian.rows[0].id,policy.rows[0].id]);
    assert.equal(await hasCurrentReportConsent(athlete.rows[0].id,guardian.rows[0].id),false);
    await pool.query("INSERT INTO consent_events(org_id,athlete_id,guardian_user_id,policy_version_id,purpose,granted) VALUES($1,$2,$3,$4,'report_email',true)",[org.rows[0].id,athlete.rows[0].id,guardian.rows[0].id,policy.rows[0].id]);
    await pool.query("UPDATE athletes SET status='erasure_pending' WHERE id=$1",[athlete.rows[0].id]);
    assert.equal(await hasCurrentReportConsent(athlete.rows[0].id,guardian.rows[0].id),false);
  } finally {
    await pool.query('DELETE FROM email_outbox WHERE idempotency_key LIKE $1', [`weekly-report:${athlete.rows[0].id}:%`]);
    await pool.query('DELETE FROM weekly_reports WHERE athlete_id=$1', [athlete.rows[0].id]);
    await pool.query('DELETE FROM orgs WHERE id=$1', [org.rows[0].id]);
    await pool.query('DELETE FROM policy_versions WHERE id=$1', [policy.rows[0].id]);
    await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [[coach.rows[0].id,guardian.rows[0].id,otherGuardian.rows[0].id]]);
  }
});

test('assigned coach can read and update goals when visibility is private', async () => {
  const suffix = Date.now();
  const coachEmail = `goal-coach-${suffix}@example.invalid`;
  const guardianEmail = `goal-parent-${suffix}@example.invalid`;
  const coach = await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id', [coachEmail, await digestPassword('goal-test-password-123'), 'Goal coach']);
  const guardian = await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id', [guardianEmail, await digestPassword('goal-test-password-123'), 'Goal guardian']);
  const org = await pool.query('INSERT INTO orgs(name) VALUES($1) RETURNING id', [`Goal org ${suffix}`]);
  const team = await pool.query("INSERT INTO teams(org_id,name,sport) VALUES($1,'Goal team','baseball') RETURNING id", [org.rows[0].id]);
  const athlete = await pool.query("INSERT INTO athletes(org_id,team_id,display_name,birth_date,status) VALUES($1,$2,'Goal athlete','2005-01-01','active') RETURNING id", [org.rows[0].id, team.rows[0].id]);
  await pool.query("INSERT INTO athlete_profiles(org_id,athlete_id,goals_visibility) VALUES($1,$2,'private')", [org.rows[0].id, athlete.rows[0].id]);
  const goal = await pool.query("INSERT INTO goals(org_id,athlete_id,title,metric,target_numeric) VALUES($1,$2,'Week days','week_training_days',5) RETURNING id", [org.rows[0].id, athlete.rows[0].id]);
  await pool.query("INSERT INTO memberships(org_id,user_id,role) VALUES($1,$2,'coach')", [org.rows[0].id, coach.rows[0].id]);
  await pool.query("INSERT INTO memberships(org_id,user_id,role) VALUES($1,$2,'guardian')", [org.rows[0].id, guardian.rows[0].id]);
  await pool.query('INSERT INTO coach_assignments(org_id,coach_user_id,athlete_id) VALUES($1,$2,$3)', [org.rows[0].id, coach.rows[0].id, athlete.rows[0].id]);
  await pool.query('INSERT INTO guardian_links(org_id,guardian_user_id,athlete_id) VALUES($1,$2,$3)', [org.rows[0].id, guardian.rows[0].id, athlete.rows[0].id]);
  try {
    const coachLogin = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: coachEmail, password: 'goal-test-password-123' } });
    assert.equal(coachLogin.statusCode, 200, coachLogin.body);
    const coachCookie = String(coachLogin.headers['set-cookie']).split(';')[0];
    const summary = await app.inject({ method: 'GET', url: `/api/athletes/${athlete.rows[0].id}/summary`, headers: { cookie: coachCookie } });
    assert.equal(summary.statusCode, 200, summary.body);
    assert.equal(summary.json().goals.length, 1);
    const updated = await app.inject({ method: 'PUT', url: `/api/athletes/${athlete.rows[0].id}/goals/${goal.rows[0].id}`, headers: { cookie: coachCookie, 'x-sportsgrow-client': '1' }, payload: { title: 'Week target', targetNumeric: 6 } });
    assert.equal(updated.statusCode, 200, updated.body);
    assert.equal(updated.json().title, 'Week target');
    const guardianLogin = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: guardianEmail, password: 'goal-test-password-123' } });
    const guardianCookie = String(guardianLogin.headers['set-cookie']).split(';')[0];
    const hidden = await app.inject({ method: 'GET', url: `/api/athletes/${athlete.rows[0].id}/summary`, headers: { cookie: guardianCookie } });
    assert.equal(hidden.statusCode, 200, hidden.body);
    assert.deepEqual(hidden.json().goals, []);
    const denied = await app.inject({ method: 'GET', url: `/api/athletes/${athlete.rows[0].id}/goals/${goal.rows[0].id}`, headers: { cookie: guardianCookie } });
    assert.equal(denied.statusCode, 404);
  } finally {
    await maintenancePool.query('DELETE FROM audit_events WHERE actor_user_id=ANY($1::uuid[])', [[coach.rows[0].id, guardian.rows[0].id]]);
    await pool.query('DELETE FROM orgs WHERE id=$1', [org.rows[0].id]);
    await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [[coach.rows[0].id, guardian.rows[0].id]]);
  }
});

test('refunds serialize concurrent requests and replay only matching idempotency keys', async () => {
  const suffix=Date.now();
  const email=`billing-staff-${suffix}@example.invalid`;
  const user=await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id',[email,await digestPassword('billing-test-password-123'),'Billing test staff']);
  const org=await pool.query('INSERT INTO orgs(name) VALUES($1) RETURNING id',[`Billing test org ${suffix}`]);
  await pool.query("UPDATE orgs SET legal_name='Billing Test Academy',business_number='1234567890',representative_name='Test Owner',business_address='Seoul',business_type='Sports',business_item='Coaching',tax_invoice_email=$2 WHERE id=$1",[org.rows[0].id,email]);
  await pool.query('INSERT INTO platform_staff(user_id) VALUES($1)',[user.rows[0].id]);
  const subscription=await pool.query("INSERT INTO subscriptions(org_id,plan_code,status,current_period_start,current_period_end) VALUES($1,'academy_monthly_v1','active',current_date,current_date+interval '1 month') RETURNING id",[org.rows[0].id]);
  const invoice=await pool.query("INSERT INTO invoices(org_id,subscription_id,period_start,supply_krw,vat_krw,total_krw,due_on,status) VALUES($1,$2,current_date,100000,10000,110000,current_date+14,'paid') RETURNING id",[org.rows[0].id,subscription.rows[0].id]);
  const openInvoice=await pool.query("INSERT INTO invoices(org_id,subscription_id,period_start,supply_krw,vat_krw,total_krw,due_on,status) VALUES($1,$2,current_date+1,100000,10000,110000,current_date+15,'open') RETURNING id",[org.rows[0].id,subscription.rows[0].id]);
  await pool.query("INSERT INTO payments(invoice_id,kind,amount_krw,status,idempotency_key) VALUES($1,'charge',110000,'paid',$2)",[invoice.rows[0].id,`billing-charge-${suffix}`]);
  try{
    const login=await app.inject({method:'POST',url:'/api/auth/login',payload:{email,password:'billing-test-password-123'}});
    assert.equal(login.statusCode,200,login.body);
    const cookie=login.headers['set-cookie']!.split(';')[0];
    const openInvoices=await app.inject({method:'GET',url:'/api/ops/invoices?status=open',headers:{cookie}});
    assert.equal(openInvoices.statusCode,200,openInvoices.body);
    assert.equal(openInvoices.json().invoices.some((item:{id:string;org_name:string})=>item.id===openInvoice.rows[0].id&&item.org_name===`Billing test org ${suffix}`),true);
    const paidInvoices=await app.inject({method:'GET',url:'/api/ops/invoices?status=paid',headers:{cookie}});
    assert.equal(paidInvoices.statusCode,200,paidInvoices.body);
    assert.equal(paidInvoices.json().invoices.find((item:{id:string;refundable_krw:number})=>item.id===invoice.rows[0].id)?.refundable_krw,110000);
    const refund=(amountKrw:number,key:string)=>app.inject({method:'POST',url:`/api/ops/invoices/${invoice.rows[0].id}/refund`,headers:{cookie,'idempotency-key':key},payload:{amountKrw,reason:'Customer request'}});

    const invalidTaxDate=await app.inject({method:'POST',url:`/api/ops/invoices/${invoice.rows[0].id}/tax-invoice`,headers:{cookie},payload:{status:'issued_manual',ntsApprovalNumber:'NTS-123',issuedOn:'2026-02-31'}});
    assert.equal(invalidTaxDate.statusCode,400);
    const taxInvoice=await app.inject({method:'POST',url:`/api/ops/invoices/${invoice.rows[0].id}/tax-invoice`,headers:{cookie},payload:{status:'issued_manual',ntsApprovalNumber:'NTS-123',issuedOn:'2026-02-28'}});
    assert.equal(taxInvoice.statusCode,200,taxInvoice.body);
    assert.equal(taxInvoice.json().status,'issued_manual');
    assert.equal(taxInvoice.json().nts_approval_number,'NTS-123');
    await assert.rejects(
      () => pool.query("INSERT INTO tax_invoices(invoice_id,status) VALUES($1,'invalid')",[invoice.rows[0].id]),
      (error:unknown) => (error as {code?:string}).code==='23514',
    );

    const first=await refund(40000,`refund-first-${suffix}`);
    assert.equal(first.statusCode,200,first.body);
    assert.deepEqual(first.json(),{id:first.json().id,invoiceId:invoice.rows[0].id,status:'paid',amountKrw:40000,remainingKrw:70000});
    const replay=await refund(40000,`refund-first-${suffix}`);
    assert.equal(replay.statusCode,200,replay.body);
    assert.deepEqual(replay.json(),first.json());
    const conflictingReplay=await refund(50000,`refund-first-${suffix}`);
    assert.equal(conflictingReplay.statusCode,409);
    assert.equal(conflictingReplay.json().error,'idempotency_conflict');

    const concurrent=await Promise.all([refund(40000,`refund-race-a-${suffix}`),refund(40000,`refund-race-b-${suffix}`)]);
    assert.deepEqual(concurrent.map((response)=>response.statusCode).sort(),[200,400]);
    const balance=await pool.query("SELECT 110000-coalesce(sum(amount_krw),0)::int remaining FROM payments WHERE invoice_id=$1 AND kind='refund'",[invoice.rows[0].id]);
    assert.equal(balance.rows[0].remaining,30000);

    const final=await refund(30000,`refund-final-${suffix}`);
    assert.equal(final.statusCode,200,final.body);
    assert.equal(final.json().status,'refunded');
    assert.equal(final.json().remainingKrw,0);
    const finalReplay=await refund(30000,`refund-final-${suffix}`);
    assert.equal(finalReplay.statusCode,200,finalReplay.body);
    assert.deepEqual(finalReplay.json(),final.json());
    const overRefund=await refund(1,`refund-after-final-${suffix}`);
    assert.equal(overRefund.statusCode,409);
    assert.equal(overRefund.json().error,'invoice_not_refundable');
  }finally{
    await maintenancePool.query('DELETE FROM audit_events WHERE actor_user_id=$1 OR org_id=$2',[user.rows[0].id,org.rows[0].id]);
    await pool.query('DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE org_id=$1)',[org.rows[0].id]);
    await pool.query('DELETE FROM tax_invoices WHERE invoice_id IN (SELECT id FROM invoices WHERE org_id=$1)',[org.rows[0].id]);
    await pool.query('DELETE FROM invoices WHERE org_id=$1',[org.rows[0].id]);
    await pool.query('DELETE FROM subscriptions WHERE org_id=$1',[org.rows[0].id]);
    await pool.query('DELETE FROM orgs WHERE id=$1',[org.rows[0].id]);
    await pool.query('DELETE FROM platform_staff WHERE user_id=$1',[user.rows[0].id]);
    await pool.query('DELETE FROM users WHERE id=$1',[user.rows[0].id]);
  }
});

test('maintenance mode blocks tenant writes while preserving cache safety', async () => {
  await maintenancePool.query('UPDATE platform_settings SET maintenance=true WHERE id=true');
  try {
    const response=await app.inject({method:'POST',url:'/api/tickets',payload:{title:'test',body:'test',category:'other'}});
    assert.equal(response.statusCode,503);
    assert.equal(response.json().error,'maintenance');
    assert.equal(response.headers['cache-control'],'no-store');
  } finally { await maintenancePool.query('UPDATE platform_settings SET maintenance=false WHERE id=true'); }
});
