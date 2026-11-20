'use strict';
/* SBC customer-request links: owner/assigned manager creates; customer submits once.
 * All data live in tenant-scoped MySQL. No unsolicited messages, payments, fulfillment,
 * design publication or remote image fetch occur here. Links are bearer capabilities.
 */
const fs=require('node:fs'),path=require('node:path');
const {randomBytes}=require('node:crypto');
const CONTRACT=require('../enterprise/sbc-customer-design-brief-contract.cjs');
const SCHEMA='sbc_customer_design_briefs_v1';
const bad=(res,status,code)=>res.status(status).json({ok:false,code});
const clamp=(x,n)=>String(x??'').trim().slice(0,n);
function safeError(res,e){
 const raw=String(e?.code||e?.message||'DESIGN_REQUEST_UNAVAILABLE');
 // Never create a production table at startup or while handling a customer request.
 // Report a missing additive migration without exposing SQL, tenant details or secrets.
 const code=['ER_NO_SUCH_TABLE','ER_BAD_TABLE_ERROR'].includes(raw)?'DESIGN_REQUEST_SCHEMA_NOT_READY':
  ['ECONNREFUSED','ETIMEDOUT','PROTOCOL_CONNECTION_LOST','ER_CON_COUNT_ERROR'].includes(raw)?'MYSQL_UNAVAILABLE':raw;
 const status=Number(e?.status)||(/FORBIDDEN|TENANT|NOT_ASSIGNED|OWNER_REQUIRED/.test(code)?403:/NOT_FOUND/.test(code)?404:/EXPIRED|REVOKED|ALREADY_SUBMITTED|ALREADY_REVIEWED/.test(code)?410:/INVALID|REQUIRED|TOO_LARGE|TOO_MANY|CONFIRMATION/.test(code)?422:503);
 return bad(res,status,code.replace(/[^A-Z0-9_]/g,'').slice(0,120)||'DESIGN_REQUEST_UNAVAILABLE');
}
function writable(ctx){if(!ctx?.mysqlPool||typeof ctx.mysqlPool.query!=='function')throw Object.assign(Error('MYSQL_UNAVAILABLE'),{status:503});
 if(typeof ctx.recoveryRequired!=='function'||ctx.recoveryRequired()!==false)throw Object.assign(Error('MYSQL_RECOVERY_WRITE_BLOCKED'),{status:423});}
function dbReady(ctx){if(!ctx?.mysqlPool||typeof ctx.mysqlPool.query!=='function')throw Object.assign(Error('MYSQL_UNAVAILABLE'),{status:503});}
function customerId(x){const id=clamp(x,120);if(!id||!/^[a-zA-Z0-9_.:-]+$/.test(id))throw Object.assign(Error('INVALID_CUSTOMER_ID'),{status:422});return id}
function safeRole(req){return req?.user?.active===false?'':String(req?.user?.role||'');}
async function customerAccess(ctx,tenant,req,id){
 const role=safeRole(req);
 if(!['owner','account_manager','caller'].includes(role))throw Object.assign(Error('DESIGN_REQUEST_FORBIDDEN'),{status:403});
 const [rows]=await ctx.mysqlPool.query('SELECT id,business_name,assigned_to,status FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1',[tenant,id]);
 if(rows.length!==1)throw Object.assign(Error('CUSTOMER_NOT_FOUND'),{status:404});
 if(role!=='owner'&&String(rows[0].assigned_to||'')!==String(req.user.id||''))throw Object.assign(Error('CUSTOMER_NOT_ASSIGNED'),{status:403});
 return rows[0];
}
const short=(row)=>({id:row.id,customerId:row.customer_id,kind:row.kind,status:row.status,
 createdAt:row.created_at,expiresAt:row.expires_at,submittedAt:row.submitted_at,reviewedAt:row.reviewed_at,
 answers:row.answers_json?typeof row.answers_json==='string'?JSON.parse(row.answers_json):row.answers_json:null});
function register(app,{auth,getContext,tenantForRead}={}){
 if(!app||typeof auth!=='function'||typeof getContext!=='function'||typeof tenantForRead!=='function')throw Error('DESIGN_REQUEST_DEPENDENCIES_REQUIRED');
 const rate=new Map();
 function permit(req){
  const ip=String(req.ip||req.socket?.remoteAddress||'unknown').slice(0,100),now=Date.now(),key=ip+'|'+req.params.token?.slice(0,12);
  if(rate.size>2500)for(const [k,v] of rate)if(v.reset<now)rate.delete(k);
  const entry=rate.get(key)||{count:0,reset:now+10*60*1000};
  if(now>entry.reset){entry.count=0;entry.reset=now+10*60*1000}
  entry.count++;rate.set(key,entry);return entry.count<=25;
 }
 const lookup=async(token)=>{
  if(!CONTRACT.validToken(token))throw Object.assign(Error('INVALID_REQUEST_TOKEN'),{status:404});
  const ctx=getContext();dbReady(ctx);
  const [rows]=await ctx.mysqlPool.query(
   'SELECT b.id,b.tenant_id,b.customer_id,b.kind,b.status,b.expires_at,b.submitted_at,c.business_name FROM '+SCHEMA+' b JOIN sbc_customers c ON c.tenant_id=b.tenant_id AND c.id=b.customer_id WHERE b.token_hash=? LIMIT 1',
   [CONTRACT.hashToken(token)]);
  if(rows.length!==1)throw Object.assign(Error('DESIGN_REQUEST_NOT_FOUND'),{status:404});
  return {ctx,row:rows[0]};
 };
 app.post('/api/sbc/design-briefs',auth,async(req,res)=>{
  try{
   const tenant=tenantForRead(req),ctx=getContext();writable(ctx);
   const id=customerId(req.body?.customerId),kind=CONTRACT.requireType(req.body?.kind);
   const c=await customerAccess(ctx,tenant,req,id);
   const token=CONTRACT.generateToken(),hash=CONTRACT.hashToken(token),requestId='brief_'+randomBytes(12).toString('hex');
   const now=new Date(),expires=new Date(now.getTime()+14*86400000);
   await ctx.mysqlPool.query(
    'INSERT INTO '+SCHEMA+' (id,tenant_id,customer_id,kind,token_hash,status,requested_by,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [requestId,tenant,id,kind,hash,'OPEN',String(req.user.id||''),now,expires]);
   res.setHeader('Cache-Control','private, no-store');
   return res.status(201).json({ok:true,id:requestId,kind,businessName:c.business_name,status:'OPEN',urlPath:'/request/'+token,expiresAt:expires.toISOString(),
    sent:false,notice:'Copy and send this link yourself. No email or SMS was sent automatically.'});
  }catch(e){return safeError(res,e)}
 });
 app.get('/api/sbc/design-briefs/customer/:customerId',auth,async(req,res)=>{
  try{
   const tenant=tenantForRead(req),ctx=getContext();dbReady(ctx);
   const id=customerId(req.params.customerId);await customerAccess(ctx,tenant,req,id);
   const [rows]=await ctx.mysqlPool.query('SELECT id,customer_id,kind,status,answers_json,created_at,expires_at,submitted_at,reviewed_at FROM '+SCHEMA+' WHERE tenant_id=? AND customer_id=? ORDER BY created_at DESC LIMIT 40',[tenant,id]);
   res.setHeader('Cache-Control','private, no-store');return res.json({ok:true,briefs:rows.map(short)});
  }catch(e){return safeError(res,e)}
 });
 app.post('/api/sbc/design-briefs/:id/revoke',auth,async(req,res)=>{
  try{
   const tenant=tenantForRead(req),ctx=getContext();writable(ctx);
   const id=clamp(req.params.id,80);
   const [r]=await ctx.mysqlPool.query('SELECT customer_id FROM '+SCHEMA+' WHERE tenant_id=? AND id=? LIMIT 1',[tenant,id]);
   if(!r.length)throw Object.assign(Error('DESIGN_REQUEST_NOT_FOUND'),{status:404});
   await customerAccess(ctx,tenant,req,r[0].customer_id);
   const [result]=await ctx.mysqlPool.query('UPDATE '+SCHEMA+' SET status=? WHERE tenant_id=? AND id=? AND status=?',['REVOKED',tenant,id,'OPEN']);
   if(result.affectedRows!==1)throw Object.assign(Error('DESIGN_REQUEST_NOT_OPEN'),{status:409});
   return res.json({ok:true,status:'REVOKED'});
  }catch(e){return safeError(res,e)}
 });
 app.post('/api/sbc/design-briefs/:id/review',auth,async(req,res)=>{
  try{
   const tenant=tenantForRead(req),ctx=getContext();writable(ctx);
   const id=clamp(req.params.id,80);
   const [r]=await ctx.mysqlPool.query('SELECT customer_id FROM '+SCHEMA+' WHERE tenant_id=? AND id=? LIMIT 1',[tenant,id]);
   if(!r.length)throw Object.assign(Error('DESIGN_REQUEST_NOT_FOUND'),{status:404});
   await customerAccess(ctx,tenant,req,r[0].customer_id);
   const [result]=await ctx.mysqlPool.query('UPDATE '+SCHEMA+' SET status=?,reviewed_at=? WHERE tenant_id=? AND id=? AND status=?',['REVIEWED',new Date(),tenant,id,'SUBMITTED']);
   if(result.affectedRows!==1)throw Object.assign(Error('DESIGN_REQUEST_NOT_SUBMITTED'),{status:409});
   return res.json({ok:true,status:'REVIEWED'});
  }catch(e){return safeError(res,e)}
 });
 app.get('/request/:token',async(req,res)=>{
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'");
  try{
   if(!permit(req))return res.status(429).type('text/plain').send('Too many requests. Please try later.');
   const {row}=await lookup(req.params.token);
   if(row.status==='REVOKED'||new Date(row.expires_at).getTime()<=Date.now())return res.status(410).type('text/plain').send('This SBC request link has expired. Ask us for a new one.');
   return res.type('html').send(fs.readFileSync(path.join(__dirname,'../public/sbc-customer-design-brief.html'),'utf8'));
  }catch(e){return res.status(e.status||503).type('text/plain').send('This request form is unavailable. Ask SBC for a new link.')}
 });
 app.get('/api/sbc/design-briefs/public/:token',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  try{
   if(!permit(req))return bad(res,429,'RATE_LIMITED');
   const {row}=await lookup(req.params.token);
   if(row.status==='REVOKED'||new Date(row.expires_at).getTime()<=Date.now())return bad(res,410,'LINK_EXPIRED');
   return res.json({ok:true,kind:row.kind,businessName:row.business_name,status:row.status,expiresAt:row.expires_at});
  }catch(e){return safeError(res,e)}
 });
 app.post('/api/sbc/design-briefs/public/:token',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  try{
   if(!permit(req))return bad(res,429,'RATE_LIMITED');
   if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))return bad(res,415,'JSON_REQUIRED');
   if(req.body?.websiteUrl) return bad(res,422,'AUTOMATED_SUBMISSION_REJECTED');
   const {ctx,row}=await lookup(req.params.token);writable(ctx);
   if(new Date(row.expires_at).getTime()<=Date.now()||row.status==='REVOKED')return bad(res,410,'LINK_EXPIRED');
   if(row.status!=='OPEN')return bad(res,409,'ALREADY_SUBMITTED');
   const answers=CONTRACT.normalize(row.kind,req.body||{});
   const [result]=await ctx.mysqlPool.query('UPDATE '+SCHEMA+' SET answers_json=?,status=?,submitted_at=? WHERE token_hash=? AND status=? AND expires_at>?',[
    JSON.stringify(answers),'SUBMITTED',new Date(),CONTRACT.hashToken(req.params.token),'OPEN',new Date()]);
   if(result.affectedRows!==1)return bad(res,409,'ALREADY_SUBMITTED');
   return res.status(201).json({ok:true,status:'SUBMITTED',message:'Thank you! Your design preferences were sent to Successful By Choice for review. No order or payment was placed.'});
  }catch(e){return safeError(res,e)}
 });
 return {registered:true};
}
module.exports={register,short,customerAccess};
