'use strict';
// Optional dedicated local worker process. Never launched by the web server.
const {environmentRuntime}=require('./workspace.cjs');
const {setTimeout:delay}=require('node:timers/promises');
async function runWorker(runtime,{signal,intervalMs=1000,onError=()=>{}}={}){
 if(!runtime||typeof runtime.runner?.runOnce!=='function'||!Number.isSafeInteger(intervalMs)||intervalMs<100||intervalMs>60000)throw Error('INVALID_WORKER_SUPERVISOR');
 while(!signal?.aborted){let result;try{result=await runtime.runner.runOnce();}catch{onError('CREATIVE_WORKER_OPERATION_FAILED');}
  if(signal?.aborted)break;if(result?.status==='completed')continue;
  try{await delay(intervalMs,undefined,{signal});}catch(e){if(e.name!=='AbortError')throw e;}
 }
}
if(require.main===module){(async()=>{const runtime=environmentRuntime();if(!runtime)throw Error('CREATIVE_LOCAL_RENDERER_NOT_CONFIGURED');const controller=new AbortController();for(const name of ['SIGINT','SIGTERM'])process.once(name,()=>controller.abort());try{await runWorker(runtime,{signal:controller.signal,onError:code=>console.error(code)});}finally{runtime.close();}})().catch(()=>{console.error('CREATIVE_WORKER_START_FAILED');process.exitCode=1;});}
module.exports={runWorker};
