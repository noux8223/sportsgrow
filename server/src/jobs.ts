import type { PoolClient } from 'pg';
import { connectJob } from './db.js';

let running = false;

export async function purgeStaleDrafts(client: PoolClient): Promise<number> {
  const removed = await client.query(`DELETE FROM athletes a
    WHERE a.status='draft'
      AND NOT EXISTS (SELECT 1 FROM consent_events c WHERE c.athlete_id=a.id AND c.purpose='child_account' AND c.granted=true)
      AND (SELECT max(i.expires_at) FROM invites i WHERE i.athlete_id=a.id AND i.accepted_at IS NULL) < now()-interval '14 days'`);
  return removed.rowCount ?? 0;
}

export async function runDailyJobs(now = new Date()) {
  if (running) return;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((part) => [part.type, part.value]));
  const localDate = `${parts.year}-${parts.month}-${parts.day}`;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  if (!Number.isFinite(minutes) || minutes < 10) return;
  running = true;
  let client: PoolClient | null = null;
  try {
    client = await connectJob();
    await client.query('BEGIN');
    const claim = await client.query('UPDATE platform_settings SET daily_job_on=$1::date WHERE id=true AND (daily_job_on IS NULL OR daily_job_on < $1::date) RETURNING id', [localDate]);
    if (!claim.rowCount) {
      await client.query('ROLLBACK');
      return;
    }
    await client.query("DELETE FROM login_attempts WHERE created_at < now()-interval '2 hours'");
    await client.query("DELETE FROM sessions WHERE absolute_expires_at < now()-interval '1 day' OR idle_expires_at < now()-interval '1 day'");
    await client.query("DELETE FROM password_reset_tokens WHERE expires_at<now() OR used_at IS NOT NULL AND used_at<now()-interval '1 day'");
    await client.query("DELETE FROM email_outbox WHERE status='sent' AND created_at < now()-interval '30 days'");
    await client.query("DELETE FROM webhook_events WHERE processed_at < now()-interval '90 days'");
    await client.query('SELECT purge_expired_audit_events()');
    await purgeStaleDrafts(client);
    await client.query("WITH due AS (SELECT s.id,s.org_id,s.current_period_end,p.supply_krw,p.vat_krw FROM subscriptions s JOIN plans p ON p.code=s.plan_code WHERE s.status IN ('active','trialing') AND s.current_period_end <= (now() AT TIME ZONE 'Asia/Seoul')::date FOR UPDATE), made AS (INSERT INTO invoices(org_id,subscription_id,period_start,supply_krw,vat_krw,total_krw,due_on,status) SELECT org_id,id,current_period_end,supply_krw,vat_krw,supply_krw+vat_krw,current_period_end+14,'open' FROM due ON CONFLICT(subscription_id,period_start) DO NOTHING RETURNING subscription_id,period_start) UPDATE subscriptions s SET current_period_start=due.current_period_end,current_period_end=(due.current_period_end+interval '1 month')::date FROM due WHERE s.id=due.id");
    await client.query("UPDATE invoices SET status='overdue' WHERE status='open' AND due_on < (now() AT TIME ZONE 'Asia/Seoul')::date");
    await client.query("UPDATE subscriptions s SET status='past_due',grace_until=(i.due_on+7)::timestamp AT TIME ZONE 'Asia/Seoul' FROM invoices i WHERE i.subscription_id=s.id AND i.status='overdue' AND s.status IN ('active','trialing')");
    await client.query("UPDATE subscriptions SET status='canceled',read_until=now()+interval '30 days',export_until=now()+interval '60 days' WHERE status='past_due' AND grace_until < now()");
    await client.query("UPDATE subscriptions SET status='canceled',read_until=cancel_at+interval '30 days',export_until=cancel_at+interval '60 days' WHERE status<>'canceled' AND cancel_at IS NOT NULL AND cancel_at<=now()");
    await client.query('COMMIT');
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    throw error;
  } finally {
    if (client) client.release();
    running = false;
  }
}
