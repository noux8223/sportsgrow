import pg from 'pg';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL ?? 'postgres://sportsgrow_app:local_app_password@localhost:5432/sportsgrow';
const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined;

export const pool = new Pool({
  connectionString,
  max: 10,
  connectionTimeoutMillis: 3_000,
  idleTimeoutMillis: 10_000,
  statement_timeout: 2_000,
  query_timeout: 2_000,
  ssl,
  application_name: 'sportsgrow-api',
});

// sportsgrow_app 역할의 statement_timeout 2초가 접속 시 풀 설정을 덮어쓴다.
// 배치 작업만 이 풀을 쓰고, 꺼낸 연결에서 세션 값을 30초로 올린다.
export const jobPool = new Pool({
  connectionString: process.env.JOB_DATABASE_URL ?? connectionString,
  max: 4,
  connectionTimeoutMillis: 3_000,
  idleTimeoutMillis: 10_000,
  query_timeout: 30_000,
  ssl,
  application_name: 'sportsgrow-jobs',
});

export async function connectJob(): Promise<PoolClient> {
  const client = await jobPool.connect();
  try {
    await client.query("SET statement_timeout = '30s'");
    return client;
  } catch (error) {
    client.release();
    throw error;
  }
}

export async function jobQuery<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
  const client = await connectJob();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}
