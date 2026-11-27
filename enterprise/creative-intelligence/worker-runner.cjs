'use strict';
// Trusted local worker adapter. No HTTP listener, external provider, billing,
// publishing or device enrollment. Caller provides server-owned worker identity.
function createWorkerRunner({queue,service,getWorker,heartbeatMs=250}={}){
 if(!['claim','renew','complete','fail'].every(k=>typeof queue?.[k]==='function')||!['create','get'].every(k=>typeof service?.[k]==='function')||typeof getWorker!=='function'||!Number.isSafeInteger(heartbeatMs)||heartbeatMs<10||heartbeatMs>250)throw Error('INVALID_WORKER_RUNNER');
 let busy=false;
 async function runOnce(){
  if(busy)return {status:'busy'};
  busy=true;let timer,job,lost=false;
  try{
   job=queue.claim(getWorker());if(!job)return {status:'idle'};
   const scope={tenantId:job.tenantId,projectId:job.projectId},token=job.leaseToken;
   const renew=()=>{try{queue.renew(scope,job.id,token);}catch{lost=true;clearInterval(timer);}};
   timer=setInterval(renew,heartbeatMs);
   try{
    const output=await service.create(scope,job.request);
    if(lost)return {status:'lease-lost',jobId:job.id};
    if(typeof output?.asset?.id!=='string')throw Error('ASSET_NOT_VERIFIED');
    const completed=await queue.complete(scope,job.id,token,output.asset.id,service);
    return {status:'completed',job:completed};
   }catch(error){
    if(lost||error?.message==='LEASE_LOST')return {status:'lease-lost',jobId:job.id};
    const code=error?.message==='LOCAL_RENDER_UNAVAILABLE'?'RENDER_UNAVAILABLE':error?.message==='ASSET_NOT_VERIFIED'?'ASSET_NOT_VERIFIED':'RENDER_FAILED';
    try{const failed=queue.fail(scope,job.id,token,code);return {status:failed.status,job:failed};}
    catch(e){if(e?.message==='LEASE_LOST')return {status:'lease-lost',jobId:job.id};throw e;}
   }
  }finally{clearInterval(timer);busy=false;}
 }
 return Object.freeze({runOnce});
}
module.exports={createWorkerRunner};
