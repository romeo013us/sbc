'use strict';
const C=require('./sbc-campaign-core.cjs');
const {createStore}=require('./sbc-campaign-store.cjs');
function configuration(raw){
  if(!raw)return {mode:'external',from:null};
  const from=Date.parse(raw);
  if(!Number.isFinite(from)||from<C.ANCHOR||from!==C.currentSlot(from)||new Date(from).toISOString()!==raw)return {mode:'invalid',from:null};
  return {mode:'native',from};
}
function createWorker({tenant,getPool,canWrite,gateway,cutover,clock=Date.now,storeFor=createStore,log=()=>{},trackingOrigin}){
 let active=false,initializedPool;
 async function run(){
  const cfg=configuration(cutover());
  const pool=getPool(),now=clock(),slot=C.currentSlot(now);
  if(active||!pool||!canWrite()||cfg.mode!=='native'||slot<cfg.from)return;
  active=true;
  try{
   const db=storeFor(pool,tenant);
   if(initializedPool!==pool){await db.setup();initializedPool=pool;}
   const catalog=[...C.evergreen,...await db.catalog()];
   for(const platform of C.channels){
     const last=await db.latest(platform);
     // Record missed intervals in bounded batches, even after a prolonged outage.
     const start=Math.max(cfg.from,last===null?cfg.from:last+C.INTERVAL);
     const batch=[];
     for(let at=start;at<=slot&&batch.length<180;at+=C.INTERVAL){
       batch.push({...C.buildSlot(at,platform,catalog,trackingOrigin),missed:at<slot});
     }
     if(canWrite())await db.seed(batch);
   }
   if(!canWrite())return;
   await db.recover(now);
   const deliveryResults=await Promise.allSettled((await db.due(now)).map(async s=>{
     if(!canWrite()||s.at<cfg.from)return;
     const token=await db.claim(s,clock());if(!token)return;
     let dispatched=false;
     try{
       const p=await gateway.connect(s.platform),prepared=await gateway.prepare(s,p);
       if(!canWrite()||!await db.fence(s,token,clock()))return;
       dispatched=true;
       const id=await gateway.publish(s,p,prepared);
       if(canWrite())await db.settle(s,token,'ACCEPTED',null,clock(),id,clock());
     }catch(e){
       if(!canWrite())return;
       // A timeout or 5xx after the POST can mean success. Only explicit
       // rejection (including throttling) or a pre-dispatch failure is retried.
       const rejected=Number.isInteger(e.status)&&e.status>=400&&e.status<500&&e.status!==408;
       const state=dispatched&&!rejected?'UNKNOWN':'READY';
       const code=/^[A-Z][A-Z_0-9]{0,78}$/.test(e.code||'')?e.code:state==='UNKNOWN'?'AMBIGUOUS_DELIVERY':'PROVIDER_UNAVAILABLE';
       const wait=Math.min(900000,60000*2**Math.min(s.attempts,4));
       await db.settle(s,token,state,code,clock()+wait,null,clock());
     }
   }));
   if(deliveryResults.some(r=>r.status==='rejected'))log('campaign_delivery_store_error');
   if(!canWrite())return;
   const proofResults=await Promise.allSettled((await db.pending(clock())).map(async s=>{
     let id=s.providerId,verified=false;
     try{const p=await gateway.connect(s.platform);id=id||await gateway.discover(s,p);verified=Boolean(id&&await gateway.verify(s,p,id));}catch{}
     if(canWrite())await db.reconcile(s,id,verified,clock());
   }));
   if(proofResults.some(r=>r.status==='rejected'))log('campaign_readback_store_error');
  }finally{active=false;}
 }
 return {run};
}
module.exports={createWorker,configuration};
