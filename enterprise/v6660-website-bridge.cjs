'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs'),path=require('node:path');
// Read a deployment-managed bridge secret from persistent PRIVATE storage when
// GoDaddy's environment-variable quota is exhausted. Never use a web directory,
// browser-supplied path, source-controlled secret, or runtime-generated default.
const PRIVATE_BRIDGE_KEY_FILE=path.resolve(__dirname,'..','data','sbc-website-bridge.key');
function resolveBridgeKey(explicitKey,keyFile=PRIVATE_BRIDGE_KEY_FILE){
 if(typeof explicitKey==='string'&&explicitKey.length>0)return explicitKey;
 // Any supplied non-empty invalid value must fail closed, never fall through.
 if(explicitKey!==undefined&&explicitKey!==null&&explicitKey!=='')return explicitKey;
 try{
  const st=fs.lstatSync(keyFile);
  if(!st.isFile()||st.isSymbolicLink()||(st.mode&0o077)!==0||st.size<64||st.size>66)return null;
  const key=fs.readFileSync(keyFile,'utf8').trim();
  return /^[a-f0-9]{64}$/i.test(key)?key:null;
 }catch(_){return null}
}
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
function verify(req,{key,keyFile,nowSeconds=Math.floor(Date.now()/1000),maxSkew=300}={}){
 const h=req?.headers||{},host=String(h['x-sbc-website-host']||'').trim().toLowerCase(),
  method=String(req?.method||'').toUpperCase(),path=String(req?.path||''),
  at=String(h['x-sbc-website-timestamp']||''),nonce=String(h['x-sbc-website-nonce']||''),
  signed=String(h['x-sbc-website-signature']||'');
 const configuredKey=resolveBridgeKey(key,keyFile);
 if(typeof configuredKey!=='string'||configuredKey.length<32)return {ok:false,code:'SITE_BRIDGE_NOT_CONFIGURED'};
 if(!SITES.has(host)||method!=='POST'||!ROUTES.has(path))return {ok:false,code:'SITE_BRIDGE_ORIGIN_OR_ROUTE_DENIED'};
 if(!/^[0-9]{10,12}$/.test(at)||Math.abs(Number(at)-nowSeconds)>maxSkew)
  return {ok:false,code:'SITE_BRIDGE_TIMESTAMP_INVALID'};
 if(!/^[a-f0-9]{32}$/.test(nonce)||!/^[a-f0-9]{64}$/.test(signed))
  return {ok:false,code:'SITE_BRIDGE_SIGNATURE_INVALID'};
 if(!Buffer.isBuffer(req?.rawBody))return {ok:false,code:'SITE_BRIDGE_RAW_BODY_REQUIRED'};
 const expected=Buffer.from(signature({key:configuredKey,host,method,path,at,nonce,body:req.rawBody}),'hex'),got=Buffer.from(signed,'hex');
 if(got.length!==expected.length||!crypto.timingSafeEqual(expected,got))
  return {ok:false,code:'SITE_BRIDGE_SIGNATURE_INVALID'};
 const digest=crypto.createHash('sha256').update(signed).digest('hex');
 if(seen.has(digest))return {ok:false,code:'SITE_BRIDGE_REPLAY_DENIED'};
 for(const [k,t] of seen)if(nowSeconds-t>maxSkew)seen.delete(k);
 if(seen.size>=4096)seen.delete(seen.keys().next().value);
 seen.set(digest,nowSeconds);
 return {ok:true,host};
}
module.exports={signature,verify,resolveBridgeKey,PRIVATE_BRIDGE_KEY_FILE};