'use strict';
const crypto=require('crypto');
const DEFAULT_SLOW_MS=2500;
const DEFAULT_TIMEOUT_MS=120000;
const registry=new Map();
const recovery=new Map();
let shuttingDown=false;
const activeRequests=new Map();
function clean(v,n=200){return String(v??'').trim().slice(0,n)}
function now(){return new Date().toISOString()}
function idKey(req){return clean(req.headers['x-sbc-idempotency-key']||req.headers['idempotency-key']||req.body?.eventId||req.body?.orderId||'',240)}
function shouldGuard(req){
  if(req.method!=='POST')return false;
  const p=String(req.path||req.originalUrl||'').toLowerCase();
  return /webhook|payment|fulfillment|commerce|order/.test(p) || Boolean(req.headers['x-sbc-idempotency-key']||req.headers['idempotency-key']);
}
function runtimeMiddleware({slowMs=DEFAULT_SLOW_MS,timeoutMs=DEFAULT_TIMEOUT_MS,onEvent=()=>{}}={}){
  return (req,res,next)=>{
    const started=Date.now(); let timer=null; let completed=false;
    const requestId=req.requestId||crypto.randomUUID();
    activeRequests.set(requestId,{startedAt:started,method:req.method,path:req.originalUrl||req.path});
    const finish=()=>{if(completed)return;completed=true;if(timer)clearTimeout(timer);activeRequests.delete(requestId);const latency=Date.now()-started;const event={requestId,method:req.method,path:req.originalUrl||req.path,status:res.statusCode,latencyMs:latency,at:now()};if(latency>slowMs){event.type='slow_request';onEvent(event)}};
    res.on('finish',finish);res.on('close',()=>{if(!res.writableEnded){onEvent({type:'request_aborted',requestId,method:req.method,path:req.originalUrl||req.path,latencyMs:Date.now()-started,at:now()})}finish()});
    if(shuttingDown && shouldGuard(req)){onEvent({type:'request_rejected_shutdown',requestId,method:req.method,path:req.originalUrl||req.path,at:now()});res.setHeader('Retry-After','5');return res.status(503).json({ok:false,error:'SBC is restarting safely; please retry shortly.',requestId})}
    if(timeoutMs>0 && /^(POST|PUT|PATCH|DELETE)$/.test(req.method)) timer=setTimeout(()=>{if(!res.headersSent){onEvent({type:'request_timeout_guard',requestId,method:req.method,path:req.originalUrl||req.path,timeoutMs,at:now()});res.status(504).json({ok:false,error:'Request exceeded the production execution window; background recovery remains active.',requestId})}},timeoutMs);
    if(shouldGuard(req)){
      const key=idKey(req);
      if(key){const hit=registry.get(key);if(hit && hit.expiresAt>Date.now()){onEvent({type:'duplicate_event_blocked',key,requestId,originalRequestId:hit.requestId,at:now()});return res.status(409).json({ok:false,error:'Duplicate event already accepted.',idempotencyKey:key})} registry.set(key,{requestId,expiresAt:Date.now()+3600000});if(registry.size>5000){for(const [k,v] of registry){if(v.expiresAt<=Date.now())registry.delete(k);if(registry.size<=4000)break}}}
    }
    req.sbcRuntime={startedAt:started,requestId,idempotencyKey:idKey(req)};
    next();
  };
}
function beginShutdown(){shuttingDown=true;return {activeRequests:activeRequests.size,at:now()};}
function isShuttingDown(){return shuttingDown;}
async function waitForRequests(timeoutMs=10000){const deadline=Date.now()+Math.max(0,Number(timeoutMs)||0);while(activeRequests.size && Date.now()<deadline)await new Promise(r=>setTimeout(r,50));return {activeRequests:activeRequests.size,drained:activeRequests.size===0,at:now()};}
function activeRequestSnapshot(){return Array.from(activeRequests.entries()).map(([requestId,v])=>({requestId,...v}));}

function markRecovery(key,state,meta={}){if(!key)return;recovery.set(clean(key,240),{state,meta,updatedAt:now()});if(recovery.size>5000)recovery.delete(recovery.keys().next().value)}
function recoverySnapshot(){return {registrySize:registry.size,recoverySize:recovery.size,at:now()}}
function clearExpired(){const t=Date.now();for(const [k,v] of registry)if(v.expiresAt<=t)registry.delete(k)}
module.exports={VERSION:'56.13.1',runtimeMiddleware,markRecovery,recoverySnapshot,clearExpired,idKey,beginShutdown,isShuttingDown,waitForRequests,activeRequestSnapshot};
