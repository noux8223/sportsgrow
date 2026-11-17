import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/index.js';
import { jobPool, pool } from '../src/db.js';
import { digestPassword } from '../src/identity.js';
import pg from 'pg';

const maintenancePool = new pg.Pool({ connectionString: 'postgres://sportsgrow_migrate:local_migrate_password@localhost:5432/sportsgrow' });
const app = await buildApp();
after(async () => { await app.close(); await pool.end(); await jobPool.end(); await maintenancePool.end(); });

test('active membership scopes athlete reads and writes to its organization', async () => {
  const suffix = Date.now();
  const email = `tenant-coach-${suffix}@example.invalid`;
  const user = await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id', [email, await digestPassword('tenant-test-password-123'), 'Tenant coach']);
  const orgA = await pool.query('INSERT INTO orgs(name) VALUES($1) RETURNING id', [`Tenant A ${suffix}`]);
  const orgB = await pool.query('INSERT INTO orgs(name) VALUES($1) RETURNING id', [`Tenant B ${suffix}`]);
  const team = await pool.query("INSERT INTO teams(org_id,name,sport) VALUES($1,'Other org team','baseball') RETURNING id", [orgB.rows[0].id]);
  const athlete = await pool.query("INSERT INTO athletes(org_id,team_id,display_name,birth_date,status) VALUES($1,$2,'Private athlete','2005-01-01','active') RETURNING id", [orgB.rows[0].id, team.rows[0].id]);
  await pool.query("INSERT INTO memberships(org_id,user_id,role) VALUES($1,$2,'coach')", [orgA.rows[0].id, user.rows[0].id]);

  try {
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: 'tenant-test-password-123' } });
    assert.equal(login.statusCode, 200, login.body);
    const cookie = login.headers['set-cookie']!.split(';')[0];

    const roster = await app.inject({ method: 'GET', url: `/api/orgs/${orgB.rows[0].id}/athletes`, headers: { cookie } });
    assert.equal(roster.statusCode, 404);
    const read = await app.inject({ method: 'GET', url: `/api/athletes/${athlete.rows[0].id}/training`, headers: { cookie } });
    assert.equal(read.statusCode, 404);
    const write = await app.inject({ method: 'POST', url: `/api/athletes/${athlete.rows[0].id}/training`, headers: { cookie }, payload: { trainedOn: '2026-11-17', type: 'practice', minutes: 45, intensity: 'mid' } });
    assert.equal(write.statusCode, 404);
  } finally {
    await maintenancePool.query('DELETE FROM audit_events WHERE actor_user_id=$1 OR org_id=ANY($2::uuid[])', [user.rows[0].id, [orgA.rows[0].id, orgB.rows[0].id]]);
    await pool.query('DELETE FROM orgs WHERE id=ANY($1::uuid[])', [[orgA.rows[0].id, orgB.rows[0].id]]);
    await pool.query('DELETE FROM users WHERE id=$1', [user.rows[0].id]);
  }
});
