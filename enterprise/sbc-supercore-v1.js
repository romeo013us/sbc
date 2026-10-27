'use strict';
/** SBC Supercore v1 — 20-capability engineering fabric.
 * Safe-by-default: local memory is a cache, MySQL remains authoritative, external
 * providers are adapters, and privileged/destructive operations require authorization.
 */
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const EventEmitter=require('events');
const os=require('os');

const VERSION='1.0.0';
const ROOT=path.join(__dirname,'..','storage','supercore');
fs.mkdirSync(ROOT,{recursive:true});
const logFile=path.join(ROOT,'activity.ndjson');
const events=new EventEmitter();
const localState=new Map();
const readModels=new Map();
const adapters=new Map();
const tenantLimits=new Map();
const eventQueue=[];
let seq=0;
let lastHash='GENESIS';
try{const last=fs.readFileSync(logFile,'utf8').trim().split('\n').filter(Boolean).pop();if(last){const x=JSON.parse(last);lastHash=x.hash||lastHash;seq=Number(x.seq||0)}}catch{}

function now(){return new Date().toISOString()}
function digest(x){return crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex')}
function tenantKey(t){return String(t||'1')}
function safeTenant(t){return tenantKey(t).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80)||'1'}
function emit(type,payload={},tenantId='1'){const e={id:`sc_${Date.now()}_${++seq}`,type,tenantId:tenantKey(tenantId),at:now(),payload};e.hash=digest(`${lastHash}|${JSON.stringify(e)}`);lastHash=e.hash;eventQueue.push(e);events.emit(type,e);events.emit('*',e);return e}
function appendLog(e){fs.appendFileSync(logFile,JSON.stringify(e)+'\n',{encoding:'utf8',flag:'a'});return e}
function publish(type,payload,tenantId){return appendLog(emit(type,payload,tenantId))}
function mirror(tenantId,key,value){const k=`${tenantKey(tenantId)}:${String(key)}`;localState.set(k,{value,updatedAt:now(),dirty:true});return localState.get(k)}
function readMirror(tenantId,key){return localState.get(`${tenantKey(tenantId)}:${String(key)}`)||null}
function flushMirror(flushFn){const dirty=[];for(const [k,v] of localState){if(v.dirty)dirty.push([k,v])}if(typeof flushFn==='function')flushFn(dirty);for(const [,v] of dirty)v.dirty=false;return dirty.length}
function registerAdapter(name,adapter){if(!name||!adapter)throw new Error('ADAPTER_REQUIRED');adapters.set(String(name),{name:String(name),...adapter});return adapters.get(String(name))}
function resolveAdapter(name){const a=adapters.get(String(name));if(!a)throw new Error(`ADAPTER_NOT_REGISTERED:${name}`);return a}
function setReadModel(name,rows){readModels.set(String(name),rows);return rows}
function getReadModel(name){return readModels.get(String(name))||[]}
function tenantGuard(tenantId,resource){const t=safeTenant(tenantId);const r=String(resource||'default').replace(/[^a-zA-Z0-9_-]/g,'_');return path.join(ROOT,'tenants',t,r)}
function setTenantLimit(tenantId,limit){tenantLimits.set(tenantKey(tenantId),{...limit,updatedAt:now()});return tenantLimits.get(tenantKey(tenantId))}
function getTenantLimit(tenantId){return tenantLimits.get(tenantKey(tenantId))||{maxEventsPerMinute:6000,maxQueue:1000,maxConcurrent:20}}
function consumeEventBudget(tenantId){const lim=getTenantLimit(tenantId);const k=`budget:${tenantKey(tenantId)}`;const x=localState.get(k)||{window:Date.now(),count:0};if(Date.now()-x.window>=60000){x.window=Date.now();x.count=0}x.count++;localState.set(k,x);return x.count<=Number(lim.maxEventsPerMinute||6000)}
function throttle(tenantId,meta={}){const ok=consumeEventBudget(tenantId);if(!ok)publish('tenant.throttled',{reason:'event_budget',meta},tenantId);return ok}
function obfuscationManifest(files){return {version:VERSION,files:Array.isArray(files)?files:[],mode:'production-build-hardening',note:'Use a standard build obfuscator/minifier; do not treat obfuscation as a security boundary.'}}
function encryptField(value,key){const secret=Buffer.isBuffer(key)?key:crypto.createHash('sha256').update(String(key||process.env.SBC_SUPERCORE_FIELD_KEY||'')).digest();if(secret.length!==32)throw new Error('FIELD_KEY_INVALID');const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',secret,iv);const ct=Buffer.concat([c.update(String(value),'utf8'),c.final()]);return {v:1,iv:iv.toString('base64url'),tag:c.getAuthTag().toString('base64url'),data:ct.toString('base64url')}}
function decryptField(blob,key){if(!blob||blob.v!==1)throw new Error('FIELD_CIPHERTEXT_INVALID');const secret=Buffer.isBuffer(key)?key:crypto.createHash('sha256').update(String(key||process.env.SBC_SUPERCORE_FIELD_KEY||'')).digest();const d=crypto.createDecipheriv('aes-256-gcm',secret,Buffer.from(blob.iv,'base64url'));d.setAuthTag(Buffer.from(blob.tag,'base64url'));return Buffer.concat([d.update(Buffer.from(blob.data,'base64url')),d.final()]).toString('utf8')}
function tokenMap(domain,map){const key=String(domain||'').toLowerCase().replace(/:\d+$/,'');return map[key]||null}
function verifyLog(){if(!fs.existsSync(logFile))return {ok:true,records:0,lastHash:'GENESIS'};let prev='GENESIS',n=0;for(const line of fs.readFileSync(logFile,'utf8').split('\n').filter(Boolean)){const e=JSON.parse(line);const expected=digest(`${prev}|${JSON.stringify({...e,hash:undefined})}`); // hash excluded from canonical check below
 const clone={...e};delete clone.hash;const calc=digest(`${prev}|${JSON.stringify(clone)}`);if(calc!==e.hash) return {ok:false,records:n,error:'HASH_MISMATCH'};prev=e.hash;n++}return {ok:true,records:n,lastHash:prev}}
function snapshot(){return {version:VERSION,localState:localState.size,readModels:[...readModels.keys()],adapters:[...adapters.keys()],queuedEvents:eventQueue.length,tenantLimits:tenantLimits.size,log:verifyLog()}}
function health(){const m=process.memoryUsage();return {ok:true,version:VERSION,pid:process.pid,uptimeSec:Math.round(process.uptime()),memory:{rss:m.rss,heapUsed:m.heapUsed,heapTotal:m.heapTotal},queue:eventQueue.length,adapters:adapters.size,log:verifyLog()}}
function drain(limit=100){return eventQueue.splice(0,Math.max(0,Number(limit)||100))}
function startTelemetry(intervalMs=30000){const t=setInterval(()=>{try{publish('runtime.telemetry',{health:health()})}catch{}},Math.max(5000,Number(intervalMs)||30000));t.unref?.();return t}
function queueProvisioning(spec){const tenantId=tenantKey(spec.tenantId);if(!throttle(tenantId,{type:'provision'}))throw new Error('TENANT_RATE_LIMITED');return publish('workspace.provision.requested',{spec},tenantId)}
function routeFulfillment(job){const provider=job.provider||job.vendor;const a=provider?adapters.get(String(provider)):null;return {jobId:job.id||null,provider:provider||null,adapterRegistered:!!a,status:a?'READY_FOR_ADAPTER':'AWAITING_VENDOR_ADAPTER'} }
module.exports={VERSION,events,emit,publish,mirror,readMirror,flushMirror,registerAdapter,resolveAdapter,setReadModel,getReadModel,tenantGuard,setTenantLimit,getTenantLimit,throttle,obfuscationManifest,encryptField,decryptField,tokenMap,verifyLog,snapshot,health,drain,startTelemetry,queueProvisioning,routeFulfillment};
