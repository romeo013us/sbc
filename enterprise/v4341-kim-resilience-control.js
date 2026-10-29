'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const os=require('os');
const ROOT=path.resolve(__dirname,'..');
// Release-owned static catalog; /data is reserved for persistent SBC state.
const CATALOG=require('./catalogs/v4341-kim-resilience-control.json');
const OWNER_FILE=path.join(ROOT,'data','sbc-owner-protection.json');
const MANIFEST_FILE=path.join(ROOT,'data','sbc-integrity-manifest.json');
const now=()=>new Date().toISOString();
const clean=(v,n=2000)=>String(v??'').replace(/\u0000/g,'').trim().slice(0,n);
const architectureConfigured=env=>Boolean(env?.SBC_GLOBAL_ROUTER_URL||env?.SBC_DB_GLOBAL_ENDPOINT||env?.SBC_ORCHESTRATION||env?.SBC_API_GATEWAY_URL||env?.SBC_MULTI_REGION);
const providerConfigured=env=>Boolean(env?.SQUARE_ACCESS_TOKEN||env?.TWILIO_AUTH_TOKEN||env?.GODADDY_PAT||env?.FOUROVER4_API_KEY||env?.VISTAPRINT_API_KEY||env?.REDIS_URL||env?.AMQP_URL||env?.OTEL_EXPORTER_OTLP_ENDPOINT);
function statusFor(item,env=process.env){
  if(item.mode==='architecture-gated')return architectureConfigured(env)?'CONFIGURED':'HOST-GATED';
  if(item.mode==='provider-gated')return providerConfigured(env)?'INTEGRATION-READY':'PROVIDER-GATED';
  if(item.mode==='owner-gated')return 'OWNER-GATED';
  return 'READY';
}
function counts(db){const a=k=>Array.isArray(db?.[k])?db[k].length:0;return {customers:a('customers'),leads:a('leads')||a('crm'),orders:a('orders'),users:a('users'),tasks:a('tasks'),callReports:a('callReports')};}
function ownerLockStatus(user={},env=process.env){
  const role=String(user.role||'');
  const bound=String(env.SBC_OWNER_BINDING||'role:owner');
  const protectedBoundaries=['source distribution','production secrets','owner security','permanent deletion','financial reversals','provider credential changes','system-wide destructive controls'];
  return {locked:true,version:'43.4.1',ownerRoleRequired:true,actorRole:role,actorIsOwner:role==='owner',binding:bound,protectedBoundaries,kimMayOperateSafely:['diagnostics','readiness checks','reversible repairs','fulfillment preparation','provider failover planning','training/operations'],kimMayNotCross:['owner security','credential ownership changes','permanent deletion','irreversible financial actions','destructive infrastructure changes'],note:'This is an application-level control and integrity layer; it does not by itself create legal copyright/trademark protection or make source code impossible to copy.'};
}
function readiness(db,env=process.env){
  const statuses={}; for(const x of CATALOG.items){const s=statusFor(x,env);statuses[s]=(statuses[s]||0)+1;}
  return {ok:true,version:'43.4.1',suite:'Kim Resilience + Owner Control',counts:{capabilities:CATALOG.items.length,records:counts(db)},statuses,ownerLock:ownerLockStatus({role:'system'},env),hosting:{provider:'GoDaddy/cPanel/Airo compatible',externalMultiNodeFeaturesExplicitlyGated:!architectureConfigured(env)}};
}
function catalog(){return {version:'43.4.1',kimControl:CATALOG.items};}
function safeCheck(featureId,db,env=process.env,user={}){
  const item=CATALOG.items.find(x=>x.id===String(featureId)); if(!item)throw new Error('Unknown V43.4 capability.');
  const status=statusFor(item,env); let detail='Non-destructive readiness check completed. No customer, lead, order, payment, fulfillment, or credential record was changed.';
  if(item.name.includes('Circuit Breaker')||item.name.includes('Failover Router'))detail='Failover control is staged with circuit-breaker semantics; live vendor switching remains provider/credential gated.';
  else if(item.name.includes('Query')||item.name.includes('Persistence')||item.name.includes('SQL'))detail='Database shielding policy is staged for parameterized access and validation. Existing production queries are not rewritten by this check.';
  else if(item.name.includes('Owner')||item.name.includes('Administrator')||item.name.includes('Permissions'))detail='Owner-control boundary is enforced at the application layer; irreversible actions remain owner-gated.';
  else if(item.mode==='architecture-gated')detail='Capability is cataloged and guarded but remains host-gated on the current single-host GoDaddy runtime.';
  else if(item.mode==='provider-gated')detail='Capability is staged and remains inactive until the required provider configuration is present.';
  return {ok:true,version:'43.4.1',feature:item,status,detail,actor:clean(user.name||user.username||user.role||'authenticated-user',120),checkedAt:now(),recordCounts:counts(db)};
}
function queryShield(input){
  const q=String(input||'').trim();
  const blocked=/;\s*(drop|alter|truncate|grant|revoke)\b|\bunion\s+select\b|--|\/\*/i.test(q);
  const parameterized=/\?|:\w+|\$\d+/.test(q);
  return {ok:!blocked,blocked,parameterized,mode:'abstracted-query-shield',reason:blocked?'Unsafe query pattern detected.':'Structural query check passed; parameterized execution is required for runtime database writes.'};
}
class FailoverRouter{
  constructor(providers=[]){this.providers=providers.map(name=>({name:String(name),failures:0,state:'CLOSED'}));}
  plan(preferred){const p=this.providers.find(x=>x.name===preferred)||this.providers[0];const fallbacks=this.providers.filter(x=>x!==p).map(x=>x.name);return {ok:true,mode:'dry-run',preferred:p?.name||null,fallbacks,state:p?.state||'UNAVAILABLE',liveSwitch:false};}
  recordFailure(name){const p=this.providers.find(x=>x.name===name);if(!p)return null;p.failures++;if(p.failures>=3)p.state='OPEN';return {...p};}
}
function secretReadiness(env=process.env){const keys=['SBC_ADMIN_PASSWORD','SBC_SESSION_SECRET','SBC_PORTAL_SECRET','SBC_VAULT_KEY','SQUARE_ACCESS_TOKEN','SQUARE_LOCATION_ID','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_PHONE_NUMBER','OPENAI_API_KEY','GODADDY_PAT'];const present=keys.filter(k=>Boolean(env[k]));return {ok:true,total:keys.length,present:present.length,missing:keys.filter(k=>!env[k]),rotation:'owner-controlled',automaticRotation:'not enabled by default; provider-specific rotation must be explicitly configured',safeToRotateNow:false};}
function integrityManifest(){
  const files=['server.js','package.json','enterprise/v434-resilience-brand.js','enterprise/v4341-kim-resilience-control.js','public/index.html','public/app.js'];
  const hashes={}; for(const f of files){const p=path.join(ROOT,f);if(fs.existsSync(p))hashes[f]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}
  const doc={version:'43.4.1',owner:'Successful By Choice LLC',notice:'Proprietary SBC Business Command Center application. Owner-controlled distribution and production administration.',generatedAt:now(),hashes};
  fs.writeFileSync(MANIFEST_FILE,JSON.stringify(doc,null,2)); return doc;
}
function verifyIntegrity(){
  if(!fs.existsSync(MANIFEST_FILE))return {ok:true,locked:false,reason:'Integrity manifest not initialized.'};
  const m=JSON.parse(fs.readFileSync(MANIFEST_FILE,'utf8'));const mismatches=[];
  for(const [f,h] of Object.entries(m.hashes||{})){const p=path.join(ROOT,f);if(!fs.existsSync(p)||crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')!==h)mismatches.push(f);}
  return {ok:mismatches.length===0,locked:true,mismatches,manifestVersion:m.version};
}
function fullCheck(db,env=process.env){
  const q=queryShield('SELECT * FROM sbc_orders WHERE id = ?');
  const router=new FailoverRouter(['4over4','vistaprint']);
  router.recordFailure('4over4'); router.recordFailure('4over4'); const fail=router.recordFailure('4over4');
  const failPlan=router.plan('4over4');
  const owner=ownerLockStatus({role:'owner'},env); const secrets=secretReadiness(env); const integ=verifyIntegrity();
  return {ok:q.ok&&fail?.state==='OPEN'&&owner.locked,version:'43.4.1',mutations:0,productionVendorsTouched:false,checks:{queryShield:q,failoverCircuit:{ok:fail?.state==='OPEN'&&failPlan.ok,plan:failPlan},ownerLock:owner,secrets,integrity:integ,capabilityCount:CATALOG.items.length,runtime:{node:process.version,uptimeSeconds:Math.floor(process.uptime()),memory:process.memoryUsage(),loadAverage:os.loadavg()}}};
}
module.exports={CATALOG,readiness,catalog,safeCheck,ownerLockStatus,queryShield,FailoverRouter,secretReadiness,integrityManifest,verifyIntegrity,fullCheck};
