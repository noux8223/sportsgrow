import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/index.js';
import { jobPool, pool } from '../src/db.js';

const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const suffix = Date.now();

function birthDateYearsAgo(years: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date.toISOString().slice(0, 10);
}

let app: FastifyInstance;

before(async () => {
  app = await buildApp();
});

after(async () => {
  await app.close();
  await pool.end();
  await jobPool.end();
});

async function signIn(userId: string, membershipId: string) {
  const token = randomBytes(32).toString('base64url');
  await pool.query("INSERT INTO sessions(user_id,token_hash,active_membership_id,idle_expires_at,absolute_expires_at) VALUES($1,$2,$3,now()+interval '1 hour',now()+interval '1 hour')", [userId, sha(token), membershipId]);
  return `sg_session=${token}`;
}

async function issueInvite(orgId: string, role: string, email: string, athleteId: string) {
  const token = randomBytes(32).toString('base64url');
  const invite = await pool.query("INSERT INTO invites(org_id,role,email,athlete_id,token_hash,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '7 days') RETURNING id", [orgId, role, email, athleteId, sha(token)]);
  return { token, id: invite.rows[0].id as string };
}

test('activating an already active athlete returns 409 athlete_not_draft and adds no goals', async () => {
  const org = await pool.query('INSERT INTO orgs(name) VALUES($1) RETURNING id', [`Roster gate org ${suffix}`]);
  const orgId = org.rows[0].id as string;
  const team = await pool.query("INSERT INTO teams(org_id,name,sport) VALUES($1,'Roster gate team','baseball') RETURNING id", [orgId]);
  const athlete = await pool.query("INSERT INTO athletes(org_id,team_id,display_name,birth_date,status) VALUES($1,$2,'Roster gate athlete',$3,'active') RETURNING id", [orgId, team.rows[0].id, birthDateYearsAgo(20)]);
  const athleteId = athlete.rows[0].id as string;
  await pool.query("INSERT INTO goals(org_id,athlete_id,title,metric,target_numeric) VALUES($1,$2,'주간 훈련 5일','week_training_days',5)", [orgId, athleteId]);
  const user = await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id', [`roster-gate-admin-${suffix}@example.invalid`, 'test-hash', 'Roster gate admin']);
  const userId = user.rows[0].id as string;
  const member = await pool.query("INSERT INTO memberships(org_id,user_id,role) VALUES($1,$2,'org_admin') RETURNING id", [orgId, userId]);

  try {
    const cookie = await signIn(userId, member.rows[0].id as string);
    const before = await pool.query('SELECT count(*)::int n FROM goals WHERE athlete_id=$1', [athleteId]);
    const response = await app.inject({ method: 'POST', url: `/api/athletes/${athleteId}/activate`, headers: { cookie } });
    assert.equal(response.statusCode, 409, response.body);
    assert.equal(response.json().error, 'athlete_not_draft');
    const after = await pool.query('SELECT count(*)::int n FROM goals WHERE athlete_id=$1', [athleteId]);
    assert.equal(after.rows[0].n, before.rows[0].n);
    const stored = await pool.query('SELECT status FROM athletes WHERE id=$1', [athleteId]);
    assert.equal(stored.rows[0].status, 'active');
  } finally {
    await pool.query('DELETE FROM orgs WHERE id=$1', [orgId]);
    await pool.query('DELETE FROM users WHERE id=$1', [userId]);
  }
});

test('accepting an athlete invite for another athlete keeps the existing membership and leaves the invite unused', async () => {
  const org = await pool.query('INSERT INTO orgs(name) VALUES($1) RETURNING id', [`Invite gate org ${suffix}`]);
  const orgId = org.rows[0].id as string;
  const team = await pool.query("INSERT INTO teams(org_id,name,sport) VALUES($1,'Invite gate team','baseball') RETURNING id", [orgId]);
  const first = await pool.query("INSERT INTO athletes(org_id,team_id,display_name,birth_date,status) VALUES($1,$2,'Invite gate first',$3,'active') RETURNING id", [orgId, team.rows[0].id, birthDateYearsAgo(20)]);
  const second = await pool.query("INSERT INTO athletes(org_id,team_id,display_name,birth_date,status) VALUES($1,$2,'Invite gate second',$3,'active') RETURNING id", [orgId, team.rows[0].id, birthDateYearsAgo(20)]);
  const firstAthleteId = first.rows[0].id as string;
  const secondAthleteId = second.rows[0].id as string;
  const email = `invite-gate-athlete-${suffix}@example.invalid`;
  const user = await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id', [email, 'test-hash', 'Invite gate athlete']);
  const userId = user.rows[0].id as string;
  const member = await pool.query("INSERT INTO memberships(org_id,user_id,role,athlete_id) VALUES($1,$2,'athlete',$3) RETURNING id", [orgId, userId, firstAthleteId]);

  try {
    const otherInvite = await issueInvite(orgId, 'athlete', email, secondAthleteId);
    const conflict = await app.inject({ method: 'POST', url: '/api/invites/accept', payload: { token: otherInvite.token, name: 'Invite gate athlete' } });
    assert.equal(conflict.statusCode, 409, conflict.body);
    assert.equal(conflict.json().error, 'membership_exists');
    const unchanged = await pool.query("SELECT athlete_id FROM memberships WHERE id=$1", [member.rows[0].id]);
    assert.equal(unchanged.rows[0].athlete_id, firstAthleteId);
    const unused = await pool.query('SELECT accepted_at FROM invites WHERE id=$1', [otherInvite.id]);
    assert.equal(unused.rows[0].accepted_at, null);

    const sameInvite = await issueInvite(orgId, 'athlete', email, firstAthleteId);
    const accepted = await app.inject({ method: 'POST', url: '/api/invites/accept', payload: { token: sameInvite.token, name: 'Invite gate athlete' } });
    assert.equal(accepted.statusCode, 201, accepted.body);
    assert.equal(accepted.json().membershipId, member.rows[0].id);
    const used = await pool.query('SELECT accepted_at FROM invites WHERE id=$1', [sameInvite.id]);
    assert.notEqual(used.rows[0].accepted_at, null);
  } finally {
    await pool.query('DELETE FROM orgs WHERE id=$1', [orgId]);
    await pool.query('DELETE FROM users WHERE id=$1', [userId]);
  }
});
