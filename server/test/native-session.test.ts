import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/index.js';
import { jobPool, pool } from '../src/db.js';
import { digestPassword } from '../src/identity.js';

const maintenancePool = new pg.Pool({ connectionString: 'postgres://sportsgrow_migrate:local_migrate_password@localhost:5432/sportsgrow' });

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const suffix = Date.now();
const email = `native-session-${suffix}@example.invalid`;
const password = 'native-session-password-123';
const usedKeys = [email, '127.0.0.1'].map(sha256);

let app: FastifyInstance;
let createdUserId: string | undefined;

function rawCookie(setCookie: string | string[] | undefined) {
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  assert.ok(header, 'Set-Cookie 헤더가 있습니다');
  return header;
}

function sessionCookie(setCookie: string | string[] | undefined) {
  const header = rawCookie(setCookie);
  const [pair] = header.split(';');
  const index = pair.indexOf('=');
  assert.ok(index > 0, '쿠키 이름과 값이 있습니다');
  return { name: pair.slice(0, index), token: pair.slice(index + 1) };
}

before(async () => {
  app = await buildApp();
  await pool.query('DELETE FROM login_attempts WHERE key_hash = ANY($1::text[])', [usedKeys]);
  const user = await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id', [email, await digestPassword(password), 'Native session test']);
  createdUserId = user.rows[0].id as string;
});

after(async () => {
  await app.close();
  await pool.query('DELETE FROM login_attempts WHERE key_hash = ANY($1::text[])', [usedKeys]);
  if (createdUserId) {
    await pool.query('DELETE FROM sessions WHERE user_id=$1', [createdUserId]);
    await maintenancePool.query('DELETE FROM audit_events WHERE actor_user_id=$1', [createdUserId]);
    await pool.query('DELETE FROM users WHERE id=$1', [createdUserId]);
  }
  await pool.end();
  await jobPool.end();
  await maintenancePool.end();
});

test('web login sets sg_session only and the cookie alone authenticates', async () => {
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
  assert.equal(login.statusCode, 200, login.body);
  const body = login.json();
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'sessionToken'), false);
  assert.equal(typeof body.user.platformStaff, 'boolean');
  assert.equal(body.platformStaff, body.user.platformStaff);
  const header = rawCookie(login.headers['set-cookie']);
  assert.match(header, /;\s*HttpOnly(;|$)/);
  assert.match(header, /;\s*SameSite=Lax(;|$)/);
  assert.match(header, /;\s*Path=\/(;|$)/);
  const cookie = sessionCookie(login.headers['set-cookie']);
  assert.equal(cookie.name, 'sg_session');
  assert.ok(cookie.token.length > 0);

  const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: `sg_session=${cookie.token}` } });
  assert.equal(me.statusCode, 200, me.body);
  assert.equal(me.json().user.email, email);
  assert.equal(typeof me.json().user.platformStaff, 'boolean');
  assert.equal(me.json().user.platformStaff, body.user.platformStaff);
});

test('native login returns the same token in JSON and works through Bearer alone', async () => {
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'x-sg-client': 'native' }, payload: { email, password } });
  assert.equal(login.statusCode, 200, login.body);
  const body = login.json();
  assert.equal(typeof body.sessionToken, 'string');
  assert.equal(typeof body.user.platformStaff, 'boolean');
  assert.equal(body.platformStaff, body.user.platformStaff);
  const cookie = sessionCookie(login.headers['set-cookie']);
  assert.equal(body.sessionToken, cookie.token);

  const me = await app.inject({ method: 'GET', url: '/api/me', headers: { authorization: `Bearer ${body.sessionToken}` } });
  assert.equal(me.statusCode, 200, me.body);
  assert.equal(me.json().user.email, email);
  assert.equal(me.json().user.platformStaff, body.user.platformStaff);
});

test('Bearer logout deletes that session and later Bearer requests are unauthenticated', async () => {
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'x-sg-client': 'native' }, payload: { email, password } });
  assert.equal(login.statusCode, 200, login.body);
  const token = login.json().sessionToken as string;

  const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { authorization: `Bearer ${token}` } });
  assert.equal(logout.statusCode, 204, logout.body);

  const me = await app.inject({ method: 'GET', url: '/api/me', headers: { authorization: `Bearer ${token}` } });
  assert.equal(me.statusCode, 401, me.body);
  assert.equal(me.json().error, 'unauthenticated');
});

test('wrong password stays 401 with no cookie and no sessionToken', async () => {
  const bad = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'x-sg-client': 'native' }, payload: { email, password: 'not-the-right-password' } });
  assert.equal(bad.statusCode, 401, bad.body);
  assert.equal(bad.json().error, 'invalid_credentials');
  assert.equal(bad.headers['set-cookie'], undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(bad.json(), 'sessionToken'), false);
});
