import { DeleteObjectCommand, PutObjectCommand, S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import yazl from 'yazl';
import type { FastifyInstance } from 'fastify';
import { pool } from './db.js';
import { currentSession, fail } from './identity.js';
import { athleteContext } from './routes.js';

const bucket = process.env.EXPORT_BUCKET;
const mediaBucket = process.env.MEDIA_BUCKET;
const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'ap-northeast-2', ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}) });

async function makeArchive(athleteId: string, orgId: string) {
  const queries: Record<string,string> = {
    athlete: 'SELECT id,display_name,birth_date,status,created_at FROM athletes WHERE id=$1 AND org_id=$2',
    profile: 'SELECT profile_visibility,training_visibility,games_visibility,goals_visibility FROM athlete_profiles WHERE athlete_id=$1 AND org_id=$2',
    training: 'SELECT trained_on,type,minutes,intensity,memo,created_at FROM training_sessions WHERE athlete_id=$1 AND org_id=$2 ORDER BY trained_on',
    games: 'SELECT played_on,competition,opponent,result,score,performance,at_bats,hits,walks,created_at FROM game_appearances WHERE athlete_id=$1 AND org_id=$2 ORDER BY played_on',
    goals: 'SELECT title,metric,target_numeric,due_on FROM goals WHERE athlete_id=$1 AND org_id=$2',
    notes: 'SELECT body,visible_to_guardian,created_at FROM coach_notes WHERE athlete_id=$1 AND org_id=$2',
    cheers: 'SELECT body,created_at FROM cheers WHERE athlete_id=$1 AND org_id=$2',
    requests: 'SELECT body,status,created_at FROM coach_requests WHERE athlete_id=$1 AND org_id=$2',
    consents: 'SELECT purpose,granted,created_at,policy_version_id FROM consent_events WHERE athlete_id=$1 AND org_id=$2',
  };
  const data: Record<string,unknown> = {};
  for(const [key,sql] of Object.entries(queries)) data[key]=(await pool.query(sql,[athleteId,orgId])).rows;
  const media=(await pool.query("SELECT id,kind,caption,created_at,bucket_key FROM media_assets WHERE org_id=$1 AND athlete_id=$2 AND deleted_at IS NULL ORDER BY created_at",[orgId,athleteId])).rows;
  data.media=media.map(({bucket_key:_bucketKey,...item})=>item);
  return new Promise<Buffer>((resolve,reject)=>{
    const zip=new yazl.ZipFile();const chunks:Buffer[]=[];
    zip.outputStream.on('data',(chunk:Buffer)=>chunks.push(chunk));
    zip.outputStream.on('error',reject);
    zip.outputStream.on('end',()=>resolve(Buffer.concat(chunks)));
    void (async()=>{
      zip.addBuffer(Buffer.from(JSON.stringify({generatedAt:new Date().toISOString(),data},null,2)),'sportsgrow-export.json');
      for(const item of media){
        if(!mediaBucket)throw new Error('media bucket required for photo export');
        const object=await s3.send(new GetObjectCommand({Bucket:mediaBucket,Key:item.bucket_key}));
        const bytes=Buffer.from(await object.Body!.transformToByteArray());
        zip.addBuffer(bytes,`photos/${item.id}.jpg`);
      }
      zip.end();
    })().catch(reject);
  });
}

export async function runExportJobs() {
  if(!bucket)return;
  for(let attempt=0;attempt<5;attempt++){
    const claimed=await pool.query(`WITH candidate AS (
      SELECT id FROM export_jobs WHERE status='queued' AND expires_at>now()
      ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED
    ), claim AS (
      SELECT id,gen_random_uuid() token FROM candidate
    )
    UPDATE export_jobs e SET status='processing',processing_token=claim.token,
      processing_started_at=now(),bucket_key='exports/'||e.org_id||'/'||e.id||'/'||claim.token||'.zip'
    FROM claim WHERE e.id=claim.id
    RETURNING e.id,e.org_id,e.athlete_id,e.processing_token,e.bucket_key`);
    const job=claimed.rows[0];
    if(!job)break;
    let objectMayExist=false;
    let ready=false;
    try{
      const athlete=job.athlete_id?await pool.query('SELECT status FROM athletes WHERE id=$1 AND org_id=$2',[job.athlete_id,job.org_id]):{rows:[],rowCount:0};
      if(!athlete.rowCount||['erasure_pending','erased'].includes(athlete.rows[0].status)){
        await pool.query("UPDATE export_jobs SET status='expired',processing_token=NULL,processing_started_at=NULL WHERE id=$1 AND status='processing' AND processing_token=$2",[job.id,job.processing_token]);
        continue;
      }
      const archive=await makeArchive(job.athlete_id,job.org_id);
      await s3.send(new PutObjectCommand({Bucket:bucket,Key:job.bucket_key,Body:archive,ContentType:'application/zip',ServerSideEncryption:'aws:kms',SSEKMSKeyId:process.env.EXPORT_KMS_KEY_ID}));
      objectMayExist=true;
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        const currentAthlete=await client.query('SELECT status FROM athletes WHERE id=$1 AND org_id=$2 FOR UPDATE',[job.athlete_id,job.org_id]);
        const currentJob=await client.query("SELECT id FROM export_jobs WHERE id=$1 AND status='processing' AND processing_token=$2 FOR UPDATE",[job.id,job.processing_token]);
        if(currentJob.rowCount&&currentAthlete.rowCount&&!['erasure_pending','erased'].includes(currentAthlete.rows[0].status)){
          await client.query("UPDATE export_jobs SET status='ready',processing_token=NULL,processing_started_at=NULL WHERE id=$1 AND processing_token=$2",[job.id,job.processing_token]);
          ready=true;
        }else if(currentJob.rowCount){
          await client.query("UPDATE export_jobs SET status='expired',processing_token=NULL,processing_started_at=NULL WHERE id=$1 AND processing_token=$2",[job.id,job.processing_token]);
        }
        await client.query('COMMIT');
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    }catch{
      await pool.query("UPDATE export_jobs SET status='failed',processing_token=NULL,processing_started_at=NULL WHERE id=$1 AND status='processing' AND processing_token=$2",[job.id,job.processing_token]);
    }
    if(!ready&&objectMayExist){
      try{
        await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:job.bucket_key}));
        await pool.query("UPDATE export_jobs SET bucket_key=NULL WHERE id=$1 AND status IN ('expired','failed') AND bucket_key=$2",[job.id,job.bucket_key]);
      }catch{/* Retain the private key so the cleanup pass can retry. */}
    }
  }
  await pool.query("UPDATE export_jobs SET status='failed',processing_token=NULL,processing_started_at=NULL WHERE status='processing' AND processing_started_at<now()-interval '10 minutes'");
  await pool.query("UPDATE export_jobs SET status='expired',bucket_key=NULL WHERE status IN ('queued','failed') AND expires_at<=now() AND bucket_key IS NULL");
  const expired=await pool.query("SELECT id,bucket_key,status FROM export_jobs WHERE bucket_key IS NOT NULL AND (status IN ('expired','failed') OR status='ready' AND expires_at<=now()) ORDER BY expires_at LIMIT 100");
  for(const job of expired.rows){
    try{await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:job.bucket_key}));}
    catch{continue;}
    await pool.query("UPDATE export_jobs SET status=CASE WHEN status='ready' OR expires_at<=now() THEN 'expired' ELSE status END,bucket_key=NULL WHERE id=$1 AND bucket_key=$2 AND status=$3",[job.id,job.bucket_key,job.status]);
  }
}

export async function registerPrivacyRoutes(app:FastifyInstance){
  app.post<{Body:{athleteId?:string;ticketId?:string}}>('/api/me/export',async(request,reply)=>{
    const session=await currentSession(request);if(!session)return fail(reply,401,'unauthenticated','로그인이 필요합니다.');
    const {athleteId,ticketId}=request.body??{};
    if(typeof athleteId!=='string'||!/^[-0-9a-f]{36}$/i.test(athleteId))return fail(reply,400,'invalid_input','내보낼 선수 정보를 선택해 주세요.');
    const ctx=await athleteContext(request,athleteId,ticketId);
    if('error'in ctx)return fail(reply,ctx.error==='unauthenticated'?401:404,String(ctx.error),'선수를 찾을 수 없습니다.');
    if(!['guardian','org_admin','athlete','platform_staff'].includes(ctx.role))return fail(reply,403,'forbidden','데이터를 내보낼 권한이 없습니다.');
    if(['erasure_pending','erased'].includes(ctx.athlete.status))return fail(reply,409,'athlete_not_active','파기 중이거나 파기된 선수의 데이터를 내보낼 수 없습니다.');
    if(ctx.role==='platform_staff'&&!ticketId)return fail(reply,404,'not_found','요청을 찾을 수 없습니다.');
    if(!bucket)return fail(reply,503,'export_unconfigured','데이터 내보내기가 아직 설정되지 않았습니다.');
    const {rows}=await pool.query("INSERT INTO export_jobs(requester_user_id,org_id,athlete_id,ticket_id,status,expires_at) VALUES($1,$2,$3,$4,'queued',now()+interval '24 hours') RETURNING id,status,expires_at",[session.user_id,ctx.athlete.org_id,ctx.athlete.id,ticketId??null]);
    return reply.code(202).send(rows[0]);
  });
  app.get<{Params:{id:string}}>('/api/me/exports/:id',async(request,reply)=>{
    const session=await currentSession(request);if(!session)return fail(reply,401,'unauthenticated','로그인이 필요합니다.');
    const {rows}=await pool.query('SELECT id,status,bucket_key,expires_at,ticket_id FROM export_jobs WHERE id=$1 AND requester_user_id=$2',[request.params.id,session.user_id]);
    if(!rows[0])return fail(reply,404,'not_found','내보내기 요청을 찾을 수 없습니다.');
    if(rows[0].ticket_id&&!(await pool.query("SELECT 1 FROM tickets WHERE id=$1 AND status='open'",[rows[0].ticket_id])).rowCount)return fail(reply,404,'not_found','내보내기 요청을 찾을 수 없습니다.');
    if(rows[0].expires_at<=new Date()&&rows[0].status==='ready'){await pool.query("UPDATE export_jobs SET status='expired' WHERE id=$1 AND status='ready'",[rows[0].id]);return {id:rows[0].id,status:'expired'};}
    if(rows[0].status!=='ready'||!bucket)return {id:rows[0].id,status:rows[0].status,expiresAt:rows[0].expires_at};
    const downloadUrl=await getSignedUrl(s3,new GetObjectCommand({Bucket:bucket,Key:rows[0].bucket_key,ResponseContentType:'application/zip',ResponseContentDisposition:'attachment; filename="sportsgrow-export.zip"'}),{expiresIn:600});
    return {id:rows[0].id,status:'ready',downloadUrl,downloadExpiresIn:600};
  });
  app.post<{Params:{id:string}}>('/api/athletes/:id/erasure',async(request,reply)=>{
    const manifestBucket=process.env.ERASURE_MANIFEST_BUCKET;
    const ctx=await athleteContext(request,request.params.id);
    if('error'in ctx)return fail(reply,ctx.error==='unauthenticated'?401:404,String(ctx.error),'선수를 찾을 수 없습니다.');
    if(!['guardian','org_admin','athlete'].includes(ctx.role))return fail(reply,403,'forbidden','선수 정보 삭제를 요청할 수 없습니다.');
    if(ctx.athlete.status==='erased')return fail(reply,409,'already_erased','선수 정보는 이미 파기되었습니다.');
    if(!manifestBucket||!bucket||!mediaBucket)return fail(reply,503,'erasure_unconfigured','안전한 삭제 보관소가 설정되지 않았습니다.');

    const manifestKey='erasure-manifests/'+ctx.athlete.org_id+'/'+ctx.athlete.id+'/erased.json';
    const erasedAt=new Date().toISOString();
    const stageClient=await pool.connect();
    try{
      await stageClient.query('BEGIN');
      const locked=await stageClient.query("SELECT status FROM athletes WHERE id=$1 AND org_id=$2 FOR UPDATE",[ctx.athlete.id,ctx.athlete.org_id]);
      if(!locked.rowCount){await stageClient.query('ROLLBACK');return fail(reply,404,'not_found','선수를 찾을 수 없습니다.');}
      if(locked.rows[0].status==='erased'){await stageClient.query('ROLLBACK');return fail(reply,409,'already_erased','선수 정보는 이미 파기되었습니다.');}
      await stageClient.query("UPDATE athletes SET status='erasure_pending' WHERE id=$1 AND org_id=$2",[ctx.athlete.id,ctx.athlete.org_id]);
      await stageClient.query("UPDATE export_jobs SET status='expired',bucket_key=NULL WHERE athlete_id=$1 AND status='queued'",[ctx.athlete.id]);
      await stageClient.query("UPDATE export_jobs SET status='expired',processing_token=NULL,processing_started_at=NULL WHERE athlete_id=$1 AND status='ready'",[ctx.athlete.id]);
      await stageClient.query("UPDATE email_outbox SET status='failed',payload='{}'::jsonb,last_error='athlete erasure pending' WHERE template='weekly_report' AND payload->>'athleteId'=$1",[ctx.athlete.id]);
      await stageClient.query('DELETE FROM invites WHERE athlete_id=$1',[ctx.athlete.id]);
      await stageClient.query('COMMIT');
    }catch(error){await stageClient.query('ROLLBACK');throw error;}finally{stageClient.release();}

    const stagedMedia=await pool.query('SELECT bucket_key FROM media_assets WHERE org_id=$1 AND athlete_id=$2',[ctx.athlete.org_id,ctx.athlete.id]);
    const stagedExports=await pool.query("SELECT bucket_key FROM export_jobs WHERE athlete_id=$1 AND bucket_key IS NOT NULL",[ctx.athlete.id]);
    const stagedMediaKeys=[...new Set(stagedMedia.rows.map((asset)=>asset.bucket_key as string))];
    const stagedExportKeys=[...new Set(stagedExports.rows.map((job)=>job.bucket_key as string))];
    await s3.send(new PutObjectCommand({Bucket:manifestBucket,Key:manifestKey,Body:JSON.stringify({athleteId:ctx.athlete.id,orgId:ctx.athlete.org_id,erasedAt,mediaKeys:stagedMediaKeys,exportKeys:stagedExportKeys}),ContentType:'application/json',ServerSideEncryption:'aws:kms',SSEKMSKeyId:process.env.ERASURE_KMS_KEY_ID}));
    for(const key of stagedMediaKeys)await s3.send(new DeleteObjectCommand({Bucket:mediaBucket,Key:key}));
    for(const key of stagedExportKeys)await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:key}));

    const deadline=Date.now()+40_000;
    let pendingExports=1;
    while(Date.now()<deadline&&pendingExports){
      const pending=await pool.query("SELECT 1 FROM export_jobs WHERE athlete_id=$1 AND status='processing' LIMIT 1",[ctx.athlete.id]);
      pendingExports=pending.rowCount??0;
      if(pendingExports)await new Promise((resolve)=>setTimeout(resolve,200));
    }
    if(pendingExports)return fail(reply,503,'erasure_in_progress','선수 정보 파기를 진행 중입니다. 잠시 후 다시 확인해 주세요.');

    const allMedia=await pool.query('SELECT bucket_key FROM media_assets WHERE org_id=$1 AND athlete_id=$2',[ctx.athlete.org_id,ctx.athlete.id]);
    const allExports=await pool.query("SELECT bucket_key FROM export_jobs WHERE athlete_id=$1 AND bucket_key IS NOT NULL",[ctx.athlete.id]);
    const mediaKeys=[...new Set(allMedia.rows.map((asset)=>asset.bucket_key as string))];
    const exportKeys=[...new Set(allExports.rows.map((job)=>job.bucket_key as string))];
    await s3.send(new PutObjectCommand({Bucket:manifestBucket,Key:manifestKey,Body:JSON.stringify({athleteId:ctx.athlete.id,orgId:ctx.athlete.org_id,erasedAt,mediaKeys,exportKeys}),ContentType:'application/json',ServerSideEncryption:'aws:kms',SSEKMSKeyId:process.env.ERASURE_KMS_KEY_ID}));
    for(const key of mediaKeys)await s3.send(new DeleteObjectCommand({Bucket:mediaBucket,Key:key}));
    for(const key of exportKeys)await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:key}));

    const eraseClient=await pool.connect();
    try{
      await eraseClient.query('BEGIN');
      const locked=await eraseClient.query("SELECT status FROM athletes WHERE id=$1 AND org_id=$2 FOR UPDATE",[ctx.athlete.id,ctx.athlete.org_id]);
      if(!locked.rowCount){await eraseClient.query('ROLLBACK');return fail(reply,404,'not_found','선수를 찾을 수 없습니다.');}
      if(locked.rows[0].status==='erased'){await eraseClient.query('ROLLBACK');return fail(reply,409,'already_erased','선수 정보는 이미 파기되었습니다.');}
      const remaining=await eraseClient.query("SELECT 1 FROM export_jobs WHERE athlete_id=$1 AND status='processing' LIMIT 1",[ctx.athlete.id]);
      if(remaining.rowCount){await eraseClient.query('ROLLBACK');return fail(reply,503,'erasure_in_progress','선수 정보 파기를 진행 중입니다. 잠시 후 다시 확인해 주세요.');}
      await eraseClient.query('UPDATE consent_events SET ip=NULL,user_agent=NULL WHERE athlete_id=$1',[ctx.athlete.id]);
      await eraseClient.query("UPDATE email_outbox SET status='failed',payload='{}'::jsonb,last_error='athlete erased' WHERE template='weekly_report' AND payload->>'athleteId'=$1",[ctx.athlete.id]);
      for(const table of ['training_sessions','game_appearances','goals','coach_notes','cheers','coach_requests','weekly_reports','media_comments']){
        const query=table==='media_comments'?'DELETE FROM media_comments WHERE media_id IN(SELECT id FROM media_assets WHERE athlete_id=$1)':'DELETE FROM '+table+' WHERE athlete_id=$1';
        await eraseClient.query(query,[ctx.athlete.id]);
      }
      await eraseClient.query('DELETE FROM media_assets WHERE athlete_id=$1',[ctx.athlete.id]);
      await eraseClient.query("UPDATE export_jobs SET status='expired',bucket_key=NULL,processing_token=NULL,processing_started_at=NULL WHERE athlete_id=$1",[ctx.athlete.id]);
      await eraseClient.query('DELETE FROM athlete_profiles WHERE athlete_id=$1',[ctx.athlete.id]);
      await eraseClient.query('DELETE FROM guardian_links WHERE athlete_id=$1',[ctx.athlete.id]);
      await eraseClient.query('DELETE FROM coach_assignments WHERE athlete_id=$1',[ctx.athlete.id]);
      await eraseClient.query('DELETE FROM invites WHERE athlete_id=$1',[ctx.athlete.id]);
      await eraseClient.query('DELETE FROM memberships WHERE athlete_id=$1',[ctx.athlete.id]);
      await eraseClient.query("UPDATE athletes SET status='erased',display_name='삭제된 선수',birth_date='1900-01-01',position=NULL,grade_label=NULL,bats=NULL WHERE id=$1",[ctx.athlete.id]);
      await eraseClient.query("INSERT INTO audit_events(actor_user_id,org_id,athlete_id,action,object_type,object_id) VALUES($1::uuid,$2::uuid,$3::uuid,'athlete.erase','athlete',$3::uuid::text)",[ctx.session.user_id,ctx.athlete.org_id,ctx.athlete.id]);
      await eraseClient.query('COMMIT');
    }catch(error){await eraseClient.query('ROLLBACK');throw error;}finally{eraseClient.release();}
    return {id:ctx.athlete.id,status:'erased'};
  });
}
