'use strict';
const R=require('../enterprise/v56134-god-tier-revenue');

module.exports=function registerV56134GodTier(app,{auth,ownerOnly,getContext,godKim,createFulfillmentJobsForOrder,processReadyFulfillmentJobs,vendorCapabilities,addActivity,audit,saveData}={}){
  const ctx=()=>getContext();
  app.get('/api/v56134/god-tier/overview',auth,(req,res)=>{
    try{const c=ctx();res.json({ok:true,...R.snapshot(c.db,c.vendorCapabilities||vendorCapabilities?.()||{})});}
    catch(e){res.status(500).json({ok:false,error:'God-Tier revenue overview unavailable.'});}
  });
  app.get('/api/v56134/god-tier/broadcast',auth,(req,res)=>{
    try{const c=ctx();const s=R.snapshot(c.db,c.vendorCapabilities||vendorCapabilities?.()||{});res.json({ok:true,broadcast:{ready:s.metrics.reconciliationCandidates===0&&s.metrics.orphanFulfillmentJobs===0,headline:'SBC REVENUE AUTOPILOT',metrics:s.metrics,capabilities:s.capabilities},generatedAt:s.generatedAt});}
    catch(e){res.status(500).json({ok:false,error:'Broadcast status unavailable.'});}
  });
  app.post('/api/v56134/god-tier/reconcile-paid',auth,ownerOnly,async(req,res)=>{
    try{
      const c=ctx();
      const out=await R.reconcilePaidOrders({db:c.db,godKim,createFulfillmentJobsForOrder,processReadyFulfillmentJobs,vendorCapabilities,addActivity,audit,saveData,limit:Math.min(20,Number(req.body?.limit||20)),requestUser:req.user||{id:'owner',name:'Owner'}});
      res.status(200).json(out);
    }catch(e){res.status(400).json({ok:false,error:e.message||'Revenue reconciliation failed.'});}
  });
};
module.exports._test=R;
