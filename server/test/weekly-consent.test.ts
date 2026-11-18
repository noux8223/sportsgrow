import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { jobPool, pool } from '../src/db.js';
import { digestPassword } from '../src/identity.js';
import { runWeeklyReports } from '../src/reports.js';

const maintenancePool = new pg.Pool({ connectionString: 'postgres://sportsgrow_migrate:local_migrate_password@localhost:5432/sportsgrow' });
const suffix = Date.now();
const guardianEmail = `weekly-consent-${suffix}@example.invalid`;

let orgId: string;
let policyId: string;
let guardianId: string;
let revokedAthleteId: string;
let grantedAthleteId: string;
let noConsentAthleteId: string;

before(async () => {
  const org = await pool.query('INSERT INTO orgs(name) VALUES($1) RETURNING id', [`Weekly consent org ${suffix}`]);
  orgId = org.rows[0].id;
  const team = await pool.query("INSERT INTO teams(org_id,name,sport) VALUES($1,'Weekly consent team','baseball') RETURNING id", [orgId]);
  const guardian = await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id', [guardianEmail, await digestPassword('weekly-consent-password-123'), 'Weekly consent guardian']);
  guardianId = guardian.rows[0].id;
  const policy = await pool.query("INSERT INTO policy_versions(kind,version,body_sha256,counsel_reviewed) VALUES('privacy',$1,$2,true) RETURNING id", [`weekly-consent-${suffix}`, 'c'.repeat(64)]);
  policyId = policy.rows[0].id;
  const revoked = await pool.query("INSERT INTO athletes(org_id,team_id,display_name,birth_date,status) VALUES($1,$2,'Revoked athlete','2005-01-01','active') RETURNING id", [orgId, team.rows[0].id]);
  revokedAthleteId = revoked.rows[0].id;
  const granted = await pool.query("INSERT INTO athletes(org_id,team_id,display_name,birth_date,status) VALUES($1,$2,'Granted athlete','2005-01-01','active') RETURNING id", [orgId, team.rows[0].id]);
  grantedAthleteId = granted.rows[0].id;
  const noConsent = await pool.query("INSERT INTO athletes(org_id,team_id,display_name,birth_date,status) VALUES($1,$2,'No consent athlete','2005-01-01','active') RETURNING id", [orgId, team.rows[0].id]);
  noConsentAthleteId = noConsent.rows[0].id;

  await pool.query("INSERT INTO consent_events(org_id,athlete_id,guardian_user_id,policy_version_id,purpose,granted,created_at) VALUES($1,$2,$3,$4,'report_email',true,now()-interval '2 minutes'),($1,$2,$3,$4,'report_email',false,now()-interval '1 minute')", [orgId, revokedAthleteId, guardianId, policyId]);
  await pool.query("INSERT INTO consent_events(org_id,athlete_id,guardian_user_id,policy_version_id,purpose,granted,created_at) VALUES($1,$2,$3,$4,'report_email',false,now()-interval '2 minutes'),($1,$2,$3,$4,'report_email',true,now()-interval '1 minute')", [orgId, grantedAthleteId, guardianId, policyId]);
});

after(async () => {
  await pool.query('DELETE FROM weekly_reports WHERE athlete_id=ANY($1::uuid[])', [[revokedAthleteId, grantedAthleteId, noConsentAthleteId]]);
  await pool.query('DELETE FROM email_outbox WHERE idempotency_key LIKE $1', [`weekly-report:%:${guardianId}`]);
  await maintenancePool.query('DELETE FROM audit_events WHERE actor_user_id=$1 OR org_id=$2', [guardianId, orgId]);
  await pool.query('DELETE FROM orgs WHERE id=$1', [orgId]);
  await pool.query('DELETE FROM policy_versions WHERE id=$1', [policyId]);
  await pool.query('DELETE FROM users WHERE id=$1', [guardianId]);
  await pool.end();
  await jobPool.end();
  await maintenancePool.end();
});

test('weekly reports only include athletes whose latest report_email consent is granted', async () => {
  await runWeeklyReports(new Date('2026-11-15T22:00:00.000Z'));
  const counts = await pool.query('SELECT athlete_id,count(*)::int n FROM weekly_reports WHERE athlete_id=ANY($1::uuid[]) GROUP BY athlete_id', [[revokedAthleteId, grantedAthleteId, noConsentAthleteId]]);
  const byAthlete = new Map(counts.rows.map((row) => [row.athlete_id as string, row.n as number]));
  assert.equal(byAthlete.get(revokedAthleteId) ?? 0, 0, 'revoked athlete must not get a weekly report');
  assert.equal(byAthlete.get(grantedAthleteId) ?? 0, 1, 'granted athlete must get a weekly report');
  assert.equal(byAthlete.get(noConsentAthleteId) ?? 0, 0, 'athlete without report_email consent must not get a weekly report');
});
