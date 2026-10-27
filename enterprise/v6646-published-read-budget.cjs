'use strict';
// SBC V6646: production-only API read deadlines and sanitized owner telemetry.
// No DB writes, mutation timeouts, provider activity, altered session or lease semantics.
const {monitorEventLoopDelay,performance}=require('node:perf_hooks');
const EXEMPT=/\/(stream|sse|events|export|download|backup|websocket|voice-media)(\/|$)/i;
function routeGroup(p){
 const s=String(p||'').split('?')[0].split('/').filter(Boolean).slice(0,4)
  .map((v,i)=>i===0?'api':(/^\d+$/.test(v)||v.length>42||/^[a-f0-9-]{24,}$/i.test(v)?':id':v.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,36)));
 return '/'+s.join('/');
}
function createReadBudget({role='readonly',timeoutMs=12000,slowMs=2500,clock=()=>Date.now(),timers={set:setTimeout,clear:clearTimeout},histogram=true}={}){
 const limit=Math.max(1000,Math.min(20000,Number(timeoutMs)||12000));
 const maxStats=30,slowSamples=[],groups=new Map();
 let inflight=0,maxInflight=0,timeouts=0,requests=0,overBudget=0;
 let delay=null,enabled=false;
 if(role==='writer'&&histogram){try{delay=monitorEventLoopDelay({resolution:20});delay.enable();enabled=true;}catch{}}
 function middleware(req,res,next){
  if(role!=='writer'||req.method!=='GET'||!String(req.path||'').startsWith('/api/')||EXEMPT.test(req.path))return next();
  const started=clock(),group=routeGroup(req.path);
  requests++;inflight++;maxInflight=Math.max(inflight,maxInflight);
  let finished=false,timer;
  const finish=()=>{
   if(finished)return;
   finished=true;if(timer!==undefined)timers.clear(timer);inflight=Math.max(0,inflight-1);
   const duration=Math.max(0,clock()-started);
   let row=groups.get(group);
   if(!row){row={count:0,slow:0,timeouts:0,maxMs:0};groups.set(group,row);}
   row.count++;row.maxMs=Math.max(row.maxMs,duration);
   if(duration>slowMs){overBudget++;row.slow++;slowSamples.push({route:group,latencyMs:duration,status:res.statusCode||0});
     if(slowSamples.length>maxStats)slowSamples.shift();}
   if(res.statusCode===504)row.timeouts++;
   if(groups.size>100)groups.delete(groups.keys().next().value);
  };
  res.once('finish',finish);res.once('close',finish);
  timer=timers.set(()=>{
   if(finished||res.headersSent||res.writableEnded)return;
   timeouts++;
   res.setHeader('Cache-Control','no-store');
   res.status(504).json({ok:false,code:'SBC_PUBLISHED_READ_TIMEOUT',retryable:true,
     error:'Dashboard read exceeded the response deadline. No changes were made.'});
   // The legacy async GET handler may finish after the deadline. Suppress late
   // writes on this completed response to prevent ERR_HTTP_HEADERS_SENT
   // from crashing the Published process. Do NOT abort or cancel any DB work.
   const noFurtherWrite=()=>res;
   for(const name of ['json','send','sendStatus','redirect','setHeader','writeHead','end']){
     if(typeof res[name]==='function')res[name]=noFurtherWrite;
   }
   if(typeof res.write==='function')res.write=()=>false;
  },limit);
  timer?.unref?.();
  next();
 }
 function snapshot(){
  const worst=[...groups].map(([route,v])=>({route,...v})).sort((a,b)=>b.maxMs-a.maxMs).slice(0,12);
  const n=delay?{meanMs:Number.isFinite(delay.mean)?Math.round(delay.mean/1e6):null,
    p99Ms:Number.isFinite(delay.percentile(99))?Math.round(delay.percentile(99)/1e6):null}:null;
  const mem=process.memoryUsage();
  return {enabled:role==='writer',role,readTimeoutMs:limit,requests,inflight,maxInflight,timeouts,
   overBudgetReads:overBudget,eventLoopLag:n,memory:{rssMb:Math.round(mem.rss/1048576),
   heapUsedMb:Math.round(mem.heapUsed/1048576)},topSlowRoutes:worst,
   recentSlowReads:slowSamples.slice(-15),
   scope:'In-process API read timing; no query strings, tokens, request bodies, usernames or SQL. Diagnostic only.',
   limits:'Server-side work already started may continue after a 504. Live browser traces are still required.'};
 }
 return {middleware,snapshot,routeGroup};
}
module.exports={createReadBudget,routeGroup};
