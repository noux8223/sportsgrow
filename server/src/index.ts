import 'dotenv/config';
import Fastify from 'fastify';
import argon2 from 'argon2';
import cookie from '@fastify/cookie';
import { pathToFileURL } from 'node:url';
import { jobPool, pool } from './db.js';
import { registerIdentityRoutes } from './identity.js';
import { registerProductRoutes } from './routes.js';
import { registerMediaRoutes } from './media.js';
import { registerPrivacyRoutes, runExportJobs } from './privacy.js';
import { registerReportRoutes, runEmailOutbox, runWeeklyReports } from './reports.js';
import { runDailyJobs } from './jobs.js';
import { currentSession } from './identity.js';
import { isBillingExempt } from './billing-gate.js';
import type { FastifyRequest } from 'fastify';

export async function buildApp() {
if (process.env.APP_ENV === 'pilot') {
  const required = ['LEGAL_ENTITY_NAME','LEGAL_REPRESENTATIVE','LEGAL_ADDRESS','LEGAL_BUSINESS_NUMBER','LEGAL_ECOMMERCE_REGISTRATION','SUPPORT_EMAIL','MAIL_TRANSPORT','MAIL_FROM','APP_BASE_URL','BILLING_ENFORCEMENT','MEDIA_BUCKET','EXPORT_BUCKET','ERASURE_MANIFEST_BUCKET','AWS_REGION','MEDIA_KMS_KEY_ID','EXPORT_KMS_KEY_ID','ERASURE_KMS_KEY_ID'];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) throw new Error(`pilot configuration missing: ${missing.join(', ')}`);
  if(process.env.MAIL_TRANSPORT!=='ses')throw new Error('pilot requires MAIL_TRANSPORT=ses');
  if(process.env.BILLING_ENFORCEMENT!=='true'||process.env.MEDIA_UPLOAD!=='true')throw new Error('pilot requires BILLING_ENFORCEMENT=true and MEDIA_UPLOAD=true');
  if(process.env.TRUST_PROXY!=='true')throw new Error('pilot requires TRUST_PROXY=true behind the ALB-only task security group');
  if(process.env.PUBLIC_PROFILES==='true')throw new Error('pilot does not allow public athlete profiles');
  if(!/^\d{10}$/.test(process.env.LEGAL_BUSINESS_NUMBER??''))throw new Error('pilot requires a 10-digit LEGAL_BUSINESS_NUMBER');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.MAIL_FROM??'')||!/^https:\/\//.test(process.env.APP_BASE_URL??''))throw new Error('pilot mail sender and HTTPS APP_BASE_URL are invalid');
  const demoMarkers = await pool.query(`SELECT EXISTS (
      SELECT 1 FROM users WHERE email='player@sportsgrow.kr' OR name='김하람'
        OR strpos(email,'p-haram')>0 OR strpos(name,'p-haram')>0
        OR strpos(email,'ST-1001')>0 OR strpos(name,'ST-1001')>0
        OR strpos(email,'sportsgrow.demo.v1')>0 OR strpos(name,'sportsgrow.demo.v1')>0
      UNION ALL SELECT 1 FROM athletes WHERE display_name='김하람'
      UNION ALL SELECT 1 FROM orgs WHERE strpos(name,'p-haram')>0 OR strpos(name,'ST-1001')>0 OR strpos(name,'sportsgrow.demo.v1')>0
      UNION ALL SELECT 1 FROM teams WHERE strpos(name,'p-haram')>0 OR strpos(name,'ST-1001')>0 OR strpos(name,'sportsgrow.demo.v1')>0
      UNION ALL SELECT 1 FROM notices WHERE strpos(title,'p-haram')>0 OR strpos(body,'p-haram')>0 OR strpos(title,'ST-1001')>0 OR strpos(body,'ST-1001')>0 OR strpos(title,'sportsgrow.demo.v1')>0 OR strpos(body,'sportsgrow.demo.v1')>0
      UNION ALL SELECT 1 FROM tickets WHERE strpos(title,'p-haram')>0 OR strpos(body,'p-haram')>0 OR strpos(title,'ST-1001')>0 OR strpos(body,'ST-1001')>0 OR strpos(title,'sportsgrow.demo.v1')>0 OR strpos(body,'sportsgrow.demo.v1')>0
    ) AS found`);
  const demoAccount = await pool.query("SELECT password_hash FROM users WHERE email='player@sportsgrow.kr' LIMIT 1");
  const demoPassword = demoAccount.rows[0] ? await argon2.verify(demoAccount.rows[0].password_hash, 'grow1234').catch(() => false) : false;
  if (demoMarkers.rows[0]?.found || demoPassword) throw new Error('pilot database contains demo seed markers');
}
const app = Fastify({
  logger: {
    level: 'info',
    redact: { paths: ['req.headers.cookie', 'req.headers.authorization', 'req.body', 'res.headers.set-cookie'], remove: true },
  },
  trustProxy: process.env.TRUST_PROXY === 'true' ? (_address: string, hop: number) => hop === 0 : false,
  logController: new Fastify.LogController({ disableRequestLogging: true }),
});
const requestStarted = new WeakMap<FastifyRequest, number>();
app.addHook('onRequest', async (request) => { requestStarted.set(request, performance.now()); });
app.addHook('onResponse', async (request, reply) => {
  app.log.info({
    requestId: request.id,
    route: request.routeOptions.url ?? 'unmatched',
    status: reply.statusCode,
    latencyMs: Math.round(performance.now() - (requestStarted.get(request) ?? performance.now())),
  }, 'request completed');
});
app.setErrorHandler((error, request, reply) => {
  const code = (error as Error & { code?: unknown }).code;
  const errorType = error instanceof Error ? error.name : typeof error;
  request.log.error({ errorType, errorCode: typeof code === 'string' ? code : undefined }, 'request failed');
  reply.code(500).send({ error: 'internal_error', message: '요청을 처리하지 못했습니다.' });
});
app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'not_found', message: '요청을 찾을 수 없습니다.' }));
await app.register(cookie);

app.addHook('onSend', async (request, reply, payload) => {
  if (request.url.startsWith('/api/')) {
    reply.header('Cache-Control', 'no-store');
    reply.header('Content-Security-Policy', "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'");
  }
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.APP_ENV === 'pilot') reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  return payload;
});

app.addHook('onRequest', async (request, reply) => {
  if (process.env.APP_ENV !== 'pilot' || !request.url.startsWith('/api/')) return;
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) || request.url.startsWith('/api/billing/webhooks/')) return;
  if (request.headers['x-sportsgrow-client'] !== '1') return reply.code(403).send({ error: 'csrf_rejected', message: '요청을 확인할 수 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.' });
});

app.addHook('onRequest',async(request,reply)=>{
  if(!['POST','PUT','PATCH','DELETE'].includes(request.method)||!request.url.startsWith('/api/')||request.url.startsWith('/api/auth/')||request.url.startsWith('/api/ops/'))return;
  const {rows}=await pool.query('SELECT maintenance FROM platform_settings WHERE id=true');
  if(!rows[0]?.maintenance)return;
  const session=await currentSession(request);
  if(session&&(await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1',[session.user_id])).rowCount)return;
  return reply.code(503).send({error:'maintenance',message:'서비스 점검 중입니다. 잠시 후 다시 시도해 주세요.'});
});

app.addHook('preHandler',async(request,reply)=>{
  if(process.env.BILLING_ENFORCEMENT!=='true'||!request.url.startsWith('/api/'))return;
  if(isBillingExempt(request.url))return;
  const session=await currentSession(request);if(!session)return;
  if((await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1',[session.user_id])).rowCount)return;
  let orgId:string|undefined;
  const athletePath=request.url.match(/^\/api\/athletes\/([0-9a-f-]{36})(?:\/|\?|$)/i);
  const orgPath=request.url.match(/^\/api\/orgs\/([0-9a-f-]{36})(?:\/|\?|$)/i);
  const mediaPath=request.url.match(/^\/api\/media\/([0-9a-f-]{36})(?:\/|\?|$)/i);
  if(athletePath){orgId=(await pool.query('SELECT org_id FROM athletes WHERE id=$1',[athletePath[1]])).rows[0]?.org_id;}
  else if(orgPath)orgId=orgPath[1];
  else if(mediaPath){orgId=(await pool.query('SELECT org_id FROM media_assets WHERE id=$1',[mediaPath[1]])).rows[0]?.org_id;}
  if(!orgId)return;
  const member=await pool.query('SELECT role FROM memberships WHERE id=$1 AND user_id=$2 AND org_id=$3',[session.active_membership_id,session.user_id,orgId]);
  if(!member.rowCount)return;
  const {rows}=await pool.query("SELECT status,grace_until,read_until FROM subscriptions WHERE org_id=$1 ORDER BY created_at DESC LIMIT 1",[orgId]);
  const sub=rows[0];const write=['POST','PUT','PATCH','DELETE'].includes(request.method);const invite=request.url.includes('/invites');
  const writable=sub&&(['active','trialing'].includes(sub.status)||(sub.status==='past_due'&&sub.grace_until&&new Date(sub.grace_until)>new Date()));
  const readable=sub&&(['active','trialing','past_due'].includes(sub.status)||(sub.status==='canceled'&&sub.read_until&&new Date(sub.read_until)>new Date()));
  if(invite){if(!sub||!['active','trialing'].includes(sub.status))return reply.code(409).send({error:'invite_blocked',message:'구독 상태를 확인한 뒤 초대해 주세요.'});return;}
  if(write&&!writable||!write&&!readable){const admin=member.rows[0].role==='org_admin';return reply.code(402).send({error:'subscription_inactive',message:admin?'재계약이 필요합니다':'소속 기관의 이용이 일시 중지되었습니다',status:sub?.status??'incomplete',graceUntil:sub?.grace_until??null});}
});

app.get('/api/health', async (_request, reply) => {
  try {
    await pool.query('SELECT 1');
    return { status: 'ok', database: 'ok' };
  } catch {
    reply.code(503);
    return { status: 'unavailable', database: 'unavailable' };
  }
});

await registerIdentityRoutes(app);
await registerProductRoutes(app);
await registerMediaRoutes(app);
await registerPrivacyRoutes(app);
await registerReportRoutes(app);

return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ host: process.env.HOST ?? '0.0.0.0', port });
  const maintenance = setInterval(() => { void runDailyJobs().catch((error) => app.log.error(error)); }, 60 * 1000);
  const exports = setInterval(() => { void runExportJobs().catch((error) => app.log.error(error)); }, 60 * 1000);
  const notifications = setInterval(() => { void runEmailOutbox().catch((error) => app.log.error(error)); void runWeeklyReports().catch((error) => app.log.error(error)); }, 60 * 1000);
  void runExportJobs().catch((error) => app.log.error(error));
  void runWeeklyReports().catch((error) => app.log.error(error));
  const shutdown = async () => { clearInterval(maintenance); clearInterval(exports); clearInterval(notifications); await app.close(); await pool.end(); await jobPool.end(); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
