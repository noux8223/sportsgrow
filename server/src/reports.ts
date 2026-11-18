import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { FastifyInstance } from 'fastify';
import { connectJob, jobQuery, pool } from './db.js';
import { activeGate, athleteContext } from './routes.js';

const ses=new SESv2Client({region:process.env.AWS_REGION??'ap-northeast-2'});
const escapeHtml=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function mailContent(template:string,payload:Record<string,unknown>){
  const base=process.env.APP_BASE_URL??'https://sportsgrow.example';
  if(template==='password_reset'){
    const link=`${base}/reset-password.html?token=${encodeURIComponent(String(payload.token??''))}`;
    return {subject:'Sports Grow 비밀번호 재설정',text:`아래 링크에서 비밀번호를 재설정해 주세요. 1시간 동안 유효합니다.\n${link}`,html:`<p>아래 링크에서 비밀번호를 재설정해 주세요. 1시간 동안 유효합니다.</p><p><a href="${escapeHtml(link)}">비밀번호 재설정</a></p>`};
  }
  if(template==='organization_invite'){
    const link=`${base}/accept-invite.html?token=${encodeURIComponent(String(payload.token??''))}`;
    return {subject:'Sports Grow 기관 초대',text:`기관 초대를 수락해 주세요. 7일 동안 유효합니다.\n${link}`,html:`<p>기관 초대를 수락해 주세요. 7일 동안 유효합니다.</p><p><a href="${escapeHtml(link)}">초대 수락</a></p>`};
  }
  const report={...payload};delete report.athleteId;delete report.guardianUserId;
  const data=JSON.stringify(report,null,2);
  return {subject:'Sports Grow 주간 성장 리포트',text:data,html:`<h1>주간 성장 리포트</h1><pre>${escapeHtml(data)}</pre>`};
}

export async function runEmailOutbox(){
  if(process.env.MAIL_TRANSPORT!=='ses'||!process.env.MAIL_FROM)return;
  await jobQuery("UPDATE email_outbox SET status='retry' WHERE status='sending' AND created_at<now()-interval '10 minutes'");
  for(let i=0;i<10;i++){
    const client=await connectJob();let row:any;
    try{await client.query('BEGIN');const result=await client.query("SELECT * FROM email_outbox WHERE status IN ('queued','retry') AND attempts<5 ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED");row=result.rows[0];if(!row){await client.query('COMMIT');break;}await client.query("UPDATE email_outbox SET status='sending',attempts=attempts+1 WHERE id=$1",[row.id]);await client.query('COMMIT');}
    catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    try{
      if(row.template==='weekly_report'&&!(await hasCurrentReportConsent(String(row.payload?.athleteId??''),String(row.payload?.guardianUserId??''),jobQuery))){
        await jobQuery("UPDATE email_outbox SET status='failed',payload='{}'::jsonb,last_error='report consent revoked or guardian link removed' WHERE id=$1",[row.id]);
        continue;
      }
      const content=mailContent(row.template,row.payload??{});
      await ses.send(new SendEmailCommand({FromEmailAddress:process.env.MAIL_FROM,Destination:{ToAddresses:[row.to_email]},Content:{Simple:{Subject:{Data:content.subject,Charset:'UTF-8'},Body:{Text:{Data:content.text,Charset:'UTF-8'},Html:{Data:content.html,Charset:'UTF-8'}}}}}));
      await jobQuery("UPDATE email_outbox SET status='sent',last_error=NULL,payload=CASE WHEN template IN ('password_reset','organization_invite') THEN '{}'::jsonb ELSE payload END WHERE id=$1",[row.id]);
    }catch(error){const msg=error instanceof Error?error.message:'mail delivery failed';await jobQuery("UPDATE email_outbox SET status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'retry' END,last_error=$2 WHERE id=$1",[row.id,msg.slice(0,500)]);}
  }
  await jobQuery("DELETE FROM email_outbox WHERE status='sent' AND created_at<now()-interval '30 days'");
}

type SqlQuery = (text: string, params?: unknown[]) => Promise<{ rows: Array<{ allowed?: boolean }> }>;

export async function hasCurrentReportConsent(athleteId:string,guardianUserId:string,query:SqlQuery=pool.query.bind(pool)){
  const result=await query("SELECT EXISTS(SELECT 1 FROM guardian_links gl JOIN athletes a ON a.id=gl.athlete_id AND a.status='active' JOIN LATERAL(SELECT c.granted FROM consent_events c JOIN policy_versions p ON p.id=c.policy_version_id WHERE c.athlete_id=gl.athlete_id AND c.guardian_user_id=gl.guardian_user_id AND c.purpose='report_email' AND p.kind='privacy' ORDER BY c.created_at DESC LIMIT 1) latest ON latest.granted=true WHERE gl.athlete_id=$1 AND gl.guardian_user_id=$2) allowed",[athleteId,guardianUserId]);
  return result.rows[0]?.allowed===true;
}

export async function runWeeklyReports(now = new Date()){
  const gate=await jobQuery("SELECT ($1::timestamptz AT TIME ZONE 'Asia/Seoul') < date_trunc('week', $1::timestamptz AT TIME ZONE 'Asia/Seoul') + time '07:00' AS before_window, (date_trunc('week', $1::timestamptz AT TIME ZONE 'Asia/Seoul')::date - 7)::text AS week_start",[now]);
  if(gate.rows[0].before_window)return;
  const date=String(gate.rows[0].week_start).slice(0,10);
  const athletes=await jobQuery("SELECT a.id,a.org_id,a.display_name FROM athletes a WHERE a.status='active' AND EXISTS(SELECT 1 FROM LATERAL(SELECT c.granted FROM consent_events c JOIN policy_versions p ON p.id=c.policy_version_id WHERE c.athlete_id=a.id AND c.purpose='report_email' AND p.kind='privacy' ORDER BY c.created_at DESC LIMIT 1) latest WHERE latest.granted)");
  for(const athlete of athletes.rows){
    if((await jobQuery('SELECT 1 FROM weekly_reports WHERE athlete_id=$1 AND week_start=$2',[athlete.id,date])).rowCount)continue;
    const consent=await jobQuery("SELECT c.granted FROM consent_events c JOIN policy_versions p ON p.id=c.policy_version_id WHERE c.athlete_id=$1 AND c.purpose='report_email' AND p.kind='privacy' ORDER BY c.created_at DESC LIMIT 1",[athlete.id]);
    if(consent.rows[0]?.granted!==true)continue;
    const values=await jobQuery("SELECT coalesce((SELECT sum(minutes) FROM training_sessions WHERE org_id=$1 AND athlete_id=$2 AND trained_on >= $3::date AND trained_on < $3::date+7),0)::int training_minutes,coalesce((SELECT count(DISTINCT trained_on) FROM training_sessions WHERE org_id=$1 AND athlete_id=$2 AND trained_on >= $3::date AND trained_on < $3::date+7),0)::int training_days,coalesce((SELECT count(*) FROM game_appearances WHERE org_id=$1 AND athlete_id=$2 AND played_on >= $3::date AND played_on < $3::date+7),0)::int games,coalesce((SELECT sum(hits) FROM game_appearances WHERE org_id=$1 AND athlete_id=$2 AND played_on >= $3::date AND played_on < $3::date+7),0)::int hits,coalesce((SELECT sum(at_bats) FROM game_appearances WHERE org_id=$1 AND athlete_id=$2 AND played_on >= $3::date AND played_on < $3::date+7),0)::int at_bats",[athlete.org_id,athlete.id,date]);
    const notes=await jobQuery('SELECT body,created_at FROM coach_notes WHERE org_id=$1 AND athlete_id=$2 AND visible_to_guardian=true AND created_at >= $3::date AND created_at < $3::date+7',[athlete.org_id,athlete.id,date]);
    const requests=await jobQuery('SELECT status,count(*)::int count FROM coach_requests WHERE org_id=$1 AND athlete_id=$2 AND created_at >= $3::date AND created_at < $3::date+7 GROUP BY status',[athlete.org_id,athlete.id,date]);
    const profile=await jobQuery("SELECT profile_visibility,training_visibility,games_visibility,goals_visibility FROM athlete_profiles WHERE athlete_id=$1",[athlete.id]);
    const visibility=profile.rows[0]??{};
    const goals=visibility.goals_visibility==='team'?(await jobQuery('SELECT title,metric,target_numeric FROM goals WHERE org_id=$1 AND athlete_id=$2',[athlete.org_id,athlete.id])).rows:[];
    const body:Record<string,unknown>={weekStart:date,notes:notes.rows,requests:requests.rows};
    if(visibility.profile_visibility==='team')body.athleteName=athlete.display_name;
    if(visibility.training_visibility==='team'){
      body.trainingMinutes=values.rows[0].training_minutes;
      body.trainingDays=values.rows[0].training_days;
    }
    if(visibility.games_visibility==='team'){
      body.games=values.rows[0].games;
      body.hits=values.rows[0].hits;
      body.atBats=values.rows[0].at_bats;
      body.weekBattingAverage=values.rows[0].at_bats?Number((values.rows[0].hits/values.rows[0].at_bats).toFixed(3)):null;
    }
    if(goals.length)body.goals=goals;
    if(visibility.profile_visibility==='team')body.photoCount=(await jobQuery("SELECT count(*)::int n FROM media_assets WHERE org_id=$1 AND athlete_id=$2 AND deleted_at IS NULL",[athlete.org_id,athlete.id])).rows[0].n;
    await jobQuery('INSERT INTO weekly_reports(org_id,athlete_id,week_start,body_json) VALUES($1,$2,$3,$4) ON CONFLICT(athlete_id,week_start) DO UPDATE SET body_json=EXCLUDED.body_json',[athlete.org_id,athlete.id,date,JSON.stringify(body)]);
    const guardians=await jobQuery("SELECT u.id,u.email FROM guardian_links gl JOIN users u ON u.id=gl.guardian_user_id JOIN LATERAL(SELECT c.granted FROM consent_events c JOIN policy_versions p ON p.id=c.policy_version_id WHERE c.athlete_id=gl.athlete_id AND c.guardian_user_id=gl.guardian_user_id AND c.purpose='report_email' AND p.kind='privacy' ORDER BY c.created_at DESC LIMIT 1) consent ON consent.granted=true WHERE gl.org_id=$1 AND gl.athlete_id=$2",[athlete.org_id,athlete.id]);
    for(const guardian of guardians.rows)await jobQuery("INSERT INTO email_outbox(idempotency_key,to_email,template,payload,status) VALUES($1,$2,'weekly_report',$3,'queued') ON CONFLICT(idempotency_key) DO NOTHING",[`weekly-report:${athlete.id}:${date}:${guardian.id}`,guardian.email,JSON.stringify({...body,athleteId:athlete.id,guardianUserId:guardian.id})]);
  }
}

export async function registerReportRoutes(app:FastifyInstance){
  app.get<{Params:{id:string}}>('/api/athletes/:id/reports/weekly',async(request,reply)=>{
    const ctx=await athleteContext(request,request.params.id);
    if('error'in ctx)return reply.code(ctx.error==='unauthenticated'?401:404).send({error:ctx.error,message:'선수를 찾을 수 없습니다.'});
    if(!['guardian','org_admin','athlete'].includes(ctx.role))return reply.code(403).send({error:'forbidden',message:'리포트를 볼 권한이 없습니다.'});
    if(!(await activeGate(ctx.athlete)))return reply.code(409).send({error:'athlete_not_active',message:'보호자 동의가 확인될 때까지 리포트를 이용할 수 없습니다.'});
    const {rows}=await pool.query('SELECT id,week_start,body_json FROM weekly_reports WHERE org_id=$1 AND athlete_id=$2 ORDER BY week_start DESC LIMIT 12',[ctx.athlete.org_id,ctx.athlete.id]);
    if(ctx.role!=='org_admin'&&ctx.role!=='athlete'){
      const visibility=await pool.query('SELECT profile_visibility,training_visibility,games_visibility,goals_visibility FROM athlete_profiles WHERE athlete_id=$1',[ctx.athlete.id]);
      const current=visibility.rows[0]??{};
      for(const report of rows){
        if(current.profile_visibility!=='team'){delete report.body_json.athleteName;delete report.body_json.photoCount;}
        if(current.training_visibility!=='team'){delete report.body_json.trainingMinutes;delete report.body_json.trainingDays;}
        if(current.games_visibility!=='team'){delete report.body_json.games;delete report.body_json.hits;delete report.body_json.atBats;delete report.body_json.weekBattingAverage;}
        if(current.goals_visibility!=='team')delete report.body_json.goals;
      }
    }
    return {reports:rows};
  });
}
