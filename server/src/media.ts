import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import type { FastifyInstance } from 'fastify';
import { pool } from './db.js';
import { currentSession, fail } from './identity.js';
import { activeGate, athleteContext, currentPrivacyPolicySql } from './routes.js';

const bucket = process.env.MEDIA_BUCKET;
const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'ap-northeast-2', ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}) });
const MAX_BYTES = 8_388_608;
const acceptedTypes = new Set(['image/jpeg','image/png','image/webp']);

export async function reencodePhoto(bytes:Buffer):Promise<Buffer>{
  if(!bytes.length||bytes.length>MAX_BYTES)throw new Error('invalid image size');
  const image=sharp(bytes,{failOn:'error',limitInputPixels:40_000_000});
  const metadata=await image.metadata();
  if(!metadata.width||!metadata.height||!['jpeg','png','webp'].includes(metadata.format??''))throw new Error('unsupported image');
  return image.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:82,mozjpeg:true}).toBuffer();
}

export async function portraitGranted(athleteId: string, userId: string) {
  const age = await pool.query("SELECT date_part('year',age((now() AT TIME ZONE 'Asia/Seoul')::date,birth_date))::int years FROM athletes WHERE id=$1", [athleteId]);
  if (!age.rowCount) return false;
  if (age.rows[0].years >= 18) return true;
  const grant = await pool.query(`SELECT ce.granted FROM consent_events ce WHERE ce.athlete_id=$1 AND ce.guardian_user_id=$2 AND ce.purpose='portrait' AND ce.policy_version_id=${currentPrivacyPolicySql} ORDER BY ce.created_at DESC LIMIT 1`, [athleteId, userId]);
  return grant.rows[0]?.granted === true;
}

export async function registerMediaRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Body: { contentType?: string; contentLength?: number; kind?: string } }>('/api/athletes/:id/media/uploads', async (request, reply) => {
    if (process.env.MEDIA_UPLOAD !== 'true') return fail(reply, 503, 'media_disabled', '사진 업로드를 아직 사용할 수 없습니다.');
    if (!bucket) return fail(reply, 503, 'media_unconfigured', '사진 저장소가 설정되지 않았습니다.');
    const ctx = await athleteContext(request,request.params.id);
    if ('error' in ctx) return fail(reply,ctx.error==='unauthenticated'?401:404,String(ctx.error),'선수를 찾을 수 없습니다.');
    if (!(await activeGate(ctx.athlete))) return fail(reply,409,'athlete_not_active','보호자 동의가 확인될 때까지 사진을 이용할 수 없습니다.');
    const { contentType, contentLength, kind } = request.body ?? {};
    if (!acceptedTypes.has(contentType ?? '') || !Number.isInteger(contentLength) || (contentLength ?? 0)<1 || (contentLength ?? MAX_BYTES+1)>MAX_BYTES || !['hero','gallery'].includes(kind ?? '')) return fail(reply,400,'invalid_upload','JPEG, PNG, WebP 사진(8MB 이하)만 업로드할 수 있습니다.');
    if (!(await portraitGranted(ctx.athlete.id,ctx.session.user_id))) return fail(reply,409,'portrait_consent_required','사진 초상 동의를 먼저 받아 주세요.');
    const key = `incoming/${randomUUID()}`;
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: contentLength });
    const uploadUrl = await getSignedUrl(s3,command,{ expiresIn: 300, signableHeaders: new Set(['content-type','content-length']) });
    return reply.code(201).send({ uploadId:key.slice('incoming/'.length),uploadUrl,expiresIn:300 });
  });

  app.post<{ Params: { id: string }; Body: { uploadId?: string; kind?: string; caption?: string } }>('/api/athletes/:id/media/complete', async (request, reply) => {
    if (process.env.MEDIA_UPLOAD !== 'true' || !bucket) return fail(reply,503,'media_disabled','사진 업로드를 아직 사용할 수 없습니다.');
    const ctx = await athleteContext(request,request.params.id);
    if ('error' in ctx) return fail(reply,ctx.error==='unauthenticated'?401:404,String(ctx.error),'선수를 찾을 수 없습니다.');
    if (!(await activeGate(ctx.athlete))) return fail(reply,409,'athlete_not_active','보호자 동의가 확인될 때까지 사진을 이용할 수 없습니다.');
    if (!(await portraitGranted(ctx.athlete.id,ctx.session.user_id))) return fail(reply,409,'portrait_consent_required','사진 초상 동의를 먼저 받아 주세요.');
    const { uploadId,kind,caption='' } = request.body ?? {};
    if (typeof uploadId!=='string' || !/^[0-9a-f-]{36}$/i.test(uploadId) || !['hero','gallery'].includes(kind??'') || caption.length>500) return fail(reply,400,'invalid_upload','업로드 정보를 확인해 주세요.');
    const incomingKey=`incoming/${uploadId}`;
    try {
      const head=await s3.send(new HeadObjectCommand({Bucket:bucket,Key:incomingKey}));
      if (!head.ContentLength || head.ContentLength>MAX_BYTES || !acceptedTypes.has(head.ContentType??'')) { await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:incomingKey})); return fail(reply,400,'invalid_upload','사진 형식 또는 크기가 올바르지 않습니다.'); }
      const response=await s3.send(new GetObjectCommand({Bucket:bucket,Key:incomingKey}));
      const bytes=Buffer.from(await response.Body!.transformToByteArray());
      const jpeg=await reencodePhoto(bytes);
      const id=randomUUID();
      const finalKey=`org/${ctx.athlete.org_id}/athlete/${ctx.athlete.id}/${id}.jpg`;
      await s3.send(new PutObjectCommand({Bucket:bucket,Key:finalKey,Body:jpeg,ContentType:'image/jpeg',ServerSideEncryption:'aws:kms',SSEKMSKeyId:process.env.MEDIA_KMS_KEY_ID}));
      await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:incomingKey}));
      try {
        const { rows }=await pool.query('INSERT INTO media_assets(id,org_id,athlete_id,kind,bucket_key,created_by,caption) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,kind,caption,created_at',[id,ctx.athlete.org_id,ctx.athlete.id,kind,finalKey,ctx.session.user_id,caption]);
        return reply.code(201).send(rows[0]);
      } catch (error) { await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:finalKey})); throw error; }
    } catch {
      await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:incomingKey})).catch(()=>undefined);
      return fail(reply,400,'media_complete_rejected','사진을 읽거나 안전하게 변환하지 못했습니다. 다시 업로드해 주세요.');
    }
  });

  app.get<{ Params:{id:string} }>('/api/athletes/:id/media',async(request,reply)=>{
    if(!bucket)return fail(reply,503,'media_unconfigured','사진 저장소가 설정되지 않았습니다.');
    const ctx=await athleteContext(request,request.params.id);
    if('error'in ctx)return fail(reply,ctx.error==='unauthenticated'?401:404,String(ctx.error),'선수를 찾을 수 없습니다.');
    if(!(await activeGate(ctx.athlete)))return fail(reply,409,'athlete_not_active','보호자 동의가 확인될 때까지 사진을 이용할 수 없습니다.');
    const {rows}=await pool.query("SELECT id,kind,caption,created_at,bucket_key FROM media_assets WHERE org_id=$1 AND athlete_id=$2 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100",[ctx.athlete.org_id,ctx.athlete.id]);
    const media=await Promise.all(rows.map(async item=>({id:item.id,kind:item.kind,caption:item.caption,createdAt:item.created_at,url:await getSignedUrl(s3,new GetObjectCommand({Bucket:bucket,Key:item.bucket_key,ResponseContentType:'image/jpeg',ResponseContentDisposition:'inline; filename="photo.jpg"'}),{expiresIn:300})})));
    reply.header('Cache-Control','private, no-store').header('X-Content-Type-Options','nosniff');
    return {media};
  });
  app.delete<{Params:{id:string};Querystring:{ticketId?:string}}>('/api/media/:id',async(request,reply)=>{
    if(!bucket)return fail(reply,503,'media_unconfigured','사진 저장소가 설정되지 않았습니다.');
    const session=await currentSession(request);
    if(!session)return fail(reply,401,'unauthenticated','로그인이 필요합니다.');
    const {rows}=await pool.query('SELECT m.*,a.birth_date FROM media_assets m JOIN athletes a ON a.id=m.athlete_id WHERE m.id=$1 AND m.deleted_at IS NULL',[request.params.id]);
    const item=rows[0];if(!item)return fail(reply,404,'not_found','사진을 찾을 수 없습니다.');
    const membership=await pool.query('SELECT role,athlete_id FROM memberships WHERE id=$1 AND user_id=$2 AND org_id=$3',[session.active_membership_id,session.user_id,item.org_id]);
    const role=membership.rows[0]?.role;
    const staff=Boolean((await pool.query('SELECT 1 FROM platform_staff WHERE user_id=$1',[session.user_id])).rowCount);
    const linkedGuardian=role==='guardian'&&Boolean((await pool.query('SELECT 1 FROM guardian_links WHERE org_id=$1 AND guardian_user_id=$2 AND athlete_id=$3',[item.org_id,session.user_id,item.athlete_id])).rowCount);
    const athleteOwner=role==='athlete'&&membership.rows[0]?.athlete_id===item.athlete_id;
    const assignedCoach=role==='coach'&&item.created_by===session.user_id&&Boolean((await pool.query('SELECT 1 FROM coach_assignments WHERE org_id=$1 AND coach_user_id=$2 AND athlete_id=$3',[item.org_id,session.user_id,item.athlete_id])).rowCount);
    const directDelete=role==='org_admin'||linkedGuardian||athleteOwner||assignedCoach;
    let ticketId:string|undefined;
    if(staff&&!directDelete){
      ticketId=request.query.ticketId;
      if(typeof ticketId!=='string'||!/^[0-9a-f-]{36}$/i.test(ticketId))return fail(reply,404,'not_found','사진을 찾을 수 없습니다.');
      if(!(await pool.query("SELECT 1 FROM tickets WHERE id=$1 AND status='open' AND org_id=$2 AND athlete_id=$3",[ticketId,item.org_id,item.athlete_id])).rowCount)return fail(reply,404,'not_found','사진을 찾을 수 없습니다.');
    }
    if(!directDelete&&!ticketId)return fail(reply,403,'forbidden','연결된 선수의 사진을 삭제할 권한이 없습니다.');
    await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:item.bucket_key}));
    await pool.query('UPDATE media_assets SET deleted_at=now() WHERE id=$1',[item.id]);
    await pool.query("INSERT INTO audit_events(actor_user_id,org_id,athlete_id,ticket_id,action,object_type,object_id) VALUES($1,$2,$3,$4,'media.delete','media',$5)",[session.user_id,item.org_id,item.athlete_id,ticketId??null,item.id]);
    return reply.code(204).send();
  });
  app.post<{Params:{id:string};Body:{body?:string}}>('/api/media/:id/comments',async(request,reply)=>{
    const session=await currentSession(request);
    if(!session)return fail(reply,401,'unauthenticated','로그인이 필요합니다.');
    if(typeof request.body?.body!=='string'||!request.body.body.trim()||request.body.body.length>1000)return fail(reply,400,'invalid_input','댓글을 확인해 주세요.');
    const media=await pool.query('SELECT id,org_id,athlete_id FROM media_assets WHERE id=$1 AND deleted_at IS NULL',[request.params.id]);
    if(!media.rowCount)return fail(reply,404,'not_found','사진을 찾을 수 없습니다.');
    const ctx=await athleteContext(request,media.rows[0].athlete_id);
    if('error'in ctx)return fail(reply,ctx.error==='unauthenticated'?401:404,String(ctx.error),'사진을 찾을 수 없습니다.');
    if(!(await activeGate(ctx.athlete)))return fail(reply,409,'athlete_not_active','보호자 동의가 확인될 때까지 사진을 이용할 수 없습니다.');
    const {rows}=await pool.query('INSERT INTO media_comments(media_id,author_user_id,body) VALUES($1,$2,$3) RETURNING id,body,author_user_id,created_at',[request.params.id,session.user_id,request.body.body.trim()]);
    return reply.code(201).send(rows[0]);
  });
  app.delete<{Params:{id:string;commentId:string}}>('/api/media/:id/comments/:commentId',async(request,reply)=>{
    const session=await currentSession(request);
    if(!session)return fail(reply,401,'unauthenticated','로그인이 필요합니다.');
    const result=await pool.query('DELETE FROM media_comments WHERE id=$1 AND media_id=$2 AND author_user_id=$3',[request.params.commentId,request.params.id,session.user_id]);
    if(!result.rowCount)return fail(reply,404,'not_found','본인이 작성한 댓글을 찾을 수 없습니다.');
    return reply.code(204).send();
  });
}
