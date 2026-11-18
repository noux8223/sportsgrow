import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const suffix = Date.now();

let app: FastifyInstance;
let pool: Pool;
let jobPool: Pool;
let maintenancePool: Pool;
let bucketStub: Server;
let portraitGranted: (athleteId: string, userId: string) => Promise<boolean>;

let orgId: string;
let teamId: string;
let adultId: string;
let minorNoConsentId: string;
let minorCrossId: string;
let minorLatestId: string;
let minorTermsId: string;
let privacyPolicyId: string;
let termsPolicyId: string;
let guardianA: Session;
let guardianB: Session;
let coach: Session;
let admin: Session;
let staff: Session;
let athleteUser: Session;

type Session = { userId: string; membershipId: string | null; cookie: string; email: string };

const email = (label: string) => `media-auth-${label}-${suffix}@example.invalid`;

async function createUser(label: string, role?: 'guardian' | 'coach' | 'org_admin' | 'athlete', athleteId?: string, platformStaff = false): Promise<Session> {
  const userId = (await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id', [email(label), 'test-hash', `Media ${label}`])).rows[0].id as string;
  let membershipId: string | null = null;
  if (role) membershipId = (await pool.query('INSERT INTO memberships(org_id,user_id,role,athlete_id) VALUES($1,$2,$3,$4) RETURNING id', [orgId, userId, role, athleteId ?? null])).rows[0].id as string;
  if (platformStaff) await pool.query('INSERT INTO platform_staff(user_id) VALUES($1)', [userId]);
  const token = randomUUID();
  await pool.query("INSERT INTO sessions(user_id,token_hash,active_membership_id,idle_expires_at,absolute_expires_at) VALUES($1,$2,$3,now()+interval '1 hour',now()+interval '1 hour')", [userId, sha256(token), membershipId]);
  return { userId, membershipId, cookie: `sg_session=${token}`, email: email(label) };
}

async function newMedia(athleteId: string, createdBy: string, kind = 'hero') {
  const id = randomUUID();
  await pool.query('INSERT INTO media_assets(id,org_id,athlete_id,kind,bucket_key,created_by) VALUES($1,$2,$3,$4,$5,$6)', [id, orgId, athleteId, kind, `org/${orgId}/athlete/${athleteId}/${id}.jpg`, createdBy]);
  return id;
}

async function consent(athleteId: string, guardianUserId: string, granted: boolean, policyVersionId = privacyPolicyId, ageMinutes = 0) {
  await pool.query("INSERT INTO consent_events(org_id,athlete_id,guardian_user_id,policy_version_id,purpose,granted,created_at) VALUES($1,$2,$3,$4,'portrait',$5,now()-($6::int * interval '1 minute'))", [orgId, athleteId, guardianUserId, policyVersionId, granted, ageMinutes]);
}

before(async () => {
  bucketStub = createServer((request, response) => { request.resume(); response.writeHead(204); response.end(); });
  bucketStub.keepAliveTimeout = 1;
  await new Promise<void>((resolve) => bucketStub.listen(0, '127.0.0.1', resolve));
  const port = (bucketStub.address() as AddressInfo).port;
  process.env.MEDIA_BUCKET = 'media-auth-test';
  process.env.S3_ENDPOINT = `http://127.0.0.1:${port}`;
  process.env.AWS_ACCESS_KEY_ID = 'media-auth-test';
  process.env.AWS_SECRET_ACCESS_KEY = 'media-auth-test';
  process.env.MEDIA_UPLOAD = 'false';

  const db = await import('../src/db.js');
  pool = db.pool;
  jobPool = db.jobPool;
  const pg = (await import('pg')).default;
  maintenancePool = new pg.Pool({ connectionString: 'postgres://sportsgrow_migrate:local_migrate_password@localhost:5432/sportsgrow' });
  app = await (await import('../src/index.js')).buildApp();
  portraitGranted = (await import('../src/media.js')).portraitGranted;

  orgId = (await pool.query('INSERT INTO orgs(name) VALUES($1) RETURNING id', [`Media auth ${suffix}`])).rows[0].id as string;
  teamId = (await pool.query("INSERT INTO teams(org_id,name,sport) VALUES($1,'Media auth team','baseball') RETURNING id", [orgId])).rows[0].id as string;
  const athlete = async (name: string, birthDate: string) =>
    (await pool.query(`INSERT INTO athletes(org_id,team_id,display_name,birth_date,status) VALUES($1,$2,$3,$4,'active') RETURNING id`, [orgId, teamId, name, birthDate])).rows[0].id as string;
  adultId = await athlete('Media adult', '2000-03-01');
  minorNoConsentId = await athlete('Media minor none', '2015-05-05');
  minorCrossId = await athlete('Media minor cross', '2014-07-07');
  minorLatestId = await athlete('Media minor latest', '2013-09-09');
  minorTermsId = await athlete('Media minor terms', '2016-01-09');
  privacyPolicyId = (await pool.query("INSERT INTO policy_versions(kind,version,body_sha256) VALUES('privacy',$1,$2) RETURNING id", [`media-auth-${suffix}`, 'b'.repeat(64)])).rows[0].id as string;
  termsPolicyId = (await pool.query("INSERT INTO policy_versions(kind,version,body_sha256) VALUES('terms',$1,$2) RETURNING id", [`media-auth-${suffix}`, 'c'.repeat(64)])).rows[0].id as string;

  guardianA = await createUser('guardian-a', 'guardian');
  guardianB = await createUser('guardian-b', 'guardian');
  coach = await createUser('coach', 'coach');
  admin = await createUser('admin', 'org_admin');
  staff = await createUser('staff', undefined, undefined, true);
  athleteUser = await createUser('athlete', 'athlete', adultId);
  await pool.query('INSERT INTO guardian_links(org_id,guardian_user_id,athlete_id) VALUES($1,$2,$3),($1,$4,$3)', [orgId, guardianA.userId, minorCrossId, guardianB.userId]);
  await pool.query('INSERT INTO guardian_links(org_id,guardian_user_id,athlete_id) VALUES($1,$2,$3),($1,$4,$3)', [orgId, guardianA.userId, minorLatestId, guardianB.userId]);
  await pool.query('INSERT INTO guardian_links(org_id,guardian_user_id,athlete_id) VALUES($1,$2,$3),($1,$4,$3)', [orgId, guardianA.userId, minorNoConsentId, guardianB.userId]);
  await pool.query('INSERT INTO guardian_links(org_id,guardian_user_id,athlete_id) VALUES($1,$2,$3),($1,$4,$3)', [orgId, guardianA.userId, minorTermsId, guardianB.userId]);
  await pool.query('INSERT INTO guardian_links(org_id,guardian_user_id,athlete_id) VALUES($1,$2,$3)', [orgId, guardianA.userId, adultId]);
});

after(async () => {
  try {
    if (app) await app.close();
    if (pool) {
      await maintenancePool.query('DELETE FROM audit_events WHERE org_id=$1', [orgId]);
      await maintenancePool.query('DELETE FROM tickets WHERE org_id=$1', [orgId]);
      await maintenancePool.query('DELETE FROM orgs WHERE id=$1', [orgId]);
      await maintenancePool.query('DELETE FROM users WHERE email LIKE $1', [`media-auth-%-${suffix}@example.invalid`]);
      await maintenancePool.query('DELETE FROM policy_versions WHERE version=$1', [`media-auth-${suffix}`]);
    }
  } finally {
    if (bucketStub) { bucketStub.closeAllConnections(); await new Promise<void>((resolve) => bucketStub.close(() => resolve())); }
    if (pool) await pool.end();
    if (jobPool) await jobPool.end();
    if (maintenancePool) await maintenancePool.end();
  }
});

test('adults need no portrait consent', async () => {
  assert.equal(await portraitGranted(adultId, guardianA.userId), true);
  assert.equal(await portraitGranted(adultId, coach.userId), true);
});

test('unknown athlete never passes', async () => {
  assert.equal(await portraitGranted(randomUUID(), guardianA.userId), false);
});

test('a minor with no portrait consent record is rejected', async () => {
  assert.equal(await portraitGranted(minorNoConsentId, guardianA.userId), false);
  assert.equal(await portraitGranted(minorNoConsentId, guardianB.userId), false);
});

test('another guardian portrait consent does not authorize the caller', async () => {
  await consent(minorCrossId, guardianB.userId, true, privacyPolicyId, 5);
  assert.equal(await portraitGranted(minorCrossId, guardianB.userId), true);
  assert.equal(await portraitGranted(minorCrossId, guardianA.userId), false);
});

test('portrait consent is judged per guardian from the latest row', async () => {
  await consent(minorLatestId, guardianA.userId, true, privacyPolicyId, 5);
  assert.equal(await portraitGranted(minorLatestId, guardianA.userId), true);
  await consent(minorLatestId, guardianA.userId, false, privacyPolicyId, 1);
  assert.equal(await portraitGranted(minorLatestId, guardianA.userId), false);
  await consent(minorLatestId, guardianA.userId, true, privacyPolicyId, 0);
  assert.equal(await portraitGranted(minorLatestId, guardianA.userId), true);
  assert.equal(await portraitGranted(minorLatestId, guardianB.userId), false);
});

test('portrait consent must belong to a privacy policy version', async () => {
  await consent(minorTermsId, guardianA.userId, true, termsPolicyId, 0);
  assert.equal(await portraitGranted(minorTermsId, guardianA.userId), false);
});

test('uploads stay closed while MEDIA_UPLOAD is off', async () => {
  const response = await app.inject({ method: 'POST', url: `/api/athletes/${adultId}/media/uploads`, payload: { contentType: 'image/jpeg', contentLength: 100, kind: 'gallery' } });
  assert.equal(response.statusCode, 503, response.body);
  assert.equal(response.json().error, 'media_disabled');
});

test('anonymous media delete is 401', async () => {
  const id = await newMedia(adultId, admin.userId);
  const response = await app.inject({ method: 'DELETE', url: `/api/media/${id}` });
  assert.equal(response.statusCode, 401, response.body);
  assert.equal(response.json().error, 'unauthenticated');
});

test('unknown media is 404', async () => {
  const response = await app.inject({ method: 'DELETE', url: `/api/media/${randomUUID()}`, headers: { cookie: admin.cookie } });
  assert.equal(response.statusCode, 404, response.body);
  assert.equal(response.json().error, 'not_found');
});

test('a coach who did not create the photo and has no role in it is 403', async () => {
  const id = await newMedia(adultId, admin.userId);
  const response = await app.inject({ method: 'DELETE', url: `/api/media/${id}`, headers: { cookie: coach.cookie } });
  assert.equal(response.statusCode, 403, response.body);
  assert.equal(response.json().error, 'forbidden');
});

test('a guardian not linked to the athlete is 403', async () => {
  const id = await newMedia(adultId, admin.userId);
  const response = await app.inject({ method: 'DELETE', url: `/api/media/${id}`, headers: { cookie: guardianB.cookie } });
  assert.equal(response.statusCode, 403, response.body);
  assert.equal(response.json().error, 'forbidden');
});

test('platform staff delete without a ticketId is 404', async () => {
  const id = await newMedia(adultId, admin.userId);
  const response = await app.inject({ method: 'DELETE', url: `/api/media/${id}`, headers: { cookie: staff.cookie } });
  assert.equal(response.statusCode, 404, response.body);
  assert.equal(response.json().error, 'not_found');
  assert.equal((await pool.query('SELECT 1 FROM media_assets WHERE id=$1 AND deleted_at IS NOT NULL', [id])).rowCount, 0);
});

test('platform staff delete with an unknown or closed ticket is 404', async () => {
  const id = await newMedia(adultId, admin.userId);
  const unknown = await app.inject({ method: 'DELETE', url: `/api/media/${id}?ticketId=${randomUUID()}`, headers: { cookie: staff.cookie } });
  assert.equal(unknown.statusCode, 404, unknown.body);
  const closedTicket = (await pool.query("INSERT INTO tickets(org_id,user_id,title,body,category,status) VALUES($1,$2,'media closed','body','other','closed') RETURNING id", [orgId, admin.userId])).rows[0].id as string;
  const closed = await app.inject({ method: 'DELETE', url: `/api/media/${id}?ticketId=${closedTicket}`, headers: { cookie: staff.cookie } });
  assert.equal(closed.statusCode, 404, closed.body);
  assert.equal((await pool.query('SELECT 1 FROM media_assets WHERE id=$1 AND deleted_at IS NOT NULL', [id])).rowCount, 0);
});

test('platform staff delete with an open ticket succeeds and records the ticket in the audit row', async () => {
  const id = await newMedia(adultId, admin.userId);
  const ticketId = (await pool.query("INSERT INTO tickets(org_id,user_id,title,body,category,status) VALUES($1,$2,'media open','body','other','open') RETURNING id", [orgId, admin.userId])).rows[0].id as string;
  const response = await app.inject({ method: 'DELETE', url: `/api/media/${id}?ticketId=${ticketId}`, headers: { cookie: staff.cookie } });
  assert.equal(response.statusCode, 204, response.body);
  assert.equal((await pool.query('SELECT 1 FROM media_assets WHERE id=$1 AND deleted_at IS NOT NULL', [id])).rowCount, 1);
  const audit = await pool.query("SELECT actor_user_id,ticket_id FROM audit_events WHERE org_id=$1 AND action='media.delete' AND object_id=$2", [orgId, id]);
  assert.equal(audit.rowCount, 1);
  assert.equal(audit.rows[0].actor_user_id, staff.userId);
  assert.equal(audit.rows[0].ticket_id, ticketId);
});

test('author, org_admin, linked guardian and athlete account delete without a ticket', async () => {
  const byAuthor = await newMedia(adultId, coach.userId);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/media/${byAuthor}`, headers: { cookie: coach.cookie } })).statusCode, 204);

  const byAdmin = await newMedia(adultId, coach.userId);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/media/${byAdmin}`, headers: { cookie: admin.cookie } })).statusCode, 204);

  const byGuardian = await newMedia(adultId, coach.userId);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/media/${byGuardian}`, headers: { cookie: guardianA.cookie } })).statusCode, 204);

  const byAthlete = await newMedia(adultId, coach.userId);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/media/${byAthlete}`, headers: { cookie: athleteUser.cookie } })).statusCode, 204);

  const audit = await pool.query("SELECT ticket_id FROM audit_events WHERE org_id=$1 AND action='media.delete' AND object_id=ANY($2::text[])", [orgId, [byAuthor, byAdmin, byGuardian, byAthlete]]);
  assert.equal(audit.rowCount, 4);
  for (const row of audit.rows) assert.equal(row.ticket_id, null);
});
