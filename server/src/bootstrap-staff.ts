import 'dotenv/config';
import { jobPool, pool } from './db.js';
import { digestPassword } from './identity.js';

const email=process.env.BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password=process.env.BOOTSTRAP_PASSWORD;
const name=process.env.BOOTSTRAP_NAME?.trim();
if(!email||!password||!name||password.length<10||password.length>128){
  throw new Error('Set BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD (10–128 chars), and BOOTSTRAP_NAME before running this one-time command.');
}
const client=await pool.connect();
try{
  await client.query('BEGIN');
  const exists=await client.query('SELECT 1 FROM platform_staff LIMIT 1');
  if(exists.rowCount)throw new Error('Platform staff already exists; bootstrap is one-time only.');
  const user=await client.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id',[email,await digestPassword(password),name]);
  await client.query('INSERT INTO platform_staff(user_id) VALUES($1)',[user.rows[0].id]);
  await client.query("INSERT INTO audit_events(actor_user_id,action,object_type,object_id) VALUES($1,'platform_staff.bootstrap','user',$1::uuid::text)",[user.rows[0].id]);
  await client.query('COMMIT');
  process.stdout.write(`Created initial platform staff account: ${email}\n`);
}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();await jobPool.end();}
