'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6661_PORTAL_SESSION_REVOCATION';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' count='+n);return s.replace(a,b);}
function patchServer(s){
 if(s.includes(MARKER))throw Error(MARKER+': duplicate');
 // Keep the old secret source for unrelated legacy vault and intake signatures.
 // Portal authentication alone MUST use an independently configured long secret.
 s=once(s,
  "function portalSign(v){return crypto.createHmac('sha256',PORTAL_SECRET).update(v).digest('base64url')}",
  "// "+MARKER+": fail closed if independent portal auth signing key is absent.\n"+
  "function sbcPortalSessionsConfigured(){const k=String(process.env.SBC_PORTAL_SECRET||'');return k.length>=32&&new Set(k).size>=8;}\n"+
  "function portalSign(v){return crypto.createHmac('sha256',PORTAL_SECRET).update(v).digest('base64url')}",
  'portal auth needs dedicated strong secret');
 s=once(s,
  "function makePortalToken(account){const payload=b64u(JSON.stringify({sub:account.id,cid:account.customerId,exp:Date.now()+1000*60*60*24*30}));return payload+'.'+portalSign(payload)}",
  "function makePortalToken(account){const payload=b64u(JSON.stringify({sub:account.id,cid:account.customerId,sv:Number(account.portalSessionVersion)||0,exp:Date.now()+1000*60*60*24*30}));return payload+'.'+portalSign(payload)}",
  'portal token session version');
 s=once(s,
  "function portalAccount(req){const h=String(req.headers.authorization||'');const token=h.startsWith('Bearer ')?h.slice(7).trim():'';if(!token)return null;try{const [payload,sig]=token.split('.');if(!payload||!sig||portalSign(payload)!==sig)return null;const data=JSON.parse(fromB64u(payload));if(!data.exp||Date.now()>Number(data.exp))return null;const a=(db.customerAccounts||[]).find(x=>x.id===data.sub&&x.customerId===data.cid&&x.active!==false);return a||null}catch{return null}}",
  "function portalAccount(req){if(!sbcPortalSessionsConfigured())return null;const h=String(req.headers.authorization||'');const token=h.startsWith('Bearer ')?h.slice(7).trim():'';if(!token||token.length>8192)return null;try{const parts=token.split('.');if(parts.length!==2)return null;const [payload,sig]=parts;if(!payload||!sig)return null;const expected=Buffer.from(portalSign(payload),'base64url'),actual=Buffer.from(sig,'base64url');if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))return null;const data=JSON.parse(fromB64u(payload));const sv=Number(data.sv);if(!Number.isSafeInteger(sv)||sv<0||!Number.isFinite(data.exp)||Date.now()>Number(data.exp))return null;const a=(db.customerAccounts||[]).find(x=>x.id===data.sub&&x.customerId===data.cid&&x.active!==false);return a&&sv===(Number(a.portalSessionVersion)||0)?a:null}catch{return null}}",
  'constant-time HMAC and revocation');
 for(const route of ["app.post('/api/portal/register',rateLimit(),async(req,res)=>{","app.post('/api/portal/login',rateLimit(),async(req,res)=>{"]){
  s=once(s,route,route+"\n  if(!sbcPortalSessionsConfigured())return res.status(503).json({ok:false,code:'SBC_PORTAL_SESSION_SECRET_REQUIRED'});",
  'reject account mutation without independent portal secret');
 }
 s=once(s,"app.post('/api/portal/logout',(req,res)=>res.json({ok:true}));",
 "app.post('/api/portal/logout',portalAuth,async(req,res)=>{req.portalAccount.portalSessionVersion=(Number(req.portalAccount.portalSessionVersion)||0)+1;await saveData();res.json({ok:true,revoked:true});});",
 'logout must revoke bearer tokens');
 new vm.Script(s,{filename:'server.js'});return s;
}
function apply(root){const p=path.join(root,'server.js');if(!fs.existsSync(p))throw Error(MARKER+': no server');const out=patchServer(fs.readFileSync(p,'utf8'));fs.writeFileSync(p,out);return {marker:MARKER,files:['server.js'],noProductionWrites:true};}
module.exports={MARKER,patchServer,apply};
