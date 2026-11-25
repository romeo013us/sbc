'use strict';
const crypto=require('node:crypto');
const PLAN='/api/marketing/creative-machine/plan',IMPORT='/api/marketing/creative-machine/import';
const WINDOW=300000;
const fail=code=>{throw Error(code)};
function keyBytes(key){
 if(typeof key!=='string')fail('IMPORTER_KEY_UNCONFIGURED');
 const b=Buffer.from(key,'base64');if(b.length!==32||b.toString('base64')!==key)fail('IMPORTER_KEY_UNCONFIGURED');
 return b;
}
function sign(r,key){
 const body=JSON.stringify(r.body??{});
 const payload=['SBC_CREATIVE_IMPORTER_V1',r.method,r.path,r.timestamp,r.nonce,crypto.createHash('sha256').update(body).digest('hex')].join('\n');
 return crypto.createHmac('sha256',keyBytes(key)).update(payload).digest('hex');
}
function createCreativeImporterAuth({getKey,clock=Date.now,consume}){
 if(typeof consume!=='function'||typeof getKey!=='function')fail('IMPORTER_CONFIG_REQUIRED');
 return async r=>{
  if(r.method!=='POST'||![PLAN,IMPORT].includes(r.path)||!r.body||typeof r.body!=='object'||Array.isArray(r.body)||!(/^\d{13}$/.test(r.timestamp||''))||!(/^[a-f0-9]{32}$/.test(r.nonce||''))||!(/^[a-f0-9]{64}$/.test(r.signature||'')))fail('IMPORTER_AUTH_INVALID');
  const now=clock(),time=Number(r.timestamp);
  if(!Number.isFinite(now)||Math.abs(now-time)>WINDOW)fail('IMPORTER_AUTH_EXPIRED');
  const expected=sign(r,getKey());
  if(!crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(r.signature,'hex')))fail('IMPORTER_AUTH_INVALID');
  if(await consume(r.nonce,time+WINDOW+60000,now)!==true)fail('IMPORTER_REPLAY');
  return true;
 };
}
function isRefillWindow(now){
 return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',hourCycle:'h23'}).format(new Date(now))==='06';
}
function mysqlNonceConsumer(pool,tenant,writerReady){
 return async(nonce,expires,now)=>{
  if(!writerReady())fail('CREATIVE_WRITER_UNAVAILABLE');
  // The unique primary key provides atomic replay rejection across processes.
  try{
   await pool.query('INSERT INTO sbc_creative_importer_nonce_v1 (tenant_id,nonce,expires_ms) VALUES(?,?,?)',[tenant,nonce,expires]);
  }catch(e){if(e.code==='ER_DUP_ENTRY')return false;throw e;}
  // Retain expired nonces until their entire signed timestamp window has elapsed.
  await pool.query('DELETE FROM sbc_creative_importer_nonce_v1 WHERE tenant_id=? AND expires_ms<?',[tenant,now]);
  return true;
 };
}
module.exports={PLAN,IMPORT,sign,createCreativeImporterAuth,isRefillWindow,mysqlNonceConsumer};
