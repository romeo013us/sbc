'use strict';
// Isolated local worker spool, not the Command Center database. A trusted
// coordinator supplies authenticated scope, worker registry and asset service.
// Use on a private local disk, never an untrusted or network-mounted directory.
const {DatabaseSync}=require('node:sqlite');
const {randomUUID,randomBytes,createHash}=require('node:crypto');
const path=require('node:path');
const {renderVector}=require('./vector-design.cjs');
const idOK=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(s);
const hashOK=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const only=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
function scopeOf(s){if(!only(s,['tenantId','projectId'])||!Number.isSafeInteger(s.tenantId)||s.tenantId<1||!idOK(s.projectId))throw Error('INVALID_JOB_SCOPE');return [s.tenantId,s.projectId];}
function normalize(r){
 if(!r||typeof r.alt!=='string'||!r.alt.trim()||r.alt.length>180||/[<>\u0000-\u001f\u007f]/.test(r.alt))throw Error('INVALID_JOB_REQUEST');
 const design=d=>{renderVector(d);return Object.fromEntries(['format','brand','headline','detail','cta','palette'].map(k=>[k,d[k]]));};
 if(r.kind==='template-image'&&only(r,['kind','design','alt']))return {kind:r.kind,design:design(r.design),alt:r.alt.trim()};
 if(r.kind==='template-video'&&only(r,['kind','slides','alt'])&&Array.isArray(r.slides)&&r.slides.length>=1&&r.slides.length<=4){
  let duration=0;const slides=r.slides.map(s=>{if(!only(s,['design','seconds'])||!Number.isInteger(s.seconds)||s.seconds<2||s.seconds>8)throw Error('INVALID_JOB_REQUEST');duration+=s.seconds;return {design:design(s.design),seconds:s.seconds};});
  if(duration>24||slides.some(s=>s.design.format!==slides[0].design.format))throw Error('INVALID_JOB_REQUEST');
  return {kind:r.kind,slides,alt:r.alt.trim()};
 }
 throw Error('INVALID_JOB_REQUEST');
}
function openJobQueue({filename,clock=Date.now,leaseMs=300000,maxAttempts=3}={}){
 if(typeof filename!=='string'||!path.isAbsolute(filename)||typeof clock!=='function'||!Number.isSafeInteger(leaseMs)||leaseMs<1000||leaseMs>1800000||!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>5)throw Error('INVALID_JOB_CONFIG');
 const db=new DatabaseSync(filename);db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
 db.exec(`CREATE TABLE IF NOT EXISTS creative_jobs (id TEXT PRIMARY KEY,tenant INTEGER NOT NULL,project TEXT NOT NULL,idem TEXT NOT NULL,request TEXT NOT NULL,digest TEXT NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,worker TEXT,token TEXT,expires INTEGER,available INTEGER NOT NULL,created INTEGER NOT NULL,asset TEXT,error TEXT,UNIQUE(tenant,project,idem)); CREATE INDEX IF NOT EXISTS creative_jobs_claim ON creative_jobs(tenant,status,available,created);`);
 const run=(sql,...v)=>db.prepare(sql).run(...v),one=(sql,...v)=>db.prepare(sql).get(...v);
 const now=()=>{const n=clock();if(!Number.isSafeInteger(n)||n<0||n>Number.MAX_SAFE_INTEGER-1800000)throw Error('INVALID_JOB_CLOCK');return n;};
 function tx(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
 const row=(s,id)=>{const [t,p]=scopeOf(s);if(!idOK(id))throw Error('INVALID_JOB_ID');return one('SELECT * FROM creative_jobs WHERE tenant=? AND project=? AND id=?',t,p,id);};
 const view=r=>r?{id:r.id,tenantId:r.tenant,projectId:r.project,status:r.status,attempts:r.attempts,leaseUntil:r.expires,assetId:r.asset,errorCode:r.error}:null;
 function submit(s,request,key){const [t,p]=scopeOf(s);if(!idOK(key))throw Error('INVALID_JOB_KEY');const json=JSON.stringify(normalize(request)),digest=createHash('sha256').update(json).digest('hex');return tx(()=>{
  const prior=one('SELECT * FROM creative_jobs WHERE tenant=? AND project=? AND idem=?',t,p,key);if(prior){if(prior.digest!==digest)throw Error('IDEMPOTENCY_CONFLICT');return view(prior);}
  if(one("SELECT count(*) AS n FROM creative_jobs WHERE tenant=? AND status IN ('queued','running')",t).n>=100)throw Error('JOB_QUEUE_LIMIT');
  const id=randomUUID(),n=now();run("INSERT INTO creative_jobs(id,tenant,project,idem,request,digest,status,available,created) VALUES(?,?,?,?,?,?,'queued',?,?)",id,t,p,key,json,digest,n,n);return view(row(s,id));
 });}
 function claim(w){const n=now();if(!w||!idOK(w.id)||!Number.isSafeInteger(w.tenantId)||w.tenantId<1||w.authorized!==true||w.healthy!==true||w.billing!=='local'||w.commercialApproved!==true||w.mode!=='cpu'||w.engine!=='ffmpeg'||!Number.isSafeInteger(w.heartbeatAt)||w.heartbeatAt>n||w.heartbeatAt<n-60000||!Number.isSafeInteger(w.availableSlots)||w.availableSlots<1)return null;
  return tx(()=>{
   run("UPDATE creative_jobs SET status=CASE WHEN attempts>=? THEN 'failed' ELSE 'queued' END,worker=NULL,token=NULL,expires=NULL,available=?,error='LEASE_EXPIRED' WHERE tenant=? AND status='running' AND expires<=?",maxAttempts,n,w.tenantId,n);
   // Local renderer has one slot per worker; never trust an inflated capacity report.
   if(one("SELECT id FROM creative_jobs WHERE tenant=? AND worker=? AND status='running' LIMIT 1",w.tenantId,w.id))return null;
   const r=one("SELECT * FROM creative_jobs WHERE tenant=? AND status='queued' AND available<=? ORDER BY created,id LIMIT 1",w.tenantId,n);if(!r)return null;
   const token=randomBytes(32).toString('hex');run("UPDATE creative_jobs SET status='running',attempts=attempts+1,worker=?,token=?,expires=?,error=NULL WHERE id=?",w.id,token,n+leaseMs,r.id);
   return {...view(row({tenantId:r.tenant,projectId:r.project},r.id)),request:JSON.parse(r.request),leaseToken:token};
  });
 }
 function active(s,id,token,n){const r=row(s,id);if(!r||r.status!=='running'||!hashOK(token)||r.token!==token||r.expires<=n)throw Error('LEASE_LOST');return r;}
 function renew(s,id,token){return tx(()=>{const n=now();active(s,id,token,n);run('UPDATE creative_jobs SET expires=? WHERE id=?',n+leaseMs,id);return view(row(s,id));});}
 function fail(s,id,token,code){if(!['RENDER_FAILED','RENDER_UNAVAILABLE','ASSET_NOT_VERIFIED'].includes(code))throw Error('INVALID_JOB_ERROR');return tx(()=>{const n=now(),r=active(s,id,token,n),status=r.attempts>=maxAttempts?'failed':'queued';run('UPDATE creative_jobs SET status=?,worker=NULL,token=NULL,expires=NULL,available=?,error=? WHERE id=?',status,n+1000*2**(r.attempts-1),code,id);return view(row(s,id));});}
 async function complete(s,id,token,assetId,service){if(!hashOK(assetId)||typeof service?.get!=='function')throw Error('ASSET_NOT_VERIFIED');const [t,p]=scopeOf(s),scope={tenantId:t,projectId:p},r=active(scope,id,token,now());const asset=(await service.get(scope,assetId))?.asset;const mime=JSON.parse(r.request).kind==='template-image'?'image/png':'video/mp4';if(!asset||asset.id!==assetId||asset.tenantId!==t||asset.projectId!==p||asset.mime!==mime||asset.reviewState!=='draft')throw Error('ASSET_NOT_VERIFIED');return tx(()=>{active(scope,id,token,now());run("UPDATE creative_jobs SET status='completed',asset=?,worker=NULL,token=NULL,expires=NULL,error=NULL WHERE id=?",assetId,id);return view(row(scope,id));});}
 return Object.freeze({submit,claim,renew,fail,complete,get:(s,id)=>view(row(s,id)),close:()=>db.close()});
}
module.exports={openJobQueue};
