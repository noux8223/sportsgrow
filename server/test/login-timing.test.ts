import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/index.js';
import { jobPool, pool } from '../src/db.js';
import { digestPassword } from '../src/identity.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const suffix = Date.now();
const existingEmail = `login-timing-${suffix}@example.invalid`;
const existingPassword = 'login-timing-password-123';
const missingEmails = [`login-timing-missing-a-${suffix}@example.invalid`, `login-timing-missing-b-${suffix}@example.invalid`];
const usedKeys = [...missingEmails, existingEmail, '127.0.0.1'].map(sha256);

let app: FastifyInstance;
let createdUserId: string | undefined;

before(async () => {
  app = await buildApp();
  await pool.query('DELETE FROM login_attempts WHERE key_hash = ANY($1::text[])', [usedKeys]);
  const user = await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id', [existingEmail, await digestPassword(existingPassword), 'Login timing test']);
  createdUserId = user.rows[0].id as string;
});

after(async () => {
  await app.close();
  await pool.query('DELETE FROM login_attempts WHERE key_hash = ANY($1::text[])', [usedKeys]);
  if (createdUserId) await pool.query('DELETE FROM users WHERE id=$1', [createdUserId]);
  await pool.end();
  await jobPool.end();
});

test('unknown email returns the same 401 invalid_credentials as a wrong password', async () => {
  const missing = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: missingEmails[0], password: 'not-the-right-password' } });
  assert.equal(missing.statusCode, 401, missing.body);
  assert.equal(missing.json().error, 'invalid_credentials');
  assert.equal(missing.json().message, '이메일 또는 비밀번호가 올바르지 않습니다.');
  assert.equal(missing.headers['set-cookie'], undefined);

  const wrongPassword = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: existingEmail, password: 'not-the-right-password' } });
  assert.equal(wrongPassword.statusCode, 401, wrongPassword.body);
  assert.deepEqual(wrongPassword.json(), missing.json());
  assert.equal(wrongPassword.headers['set-cookie'], undefined);

  const secondMissing = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: missingEmails[1], password: 'not-the-right-password' } });
  assert.equal(secondMissing.statusCode, 401, secondMissing.body);
  assert.deepEqual(secondMissing.json(), missing.json());
});
