'use strict';
const RETRYABLE=new Set([408,425,429,500,502,503,504]);
function createProviderFailover({providerConfig,submit,logger=console,consecutiveFailures=3,cooldownMs=30000,baseBackoffMs=250,maxBackoffMs=5000,jitterMs=250}={}){
 const state=new Map();
 function getState(provider){if(!state.has(provider))state.set(provider,{failures:0,state:'CLOSED',openedUntil:0,halfOpenProbe:false});return state.get(provider);}
 function recordSuccess(provider){const s=getState(provider);s.failures=0;s.state='CLOSED';s.openedUntil=0;s.halfOpenProbe=false;}
 function recordFailure(provider){const s=getState(provider);s.failures++;s.halfOpenProbe=false;if(s.failures>=consecutiveFailures){s.state='OPEN';s.openedUntil=Date.now()+cooldownMs;}}
 function circuit(provider){const s=getState(provider);if(s.state==='OPEN'&&Date.now()>=s.openedUntil){s.state='HALF-OPEN';s.halfOpenProbe=false;}return {state:s.state,open:s.state==='OPEN',until:s.openedUntil,failures:s.failures,probe:s.halfOpenProbe};}
 function backoff(attempt){const jitter=Math.floor(Math.random()*Math.max(0,jitterMs));return Math.min(maxBackoffMs,baseBackoffMs*Math.pow(2,Math.max(0,attempt-1))+jitter);}
 async function execute(job,{alternates=[]}={}){const tried=[];const candidates=[job.vendor,...alternates].filter((v,i,a)=>v&&a.indexOf(v)===i);for(const provider of candidates){const cap=providerConfig(provider);if(!cap?.configured||!cap?.autoExecution){tried.push({provider,status:'BLOCKED',reason:'provider not configured or auto-execution disabled'});continue;}const cb=circuit(provider);if(cb.state==='OPEN'){tried.push({provider,status:'CIRCUIT_OPEN',retryAfterMs:Math.max(0,cb.until-Date.now()),failures:cb.failures});continue;}if(cb.state==='HALF-OPEN'){const s=getState(provider);if(s.halfOpenProbe){tried.push({provider,status:'HALF_OPEN_PROBE_BUSY'});continue;}s.halfOpenProbe=true;tried.push({provider,status:'HALF_OPEN_PROBE'});}
   try{const out=await submit({...job,vendor:provider});recordSuccess(provider);return {ok:true,provider,tried:[...tried,{provider,status:'SUCCESS'}],result:out};}
   catch(e){const status=Number(e.httpStatus||0);const retryable=!status||RETRYABLE.has(status);tried.push({provider,status:'ERROR',retryable,error:String(e.message||e)});if(retryable){const s=getState(provider);const attempt=Math.max(1,s.failures+1);recordFailure(provider);if(s.state!=='OPEN'){const delay=backoff(attempt);tried.push({provider,status:'BACKOFF',delayMs:delay});await new Promise(r=>setTimeout(r,delay));}}if(status&&!RETRYABLE.has(status))break;}
 }
 return {ok:false,tried,reason:'No authorized provider completed the fulfillment request.',state:Object.fromEntries([...state].map(([k,v])=>[k,{state:v.state,failures:v.failures,open:v.state==='OPEN',openedUntil:v.openedUntil}]))};}
 return {execute,circuit,state:()=>Object.fromEntries([...state].map(([k,v])=>[k,{state:v.state,failures:v.failures,open:v.state==='OPEN',openedUntil:v.openedUntil}]))};
}
module.exports={createProviderFailover,RETRYABLE};
