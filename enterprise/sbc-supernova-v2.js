// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
/**
 * SBC Supernova v2 — production-safe architecture fabric.
 * These capabilities are implemented as optional adapters/fabrics. They never
 * claim external infrastructure is live merely because the code path exists.
 */
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const {EventEmitter}=require('events');
const {Worker}=require('worker_threads');
const os=require('os');
const ROOT=path.resolve(__dirname,'..');
const DATA=path.join(ROOT,'data','supernova');
fs.mkdirSync(DATA,{recursive:true});
const events=new EventEmitter();
const appendFile=path.join(DATA,'cqrs-write.ndjson');
const immutableFile=path.join(DATA,'immutable-activity.ndjson');
const projections=new Map();
const tenantWindows=new Map();
let seq=0,lastHash='GENESIS';
try{const lines=fs.readFileSync(immutableFile,'utf8').trim().split('\n').filter(Boolean);if(lines.length){const x=JSON.parse(lines.at(-1));seq=Number(x.seq||0);lastHash=x.hash||lastHash}}catch{}
const now=()=>new Date().toISOString();
const cleanTenant=t=>String(t||'1').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80)||'1';
const sha=v=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
function audit(action,meta={},tenantId='1'){const e={seq:++seq,id:`sn_${Date.now()}_${seq}`,at:now(),tenantId:cleanTenant(tenantId),action,meta};e.hash=sha(`${lastHash}|${JSON.stringify(e)}`);lastHash=e.hash;fs.appendFileSync(immutableFile,JSON.stringify(e)+'\n');events.emit('audit',e);return e;}
function appendWrite(type,payload,tenantId='1'){const e={id:`w_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,at:now(),tenantId:cleanTenant(tenantId),type,payload};fs.appendFileSync(appendFile,JSON.stringify(e)+'\n');events.emit('write',e);return e;}
function project(name,rows){projections.set(String(name),rows);events.emit('projection',{name,rows});return rows;}
function readModel(name){return projections.get(String(name))||[];}
function verifyAudit(){let prev='GENESIS',n=0;try{for(const line of fs.readFileSync(immutableFile,'utf8').split('\n').filter(Boolean)){const e=JSON.parse(line),hash=e.hash;delete e.hash;const calc=sha(`${prev}|${JSON.stringify(e)}`);if(calc!==hash)return {ok:false,records:n,error:'HASH_MISMATCH'};prev=hash;n++}return {ok:true,records:n,lastHash:prev}}catch(e){return {ok:false,records:n,error:e.message}}}
function signJwt(payload,secret,ttlSec=3600){if(!secret)throw new Error('JWT_SECRET_NOT_CONFIGURED');const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const h=b64({alg:'HS256',typ:'JWT'}),p=b64({...payload,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+ttlSec});const raw=`${h}.${p}`;return `${raw}.${crypto.createHmac('sha256',secret).update(raw).digest('base64url')}`;}
function verifyJwt(token,secret){if(!token||!secret)throw new Error('JWT_NOT_CONFIGURED');const [h,p,s]=String(token).split('.');if(!h||!p||!s)throw new Error('JWT_INVALID');const raw=`${h}.${p}`,expected=crypto.createHmac('sha256',secret).update(raw).digest('base64url');if(!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(expected)))throw new Error('JWT_SIGNATURE_INVALID');const payload=JSON.parse(Buffer.from(p,'base64url').toString('utf8'));if(payload.exp&&payload.exp<Math.floor(Date.now()/1000))throw new Error('JWT_EXPIRED');return payload;}
function rateLimit(tenantId,limit=6000){const key=cleanTenant(tenantId),nowMs=Date.now(),x=tenantWindows.get(key)||{start:nowMs,count:0};if(nowMs-x.start>=60000){x.start=nowMs;x.count=0}x.count++;tenantWindows.set(key,x);return {allowed:x.count<=limit,count:x.count,limit};}
function zeroTrust(requiredRoles=[]){const roles=new Set(requiredRoles.map(String));return (req,res,next)=>{const role=String(req.user?.role||'');if(roles.size&&!roles.has(role))return res.status(403).json({error:'RBAC_DENIED'});req.sbcTenant=cleanTenant(__sbcRequireTenantId(req.user?.tenantId));next();};}
class WorkerPool{constructor(size=Math.max(1,Math.min(os.cpus().length,4))){this.size=size;this.active=0;this.queue=[];}
 run(taskData){return new Promise((resolve,reject)=>{this.queue.push({taskData,resolve,reject});this.pump();});}
 pump(){if(this.active>=this.size||!this.queue.length)return;const job=this.queue.shift();this.active++;const w=new Worker(path.join(__dirname,'supernova-worker.js'),{workerData:job.taskData});let settled=false;const done=(fn,v)=>{if(settled)return;settled=true;this.active--;w.terminate();fn(v);this.pump();};w.once('message',m=>m&&m.ok?done(job.resolve,m.result):done(job.reject,new Error(m?.error||'WORKER_FAILED')));w.once('error',e=>done(job.reject,e));w.once('exit',c=>{if(c!==0&&!settled)done(job.reject,new Error(`WORKER_EXIT_${c}`));});}}
const pool=new WorkerPool();
let memoryPressure=false;
function memoryFlux(threshold=0.88){const m=process.memoryUsage(),ratio=m.heapTotal?m.heapUsed/m.heapTotal:0;memoryPressure=ratio>=threshold;return {pressure:memoryPressure,ratio,heapUsed:m.heapUsed,heapTotal:m.heapTotal,rss:m.rss};}
function encryptedField(value,key){const secret=crypto.createHash('sha256').update(String(key||process.env.SBC_SUPERNOVA_FIELD_KEY||'')).digest();const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',secret,iv);const data=Buffer.concat([c.update(String(value),'utf8'),c.final()]);return {v:1,iv:iv.toString('base64url'),tag:c.getAuthTag().toString('base64url'),data:data.toString('base64url')};}
function decryptField(blob,key){const secret=crypto.createHash('sha256').update(String(key||process.env.SBC_SUPERNOVA_FIELD_KEY||'')).digest();const d=crypto.createDecipheriv('aes-256-gcm',secret,Buffer.from(blob.iv,'base64url'));d.setAuthTag(Buffer.from(blob.tag,'base64url'));return Buffer.concat([d.update(Buffer.from(blob.data,'base64url')),d.final()]).toString('utf8');}
async function sharedGet(redisClient,key){if(!redisClient||typeof redisClient.get!=='function')return {status:'NOT_CONFIGURED',value:null};try{return {status:'READY',value:await redisClient.get(`sbc:supernova:${cleanTenant(key)}`)}}catch(e){return {status:'ERROR',error:e.message};}}
async function sharedSet(redisClient,key,value,ttlSec=3600){if(!redisClient||typeof redisClient.set!=='function')return {status:'NOT_CONFIGURED'};try{await redisClient.set(`sbc:supernova:${cleanTenant(key)}`,JSON.stringify(value),{EX:Math.max(1,Number(ttlSec)||3600)});return {status:'READY'};}catch(e){return {status:'ERROR',error:e.message};}}
function snapshot(){return {version:'2.0.0',jwtConfigured:Boolean(process.env.SBC_JWT_SECRET),redisConfigured:Boolean(process.env.SBC_REDIS_URL),cqrs:{writeLog:appendFile,readModels:[...projections.keys()]},workerPool:{size:pool.size,active:pool.active,queued:pool.queue.length},memory:memoryFlux(),audit:verifyAudit()};}
module.exports={VERSION:'2.0.0',events,audit,appendWrite,project,readModel,verifyAudit,signJwt,verifyJwt,rateLimit,zeroTrust,pool,memoryFlux,encryptedField,decryptField,sharedGet,sharedSet,snapshot};
