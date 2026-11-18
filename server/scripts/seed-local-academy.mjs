import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import argon2 from 'argon2';
import pg from 'pg';

loadEnv({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const configuredUrl = process.env.DATABASE_URL;
if (configuredUrl) {
  let hostname = '';
  try {
    hostname = new URL(configuredUrl).hostname;
  } catch {
    console.error('시드 실패: DATABASE_URL 형식을 확인해 주세요.');
    process.exit(1);
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    console.error('시드 실패: 로컬 데이터베이스에서만 실행할 수 있습니다.');
    process.exit(1);
  }
}

const { Pool } = pg;

const EMAIL = 'academy@sportsgrow.local';
const PASSWORD = 'local-academy-1234';
const NAME = '로컬 아카데미 관리자';
const ORG_NAME = '로컬 아카데미';
const PLAN_CODE = 'academy_monthly_v1';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://sportsgrow_app:local_app_password@localhost:5432/sportsgrow',
  max: 2,
  connectionTimeoutMillis: 3_000,
  idleTimeoutMillis: 10_000,
  statement_timeout: 2_000,
  query_timeout: 2_000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  application_name: 'sportsgrow-seed',
});

const digestPassword = (password) => argon2.hash(password, {
  type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1,
});

async function seed() {
  const existing = await pool.query('SELECT id FROM users WHERE email=$1', [EMAIL]);
  const passwordHash = existing.rowCount ? null : await digestPassword(PASSWORD);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query('SELECT id FROM users WHERE email=$1', [EMAIL]);
    let userId;
    if (current.rowCount) {
      userId = current.rows[0].id;
    } else {
      const inserted = await client.query(
        'INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING RETURNING id',
        [EMAIL, passwordHash, NAME],
      );
      userId = inserted.rowCount
        ? inserted.rows[0].id
        : (await client.query('SELECT id FROM users WHERE email=$1', [EMAIL])).rows[0].id;
    }

    const org = await client.query('SELECT id FROM orgs WHERE name=$1 ORDER BY created_at LIMIT 1', [ORG_NAME]);
    const orgId = org.rowCount
      ? org.rows[0].id
      : (await client.query('INSERT INTO orgs(name) VALUES($1) RETURNING id', [ORG_NAME])).rows[0].id;

    await client.query(
      "INSERT INTO memberships(org_id,user_id,role) VALUES($1,$2,'org_admin') ON CONFLICT(org_id,user_id,role) DO NOTHING",
      [orgId, userId],
    );

    const open = await client.query("SELECT 1 FROM subscriptions WHERE org_id=$1 AND status<>'canceled'", [orgId]);
    if (!open.rowCount) {
      await client.query(
        "INSERT INTO subscriptions(org_id,plan_code,status,current_period_start,current_period_end) VALUES($1,$2,'active',current_date,current_date+interval '1 month')",
        [orgId, PLAN_CODE],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

try {
  await seed();
  console.log(EMAIL);
} catch (error) {
  console.error(`시드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
