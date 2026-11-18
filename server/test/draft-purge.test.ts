import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { jobPool, pool } from '../src/db.js';
import { purgeStaleDrafts } from '../src/jobs.js';

const suffix = Date.now();

let client: PoolClient;
let orgId: string;
let teamId: string;
let policyId: string;
let guardianId: string;
let purgeableId: string;
let recentExpiryId: string;
let noInviteId: string;
let grantedId: string;
let laterInviteId: string;

async function draftAthlete(name: string, createdAgo: string) {
  const athlete = await client.query(
    "INSERT INTO athletes(org_id,team_id,display_name,birth_date,status,created_at) VALUES($1,$2,$3,'2014-05-05','draft',now()-$4::interval) RETURNING id",
    [orgId, teamId, name, createdAgo],
  );
  return athlete.rows[0].id as string;
}

async function invite(athleteId: string, expiresIn: string) {
  await client.query(
    "INSERT INTO invites(org_id,role,email,athlete_id,token_hash,expires_at) VALUES($1,'guardian',$2,$3,$4,now()+$5::interval)",
    [orgId, `draft-purge-${suffix}@example.invalid`, athleteId, `draft-purge-token-${suffix}-${athleteId}-${Math.random().toString(16).slice(2)}`, expiresIn],
  );
}

before(async () => {
  client = await pool.connect();
  await client.query('BEGIN');
  const org = await client.query('INSERT INTO orgs(name) VALUES($1) RETURNING id', [`Draft purge org ${suffix}`]);
  orgId = org.rows[0].id as string;
  const team = await client.query("INSERT INTO teams(org_id,name,sport) VALUES($1,'Draft purge team','baseball') RETURNING id", [orgId]);
  teamId = team.rows[0].id as string;
  const guardian = await client.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id', [`draft-purge-guardian-${suffix}@example.invalid`, 'test-hash', 'Draft purge guardian']);
  guardianId = guardian.rows[0].id as string;
  const policy = await client.query("INSERT INTO policy_versions(kind,version,body_sha256,counsel_reviewed) VALUES('privacy',$1,$2,true) RETURNING id", [`draft-purge-${suffix}`, 'd'.repeat(64)]);
  policyId = policy.rows[0].id as string;

  purgeableId = await draftAthlete('Draft purge purgeable', '1 day');
  await invite(purgeableId, '-15 days');
  await client.query("INSERT INTO goals(org_id,athlete_id,title,metric,target_numeric) VALUES($1,$2,'주간 훈련 5일','week_training_days',5)", [orgId, purgeableId]);

  recentExpiryId = await draftAthlete('Draft purge recent expiry', '30 days');
  await invite(recentExpiryId, '-1 day');

  noInviteId = await draftAthlete('Draft purge no invite', '60 days');

  grantedId = await draftAthlete('Draft purge granted', '30 days');
  await invite(grantedId, '-15 days');
  await client.query("INSERT INTO consent_events(org_id,athlete_id,guardian_user_id,policy_version_id,purpose,granted) VALUES($1,$2,$3,$4,'child_account',true)", [orgId, grantedId, guardianId, policyId]);

  laterInviteId = await draftAthlete('Draft purge later invite', '30 days');
  await invite(laterInviteId, '-20 days');
  await invite(laterInviteId, '2 days');
});

after(async () => {
  if (client) {
    await client.query('ROLLBACK');
    client.release();
  }
  await pool.end();
  await jobPool.end();
});

test('draft purge removes athletes only after every unaccepted invite expired 14 days ago and no child_account consent exists', async () => {
  const removed = await purgeStaleDrafts(client);
  assert.equal(removed, 1, 'only the draft whose latest unaccepted invite expired 15 days ago must be removed');

  const survivors = await client.query('SELECT id FROM athletes WHERE id=ANY($1::uuid[])', [[purgeableId, recentExpiryId, noInviteId, grantedId, laterInviteId]]);
  const remaining = new Set(survivors.rows.map((row) => row.id as string));
  assert.equal(remaining.has(purgeableId), false, 'draft with an invite expired 15 days ago must be deleted');
  assert.equal(remaining.has(recentExpiryId), true, 'draft whose invite expired 1 day ago must stay');
  assert.equal(remaining.has(noInviteId), true, 'draft without any invite must stay');
  assert.equal(remaining.has(grantedId), true, 'draft with granted child_account consent must stay');
  assert.equal(remaining.has(laterInviteId), true, 'draft with an unexpired unaccepted invite must stay');

  const goals = await client.query('SELECT count(*)::int n FROM goals WHERE athlete_id=$1', [purgeableId]);
  assert.equal(goals.rows[0].n, 0, 'goals of the deleted draft must be removed by the cascade');
});
