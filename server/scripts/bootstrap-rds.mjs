import pg from 'pg';

const { Pool } = pg;
const required = ['MIGRATE_DATABASE_URL', 'APP_DATABASE_PASSWORD', 'REPORT_DATABASE_PASSWORD'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing migration bootstrap secrets: ${missing.join(', ')}`);

const pool = new Pool({
  connectionString: process.env.MIGRATE_DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 3000,
  statement_timeout: 30000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
});

try {
  for (const [role, password] of [
    ['sportsgrow_app', process.env.APP_DATABASE_PASSWORD],
    ['sportsgrow_report', process.env.REPORT_DATABASE_PASSWORD],
  ]) {
    const existing = await pool.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role]);
    const verb = existing.rowCount ? 'ALTER ROLE' : 'CREATE ROLE';
    const statement = await pool.query('SELECT format($1, $2, $3) sql', [
      `${verb} %I LOGIN PASSWORD %L`, role, password,
    ]);
    await pool.query(statement.rows[0].sql);
  }
  const database = await pool.query('SELECT current_database() name');
  const grant = await pool.query('SELECT format($1, $2) sql', [
    'GRANT CONNECT ON DATABASE %I TO sportsgrow_app, sportsgrow_report', database.rows[0].name,
  ]);
  await pool.query(grant.rows[0].sql);
} finally {
  await pool.end();
}

await import('../dist/migrate.js');
