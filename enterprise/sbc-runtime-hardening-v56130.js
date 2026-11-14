'use strict';
const crypto=require('crypto');
const ASSET_POLICY=require('./v66155-public-asset-policy.cjs');
const DEFAULT_SLOW_MS=2500;
const DEFAULT_TIMEOUT_MS=120000;
const registry=new Map();
const recovery=new Map();
let shuttingDown=false;
const activeRequests=new Map();
function clean(v,n=200){return String(v??'').trim().slice(0,n)}
function now(){return new Date().toISOString()}
// Avoid logging query strings, contact names, lead IDs and tokens. Use Express
// route templates when available, otherwise a bounded allowlist path shape.
const SAFE_ROUTE_PARTS=new Set(['api','health','ready','status','me','login','logout','crm','leads','customers','customer','accounts','account','quotes','orders','payments','fulfillment','research','handoffs','feedback','training','courses','time','clock','voice','sessions','marketing','website-production','office-box','account-social','portfolio','channels','posts','approve','submit','schedule','return','verify','notifications','dashboard','metrics','system','integrations','workforce','reports','sales','calling','public','assets','index.html']);
function safeRouteLabel(req){
 const route=typeof req?.route?.path==='string'?req.route.path:'';
 if(route && route.length<=180 && /^\/[a-zA-Z0-9_:\/.\-]+$/.test(route) && !route.includes('..'))return route;
 const path=String(req?.path||req?.url||'').split(/[?#]/)[0];
 const chunks=path.split('/').filter(Boolean).slice(0,7);
 if(!chunks.length)return '/';
 return '/'+chunks.map(x=>{
  if(SAFE_ROUTE_PARTS.has(x))return x;
  if(/^v\d{1,6}$/.test(x))return x;
  return ':id';
 }).join('/');
}
function idKey(req){return clean(req.headers['x-sbc-idempotency-key']||req.headers['idempotency-key']||req.body?.eventId||req.body?.orderId||'',240)}
function shouldGuard(req){
  if(req.method!=='POST')return false;
  const p=String(req.path||req.originalUrl||'').toLowerCase();
  return /webhook|payment|fulfillment|commerce|order/.test(p) || Boolean(req.headers['x-sbc-idempotency-key']||req.headers['idempotency-key']);
}
function runtimeMiddleware({slowMs=DEFAULT_SLOW_MS,timeoutMs=DEFAULT_TIMEOUT_MS,onEvent=()=>{}}={}){
  return (req,res,next)=>{
    if(['GET','HEAD'].includes(String(req.method||'').toUpperCase()) && !String(req.path||req.url||'').startsWith('/api/') && ASSET_POLICY.denyPublicRequest(req.path||req.url))return res.status(404).end();
    const started=Date.now(); let timer=null; let completed=false;
    const requestId=req.requestId||crypto.randomUUID();
    activeRequests.set(requestId,{startedAt:started,method:req.method,path:safeRouteLabel(req)});
    const finish=()=>{if(completed)return;completed=true;if(timer)clearTimeout(timer);activeRequests.delete(requestId);const latency=Date.now()-started;const event={requestId,method:req.method,path:safeRouteLabel(req),status:res.statusCode,latencyMs:latency,at:now()};if(latency>slowMs){event.type='slow_request';try{console.warn('[SBC PERF] slow_request method='+String(req.method||'').slice(0,8)+' route='+event.path+' status='+event.status+' latencyMs='+latency+' requestId='+requestId)}catch(_){}onEvent(event)}};
    res.on('finish',finish);res.on('close',()=>{if(!res.writableEnded){onEvent({type:'request_aborted',requestId,method:req.method,path:safeRouteLabel(req),latencyMs:Date.now()-started,at:now()})}finish()});
    if(shuttingDown && shouldGuard(req)){onEvent({type:'request_rejected_shutdown',requestId,method:req.method,path:safeRouteLabel(req),at:now()});res.setHeader('Retry-After','5');return res.status(503).json({ok:false,error:'SBC is restarting safely; please retry shortly.',requestId})}
    if(timeoutMs>0 && /^(POST|PUT|PATCH|DELETE)$/.test(req.method)) timer=setTimeout(()=>{if(!res.headersSent){onEvent({type:'request_timeout_guard',requestId,method:req.method,path:safeRouteLabel(req),timeoutMs,at:now()});res.status(504).json({ok:false,error:'Request exceeded the production execution window; background recovery remains active.',requestId})}},timeoutMs);
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
module.exports={VERSION:'56.13.1',runtimeMiddleware,markRecovery,recoverySnapshot,clearExpired,idKey,safeRouteLabel,beginShutdown,isShuttingDown,waitForRequests,activeRequestSnapshot};
