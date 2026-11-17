import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const maintenancePool = new pg.Pool({ connectionString: 'postgres://sportsgrow_migrate:local_migrate_password@localhost:5432/sportsgrow' });

function planNodes(node: Record<string, unknown>, output: Record<string, unknown>[] = []) {
  output.push(node);
  for (const child of (node['Plans'] as Record<string, unknown>[] | undefined) ?? []) planNodes(child, output);
  return output;
}

test('weekly training and batting summaries use date-range indexes at pilot volume', { timeout: 60_000 }, async () => {
  const client = await maintenancePool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout='60s'");
    const org = await client.query('INSERT INTO orgs(name) VALUES($1) RETURNING id', [`Plan test org ${Date.now()}`]);
    const team = await client.query("INSERT INTO teams(org_id,name,sport) VALUES($1,'Plan test team','baseball') RETURNING id", [org.rows[0].id]);
    const athletes = await client.query("INSERT INTO athletes(org_id,team_id,display_name,birth_date,status) SELECT $1,$2,'Plan player '||n,'2005-01-01','active' FROM generate_series(1,300) n RETURNING id", [org.rows[0].id, team.rows[0].id]);
    const author = await client.query('INSERT INTO users(email,password_hash,name) VALUES($1,\'test-hash\',\'Plan test\') RETURNING id', [`plan-${Date.now()}@example.invalid`]);

    await client.query(`WITH ranked AS (
      SELECT id,row_number() OVER (ORDER BY id) athlete_n FROM athletes WHERE org_id=$1
    )
    INSERT INTO training_sessions(org_id,athlete_id,trained_on,type,minutes,intensity,author_user_id)
    SELECT $1,a.id,current_date-(g.i%365)::int,'practice',30+(g.i%90)::int,'mid',$2
    FROM generate_series(1,80000) g(i) JOIN ranked a ON a.athlete_n=((g.i-1)%300)+1`, [org.rows[0].id, author.rows[0].id]);
    await client.query(`WITH ranked AS (
      SELECT id,row_number() OVER (ORDER BY id) athlete_n FROM athletes WHERE org_id=$1
    )
    INSERT INTO game_appearances(org_id,athlete_id,played_on,at_bats,hits,walks,author_user_id)
    SELECT $1,a.id,current_date-(g.i%365)::int,1+(g.i%5)::int,(g.i%2)::int,(g.i%3)::int,$2
    FROM generate_series(1,6000) g(i) JOIN ranked a ON a.athlete_n=((g.i-1)%300)+1`, [org.rows[0].id, author.rows[0].id]);
    await client.query('ANALYZE training_sessions');
    await client.query('ANALYZE game_appearances');

    const training = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT coalesce(sum(minutes),0) FROM training_sessions
      WHERE org_id=$1 AND athlete_id=$2 AND trained_on>=current_date-6 AND trained_on<=current_date`, [org.rows[0].id, athletes.rows[0].id]);
    const games = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT sum(hits),sum(at_bats) FROM game_appearances
      WHERE org_id=$1 AND athlete_id=$2 AND played_on>=current_date-6 AND played_on<=current_date`, [org.rows[0].id, athletes.rows[0].id]);

    for (const [label, result, relation] of [['training', training, 'training_sessions'], ['games', games, 'game_appearances']] as const) {
      const root = (result.rows[0]['QUERY PLAN'] as Record<string, unknown>[])[0];
      const nodes = planNodes(root['Plan'] as Record<string, unknown>);
      assert.equal(nodes.some((node) => node['Relation Name'] === relation && node['Node Type'] === 'Seq Scan'), false, `${label} summary must not scan the whole table`);
      assert.ok(nodes.some((node) => node['Relation Name'] === relation && String(node['Node Type']).startsWith('Index')), `${label} summary should use its covering index`);
      assert.ok(Number(root['Execution Time']) < 20, `${label} summary took ${root['Execution Time']}ms`);
    }
    await client.query('ROLLBACK');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await maintenancePool.end();
  }
});
