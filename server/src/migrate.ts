import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.MIGRATE_DATABASE_URL ?? 'postgres://sportsgrow_migrate:local_migrate_password@localhost:5432/sportsgrow', max: 1, connectionTimeoutMillis: 3_000, statement_timeout: 300_000, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined });

const client = await pool.connect();
try {
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const dir = new URL('../migrations/', import.meta.url);
  const files = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort();
  for (const name of files) {
    const exists = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
    if (exists.rowCount) continue;
    await client.query('BEGIN');
    try {
      await client.query(await readFile(join(dir.pathname, name), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
  await client.query('GRANT USAGE ON SCHEMA public TO sportsgrow_app, sportsgrow_report');
  await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sportsgrow_app');
  await client.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sportsgrow_app');
  await client.query('GRANT SELECT ON ALL TABLES IN SCHEMA public TO sportsgrow_report');
  await client.query('REVOKE UPDATE, DELETE ON audit_events FROM sportsgrow_app');
  await client.query("ALTER ROLE sportsgrow_app SET statement_timeout='2s'; ALTER ROLE sportsgrow_app SET lock_timeout='1s'; ALTER ROLE sportsgrow_app SET idle_in_transaction_session_timeout='5s'; ALTER ROLE sportsgrow_app SET jit=off");
  await client.query("ALTER ROLE sportsgrow_report SET statement_timeout='30s'; ALTER ROLE sportsgrow_report SET lock_timeout='1s'; ALTER ROLE sportsgrow_report SET idle_in_transaction_session_timeout='5s'; ALTER ROLE sportsgrow_report SET jit=off");
  await client.query("ALTER ROLE sportsgrow_migrate SET statement_timeout='5min'; ALTER ROLE sportsgrow_migrate SET lock_timeout='3s'; ALTER ROLE sportsgrow_migrate SET idle_in_transaction_session_timeout='30s'; ALTER ROLE sportsgrow_migrate SET jit=off");
} finally {
  client.release();
  await pool.end();
}
