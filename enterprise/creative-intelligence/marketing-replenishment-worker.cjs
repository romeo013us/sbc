'use strict';
// Trusted offline coordinator only. Uses the existing private Creative Studio queue.
const fs=require('node:fs/promises'),{constants}=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {planReplenishment}=require('./marketing-inventory.cjs'),{loadInventoryInputs}=require('./marketing-inventory-storage.cjs');
const hash=b=>createHash('sha256').update(b).digest('hex'),isHash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s),lock='sbc:runtime:writer:v1';
async function verifyPinnedBrandLogo(filename,expected){
 if(typeof filename!=='string'||!path.isAbsolute(filename)||!isHash(expected)||!constants.O_NOFOLLOW)throw Error('LOGO_INTEGRITY');
 let fh;try{fh=await fs.open(filename,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const stat=await fh.stat(),max=4*1024*1024;if(!stat.isFile()||stat.size<33||stat.size>max)throw Error('LOGO_INTEGRITY');const b=Buffer.alloc(stat.size+1);let n=0;while(n<b.length){const r=await fh.read(b,n,b.length-n,n);if(!r.bytesRead)break;n+=r.bytesRead;}const bytes=b.subarray(0,n);if(n!==stat.size||hash(bytes)!==expected||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR')throw Error('LOGO_INTEGRITY');const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);if(width<32||height<32||width>4096||height>4096)throw Error('LOGO_INTEGRITY');return {sha256:expected,width,height};}catch(e){throw Error('LOGO_INTEGRITY',{cause:e});}finally{if(fh)await fh.close();}
}
const palettes={engagement:'midnight',education:'forest',sales:'ink',motivation:'midnight',showcase:'ink',community:'forest'};
function requestFor(c,format,language){const copy=c.copy?.[language];if(!copy||!Object.hasOwn(palettes,c.category)||typeof copy.headline!=='string'||typeof copy.detail!=='string'||typeof copy.cta!=='string')throw Error('INVALID_REPLENISHMENT_COPY');return {kind:'template-image',design:{format,brand:'Successful By Choice',headline:copy.headline,detail:copy.detail,cta:copy.cta,palette:palettes[c.category]},alt:'SBC: '+copy.headline};}
function createReplenishmentWorker({conn,tenantId,bank,logoPath,logoSha256,queue,reviews,writer,assertWriter,ffmpeg,ffprobe,outputRoot,clock=Date.now,days=3,maxTasks=4,language='en',loadInputs=loadInventoryInputs}={}){
 if(!Number.isSafeInteger(tenantId)||tenantId<1||!isHash(logoSha256)||!['en','es'].includes(language)||!Number.isInteger(days)||days<1||days>7||!Number.isInteger(maxTasks)||maxTasks<1||maxTasks>12||typeof conn?.execute!=='function'||!['submit','findByKey'].every(k=>typeof queue?.[k]==='function')||typeof reviews?.get!=='function'||typeof writer?.recordStage!=='function'||![assertWriter,clock,loadInputs].every(f=>typeof f==='function')||![logoPath,ffmpeg,ffprobe,outputRoot].every(p=>typeof p==='string'&&path.isAbsolute(p)))throw Error('INVALID_REPLENISHMENT_CONFIG');
 const pinnedBank=JSON.parse(JSON.stringify(bank)),scope={tenantId,projectId:'sbc-marketing'};let busy=false,halted=false;
 async function fence(){if(await assertWriter()!==true)throw Error('REPLENISHMENT_WRITER_REQUIRED');const [[r]]=await conn.execute('SELECT IS_USED_LOCK(?)=CONNECTION_ID() AS held',[lock]);if(Number(r?.held)!==1)throw Error('REPLENISHMENT_WRITER_REQUIRED');}
 async function runCycle(){
  if(halted)throw Error('REPLENISHMENT_RECONCILIATION_REQUIRED');if(busy)return {status:'busy',publicationReady:false};busy=true;let writing=false;
  try{
   await fence();await verifyPinnedBrandLogo(logoPath,logoSha256);const now=clock(),inputs=await loadInputs(conn,{tenantId,bank:pinnedBank,logoSha256,reviews,now});if(inputs.logoSha256!==logoSha256)throw Error('INVALID_REPLENISHMENT_INPUTS');
   const plan=planReplenishment({...inputs,bank:pinnedBank,logoSha256,now,days}),campaigns=new Map([...pinnedBank.holiday,...pinnedBank.campaigns].map(c=>[c.slug,c])),used=new Set(inputs.usedSourceIds),sources=new Map(inputs.assets.map(a=>[a.sourceAssetId,a.slug])),digests=new Set(inputs.assets.map(a=>a.sha256));const tasks=[];let mutations=0;
   for(const task of plan.feedTasks){const result={slug:task.slug,format:task.format,dueLocal:task.dueLocal};if(task.action!=='produce'){tasks.push({...result,status:'operator_action',action:task.action});continue;}
    const request=requestFor(campaigns.get(task.slug),task.format,language),key=hash(JSON.stringify(['sbc-replenishment-v1',task.slug,task.dueLocal,logoSha256,language,request]));let job=queue.findByKey(scope,request,key);
    if(!job){if(mutations>=maxTasks){tasks.push({...result,status:'capacity_deferred'});continue;}await fence();writing=true;job=queue.submit(scope,request,key);writing=false;mutations++;tasks.push({...result,jobId:job.id,status:'queued'});continue;}
    const base={...result,jobId:job.id};if(job.status!=='completed'){tasks.push({...base,status:job.status==='failed'?'operator_action':'awaiting_render',...(job.status==='failed'?{action:'review_failed_job'}:{})});continue;}
    const review=reviews.get(scope,job.id);if(review?.state!=='approved'||review.assetId!==job.assetId){tasks.push({...base,status:'awaiting_source_review'});continue;}
    if(used.has(job.assetId)||(sources.has(job.assetId)&&sources.get(job.assetId)!==task.slug)){tasks.push({...base,status:'operator_action',action:'replace_used_creative'});continue;}
    if(mutations>=maxTasks){tasks.push({...base,status:'capacity_deferred'});continue;}
    await fence();writing=true;mutations++;const stage=await require('./social-jpeg.cjs').stageSocialJpeg({reviews,tenantId,jobId:job.id,ffmpeg,ffprobe,logoPath,logoSha256,outputRoot,format:task.format});if(digests.has(stage.sha256)){writing=false;tasks.push({...base,status:'operator_action',action:'replace_duplicate_jpeg'});continue;}
    await fence();const receipt=await writer.recordStage({slug:task.slug,format:task.format,jobId:job.id,expectedRevision:0,stage});if(receipt?.status!=='REVISION_RECORDED'||receipt.revision!==1)throw Error('REPLENISHMENT_STAGE_NOT_CONFIRMED');writing=false;sources.set(stage.sourceAssetId,task.slug);digests.add(stage.sha256);tasks.push({...base,status:'awaiting_final_review',sha256:stage.sha256});
   }
   return {status:'cycle_complete',tasks,optionalTasks:plan.optionalTasks.length,publicationReady:false};
  }catch(e){if(writing)halted=true;throw e;}finally{busy=false;}
 }
 return Object.freeze({runCycle});
}
module.exports={createReplenishmentWorker,verifyPinnedBrandLogo};
