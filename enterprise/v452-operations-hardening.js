// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
const crypto=require('crypto');
const path=require('path');
const {Worker}=require('worker_threads');
const VERSION='45.2.0';
const WORKER=path.join(__dirname,'v452-runtime-worker.js');
function makeWorker(kind){
  return new Worker(WORKER,{workerData:{kind},resourceLimits:{maxOldGenerationSizeMb:32,maxYoungGenerationSizeMb:8,stackSizeMb:2}});
}
const cacheWorker=makeWorker('cache');
const telemetryWorker=makeWorker('telemetry');
const appendWorker=makeWorker('append');
const analyticsWorker=makeWorker('analytics');
const vendorWorker=makeWorker('vendor');
let seq=0;const pending=new Map();
function call(worker,op,payload,timeout=4000){return new Promise((resolve,reject)=>{const id=`${process.pid}:${++seq}:${crypto.randomBytes(4).toString('hex')}`;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`V452 worker timeout: ${op}`))},timeout);pending.set(id,{resolve,reject,timer});worker.postMessage({id,op,...payload})})}
for(const w of [cacheWorker,telemetryWorker,appendWorker,analyticsWorker,vendorWorker])w.on('message',m=>{const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.ok?p.resolve(m.result):p.reject(new Error(m.error||'V452 worker error'))});
for(const [name,w] of [['cache',cacheWorker],['telemetry',telemetryWorker],['append',appendWorker]])w.on('error',e=>console.warn(`[V452 ${name} worker]`,e.message));
function cacheGet(key){return call(cacheWorker,'get',{key},1000)}
function cacheSet(key,value,ttlMs){return call(cacheWorker,'set',{key,value,ttlMs},1000)}
function cacheDelete(key){return call(cacheWorker,'delete',{key},1000)}
function telemetry(event,meta={}){return call(telemetryWorker,'event',{event,meta},1500).catch(()=>false)}
function appendRecord(record){return call(appendWorker,'append',{record},2000)}
function analytics(payload){return call(analyticsWorker,'analyze',{payload},3000)}
function vendorDispatch(payload){return call(vendorWorker,'dispatch',{payload},3000)}
function saltedDigest(value,salt){const s=String(salt||crypto.randomBytes(16).toString('hex'));return {salt:s,digest:crypto.createHmac('sha256',s).update(JSON.stringify(value)).digest('hex')}}
function idempotencyKey(provider,job){const stable={provider:String(provider),orderId:String(job?.orderId||job?.id||''),customerId:String(job?.customerId||''),product:String(job?.product||''),quantity:Number(job?.quantity||1),requirements:job?.requirements||{}};return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex')}
function tenantPartition(tenantId,workspace){return `tenant:${Number(__sbcRequireTenantId(tenantId))}:${String(workspace||'core').replace(/[^a-z0-9:_-]/gi,'_')}`}
function rehydrationDigest(state){const safe={customers:(state?.customers||[]).map(x=>({id:x.id,status:x.status,tenantId:__sbcRequireTenantId(x.tenantId)})),users:(state?.users||[]).map(x=>({id:x.id,role:x.role,tenantId:__sbcRequireTenantId(x.tenantId)})),orders:(state?.orders||[]).map(x=>({id:x.id,status:x.status,customerId:x.customerId}))};return crypto.createHash('sha256').update(JSON.stringify(safe)).digest('hex')}
function verifyRehydration(before,after){return {ok:rehydrationDigest(before)===rehydrationDigest(after),before:rehydrationDigest(before),after:rehydrationDigest(after)}}
function memoryWatchdog(limitMb=Number(process.env.SBC_MEMORY_LIMIT_MB||384)){const used=process.memoryUsage();return {rssMb:Math.round(used.rss/1048576),heapUsedMb:Math.round(used.heapUsed/1048576),limitMb,pressure:used.rss/1048576>=limitMb*.85,critical:used.rss/1048576>=limitMb*.95}}
function shutdown(){for(const w of [cacheWorker,telemetryWorker,appendWorker,analyticsWorker,vendorWorker])w.terminate().catch(()=>{})}
module.exports={VERSION,cacheGet,cacheSet,cacheDelete,telemetry,appendRecord,analytics,vendorDispatch,saltedDigest,idempotencyKey,tenantPartition,rehydrationDigest,verifyRehydration,memoryWatchdog,shutdown};
