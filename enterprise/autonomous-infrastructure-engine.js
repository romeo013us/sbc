'use strict';
/**
 * Fantastic 4 Autonomous Infrastructure Engine V1
 * Defensive autonomy only: observe -> decide -> act -> verify -> escalate.
 * Deliberately does NOT inspect raw V8 memory, inject code into a live process,
 * rotate secrets without an external provider, spoof attackers, or mutate a DB
 * schema blindly. Those operations are unsafe/non-portable on managed hosting.
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const VERSION = '1.0.0';
const MAX_LEDGER = 10000;
const MAX_EVENTS = 5000;
const DEFAULT_MAX_RSS = Number(process.env.SBC_AUTONOMOUS_MAX_RSS_MB || 768) * 1024 * 1024;

function now(){ return new Date().toISOString(); }
function sha(v){ return crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex'); }
function rid(p='ai'){ return `${p}_${crypto.randomBytes(8).toString('hex')}`; }
function rootDir(){ return process.env.SBC_AUTONOMOUS_STATE_DIR || path.join(os.tmpdir(),'sbc-autonomous'); }
function ensureDir(){ fs.mkdirSync(rootDir(),{recursive:true,mode:0o700}); }
function safeJson(file, fallback){ try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;} }
function atomicWrite(file,value){ ensureDir(); const tmp=`${file}.${process.pid}.tmp`; fs.writeFileSync(tmp,JSON.stringify(value,null,2),{mode:0o600}); fs.renameSync(tmp,file); }

function state(){
  ensureDir();
  const f=path.join(rootDir(),'state.json');
  const s=safeJson(f,{});
  s.version=VERSION;
  s.ledger=Array.isArray(s.ledger)?s.ledger:[];
  s.events=Array.isArray(s.events)?s.events:[];
  s.recovery=Array.isArray(s.recovery)?s.recovery:[];
  s.api=Array.isArray(s.api)?s.api:[];
  s.dataHealing=Array.isArray(s.dataHealing)?s.dataHealing:[];
  s.schema=Array.isArray(s.schema)?s.schema:[];
  s.security=Array.isArray(s.security)?s.security:[];
  s.hotfixes=Array.isArray(s.hotfixes)?s.hotfixes:[];
  s.lastLedgerHash=s.lastLedgerHash||'GENESIS';
  s.updatedAt=now();
  return s;
}
function persist(s){ atomicWrite(path.join(rootDir(),'state.json'),s); }

function ledgerAppend(s,type,payload){
  const previous=s.lastLedgerHash||'GENESIS';
  const block={index:s.ledger.length,at:now(),type,payload,previousHash:previous};
  block.hash=sha(block);
  s.ledger.push(block); if(s.ledger.length>MAX_LEDGER)s.ledger.shift();
  s.lastLedgerHash=block.hash;
  atomicWrite(path.join(rootDir(),'ledger-root.txt'),block.hash+'\n');
  return block;
}
function record(s,type,payload){
  const e={id:rid('evt'),at:now(),type,payload}; s.events.unshift(e); if(s.events.length>MAX_EVENTS)s.events.length=MAX_EVENTS; ledgerAppend(s,type,payload); persist(s); return e;
}

function resourceSnapshot(){
  const m=process.memoryUsage();
  return {at:now(),rss:m.rss,heapUsed:m.heapUsed,heapTotal:m.heapTotal,external:m.external,arrayBuffers:m.arrayBuffers||0,cpuLoad1:Number(os.loadavg()[0].toFixed(3)),uptimeSeconds:Math.floor(process.uptime())};
}
function resourceGuard(s){
  const snap=resourceSnapshot();
  const pressure=snap.rss>=DEFAULT_MAX_RSS || snap.heapUsed>=Math.floor(snap.heapTotal*0.9);
  const action=pressure?'PROTECTIVE_THROTTLE':'NORMAL';
  if(pressure){
    if(typeof global.gc==='function') { try{global.gc();}catch{} }
    record(s,'resource.pressure',{before:snap,action:'bounded_gc_if_available_and_throttle_noncritical_work'});
  }
  return {ok:true,pressure,action,snapshot:snap,policy:{maxRssBytes:DEFAULT_MAX_RSS,heapHighWatermark:0.9}};
}

function mirrorSessionMetadata(sessionStore){
  // Metadata checkpoint only; raw V8/credential/session objects never leave process memory.
  const s=state(); const checkpoint={at:now(),processId:process.pid,uptime:process.uptime(),sessionMode:sessionStore?.mode||'unknown',durable:Boolean(sessionStore?.durable)};
  record(s,'session.checkpoint',checkpoint); return checkpoint;
}

function apiHealth(name,result){
  const s=state(); const status=Number(result?.status||0); const latency=Number(result?.latencyMs||0);
  const healthy=Boolean(result?.ok) && status>=200 && status<500 && latency<Number(process.env.SBC_API_HEALTH_LATENCY_MS||8000);
  const row={id:rid('api'),at:now(),provider:name,healthy,status,latencyMs:latency,error:result?.error||null};
  s.api.unshift(row); if(s.api.length>MAX_EVENTS)s.api.length=MAX_EVENTS; record(s,'provider.health',row); return row;
}
function providerDecision(history){
  const recent=history.slice(0,5); const failures=recent.filter(x=>!x.healthy).length;
  if(failures>=3)return {state:'DEGRADED',action:'HOLD_AND_RETRY',reason:'Repeated provider failures'};
  return {state:'HEALTHY',action:'USE_PRIMARY'};
}

function healData(input={}){
  const out={...input};
  for(const k of Object.keys(out)) if(typeof out[k]==='string') out[k]=out[k].trim().replace(/\s+/g,' ');
  if(out.email) out.email=String(out.email).toLowerCase();
  if(out.phone) out.phone=String(out.phone).replace(/[^\d+]/g,'');
  if(out.website && !/^https?:\/\//i.test(out.website)) out.website='https://'+out.website;
  const missing=[]; for(const k of ['name']) if(!String(out[k]||'').trim())missing.push(k);
  return {record:out,valid:missing.length===0,missing,corrections:['trim','whitespace_normalization','email_lowercase','phone_normalization','website_protocol'].filter(Boolean)};
}
function schemaGuard(expected={},actual={}){
  const mismatches=[];
  for(const [table,cols] of Object.entries(expected)){
    const got=actual[table]||{};
    for(const col of cols){ if(!got[col])mismatches.push({table,column:col,type:'MISSING'}); }
  }
  return {ok:mismatches.length===0,mismatches,decision:mismatches.length?'BLOCK_AND_ESCALATE':'ALLOW'};
}

function scanSecrets(text){
  const patterns=[/sk_(?:live|test)_[A-Za-z0-9]{12,}/g,/xox[baprs]-[A-Za-z0-9-]{12,}/g,/AKIA[0-9A-Z]{16}/g,/-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY-----/g,/password\s*[:=]\s*[^\s,;]{8,}/gi,/api[_-]?key\s*[:=]\s*[^\s,;]{12,}/gi];
  const findings=[]; for(const p of patterns){ const m=String(text||'').match(p); if(m)for(const hit of m.slice(0,20))findings.push({pattern:p.toString(),fingerprint:sha(hit).slice(0,16)}); }
  return {ok:findings.length===0,findings};
}
function secretGuard(text,source='unknown'){
  const s=state(); const result=scanSecrets(text);
  if(!result.ok) record(s,'security.secret_exposure',{source,count:result.findings.length,findings:result.findings,action:'QUARANTINE_AND_ESCALATE',rotation:'EXTERNAL_PROVIDER_REQUIRED'});
  return result;
}

function securityDecision(fingerprint){
  const knownBad=String(fingerprint||'').length>0;
  return {matched:knownBad,action:knownBad?'RATE_LIMIT_AND_ESCALATE':'ALLOW',sandbox:false,note:'No deceptive mock-response sandbox is used.'};
}

function hotfixAnalyze(error={}){
  const text=String(error.message||error.stack||'');
  const known=[
    {match:/Cannot read propert|undefined|null/i,pattern:'NULL_GUARD'},
    {match:/ECONNRESET|ETIMEDOUT|ECONNREFUSED/i,pattern:'RETRY_WITH_BACKOFF'},
    {match:/429|rate.?limit/i,pattern:'RATE_LIMIT_BACKOFF'},
    {match:/JSON|parse/i,pattern:'INPUT_SCHEMA_GUARD'}
  ];
  const pattern=known.find(x=>x.match.test(text));
  return {recognized:Boolean(pattern),pattern:pattern?.pattern||'UNKNOWN',decision:pattern?'ISOLATED_RECOVERY':'ESCALATE_TO_HUMAN',canLivePatch:false};
}
function recoveryPlan(error){
  const s=state(); const analysis=hotfixAnalyze(error); const row={id:rid('fix'),at:now(),analysis,error:{message:String(error?.message||'')},status:analysis.recognized?'QUEUED_FOR_SAFE_RECOVERY':'ESCALATED'}; s.hotfixes.unshift(row); record(s,'runtime.hotfix.plan',row); return row;
}

function demoPlan(input={}){
  const clean=healData(input); return {id:rid('demo'),mode:'SANDBOX',status:clean.valid?'READY':'NEEDS_INPUT',brand:clean.record,provisioning:'SIMULATED_UNTIL_PROVIDER_CONFIGURED'};
}
function health(s){
  return {ok:true,version:VERSION,mode:'AI_SUPERVISED_AUTONOMY',resource:resourceSnapshot(),ledger:{blocks:s.ledger.length,lastHash:s.lastLedgerHash,rootFile:path.join(rootDir(),'ledger-root.txt')},providers:s.api.slice(0,10),openRecovery:s.recovery.filter(x=>x.status==='OPEN').length,hotfixes:s.hotfixes.slice(0,10)};
}

module.exports={VERSION,state,persist,ledgerAppend,record,resourceSnapshot,resourceGuard,mirrorSessionMetadata,apiHealth,providerDecision,healData,schemaGuard,scanSecrets,secretGuard,securityDecision,hotfixAnalyze,recoveryPlan,demoPlan,health};
