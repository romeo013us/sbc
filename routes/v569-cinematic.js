'use strict';
const V565=require('../enterprise/v565-operational-hardening');
const SEC=require('../enterprise/v569-production-expansion');
const VERSION='56.9.2';
function emitRuntimeEvent(event,context={}){
  const rec={id:`cin-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,timestamp:Date.now(),event,level:/threshold|owner|anomaly|error/i.test(event)?'WARN':'INFO',version:VERSION,component:'V569_CINEMATIC',context};
  try{
    global.__SBC_RECENT_RUNTIME_EVENTS=Array.isArray(global.__SBC_RECENT_RUNTIME_EVENTS)?global.__SBC_RECENT_RUNTIME_EVENTS:[];
    global.__SBC_RECENT_RUNTIME_EVENTS.push(rec);
    if(global.__SBC_RECENT_RUNTIME_EVENTS.length>500)global.__SBC_RECENT_RUNTIME_EVENTS.splice(0,global.__SBC_RECENT_RUNTIME_EVENTS.length-500);
  }catch{}
  return rec;
}
module.exports=function registerV569(app,{auth,ownerOnly}){
  app.get('/api/v569/cinematic/events',auth,(req,res)=>{
    const events=(global.__SBC_RECENT_RUNTIME_EVENTS||[]).filter(x=>/sequence|revenue|fulfillment|dropzone|kim|dunning|threshold|owner_clearance|anomaly/i.test(String(x.event||''))).slice(-100).reverse();
    res.json({ok:true,version:VERSION,events});
  });
  app.post('/api/v569/intelligence/evaluate-event',auth,(req,res)=>{
    const value=Number(req.body?.value||0);
    const transactionId=String(req.body?.transactionId||'').slice(0,120);
    const eventType=String(req.body?.eventType||'transaction').slice(0,80);
    const gate=V565.ownerThreshold(value,{threshold:10000});
    if(gate.requiresOwnerSignature){
      const lock=SEC.financialLock({action:eventType,amount:value,tenantId:global.__SBC_REQUIRE_TENANT(req),resourceId:transactionId,metadata:{source:'cinematic-threshold'}});
      const event=emitRuntimeEvent('threshold_breach',{eventType,transactionId,amount:value,status:'HELD_FOR_MANUAL_APPROVAL',lockId:lock.id});
      return res.status(202).json({ok:true,version:VERSION,status:'HELD_FOR_MANUAL_APPROVAL',threshold:true,ownerClearanceRequired:true,automationAllowed:false,lock,event});
    }
    return res.json({ok:true,version:VERSION,status:'AUTONOMOUS_PROCESSING',threshold:false,ownerClearanceRequired:false,automationAllowed:true});
  });
  app.get('/api/v569/cinematic/manifest',auth,ownerOnly,(req,res)=>res.json({ok:true,version:VERSION,patterns:['semantic-row-priority','ingestion-shimmer','kim-horizon','featured-threshold-canvas'],transport:'existing-authenticated-runtime-events',threshold:10000,policy:'UI never releases protected work; owner gate remains server-side.'}));
};
