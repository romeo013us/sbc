'use strict';
const crypto=require('node:crypto');
// Authenticate server-to-server SBCMIA requests; browser Host/Origin alone never authorizes tenant writes.
const SITES=new Set(['sbcmia.com','www.sbcmia.com']);
const ROUTES=new Set(['/api/web-lead','/api/portal/register','/api/portal/login']);
const seen=new Map();
function signature({key,host,method,path,at,nonce,body}){
 const b=Buffer.isBuffer(body)?body:Buffer.from(String(body||''),'utf8');
 const msg=[String(at),String(host).toLowerCase(),String(method).toUpperCase(),String(path),
  crypto.createHash('sha256').update(b).digest('hex'),String(nonce)].join('\n');
 return crypto.createHmac('sha256',key).update(msg).digest('hex');
}
function verify(req,{key,nowSeconds=Math.floor(Date.now()/1000),maxSkew=300}={}){
 const h=req?.headers||{},host=String(h['x-sbc-website-host']||'').trim().toLowerCase(),
  method=String(req?.method||'').toUpperCase(),path=String(req?.path||''),
  at=String(h['x-sbc-website-timestamp']||''),nonce=String(h['x-sbc-website-nonce']||''),
  signed=String(h['x-sbc-website-signature']||'');
 if(typeof key!=='string'||key.length<32)return {ok:false,code:'SITE_BRIDGE_NOT_CONFIGURED'};
 if(!SITES.has(host)||method!=='POST'||!ROUTES.has(path))return {ok:false,code:'SITE_BRIDGE_ORIGIN_OR_ROUTE_DENIED'};
 if(!/^[0-9]{10,12}$/.test(at)||Math.abs(Number(at)-nowSeconds)>maxSkew)
  return {ok:false,code:'SITE_BRIDGE_TIMESTAMP_INVALID'};
 if(!/^[a-f0-9]{32}$/.test(nonce)||!/^[a-f0-9]{64}$/.test(signed))
  return {ok:false,code:'SITE_BRIDGE_SIGNATURE_INVALID'};
 if(!Buffer.isBuffer(req?.rawBody))return {ok:false,code:'SITE_BRIDGE_RAW_BODY_REQUIRED'};
 const expected=Buffer.from(signature({key,host,method,path,at,nonce,body:req.rawBody}),'hex'),got=Buffer.from(signed,'hex');
 if(got.length!==expected.length||!crypto.timingSafeEqual(expected,got))
  return {ok:false,code:'SITE_BRIDGE_SIGNATURE_INVALID'};
 const digest=crypto.createHash('sha256').update(signed).digest('hex');
 if(seen.has(digest))return {ok:false,code:'SITE_BRIDGE_REPLAY_DENIED'};
 for(const [k,t] of seen)if(nowSeconds-t>maxSkew)seen.delete(k);
 if(seen.size>=4096)seen.delete(seen.keys().next().value);
 seen.set(digest,nowSeconds);
 return {ok:true,host};
}
module.exports={signature,verify};