'use strict';
const RAILS=require('../enterprise/v566-scale-revenue-rails');
const V563=require('../enterprise/v563-maturity-layer');
module.exports=function registerDelivery(app,{auth,ownerOnly,getContext,vendorCapabilities,fulfillmentAdapterFor}){
  app.post('/api/v566/delivery/provider/plan',auth,ownerOnly,async(req,res)=>{try{const b=req.body||{};const caps=vendorCapabilities?.()||{};const p=String(b.provider||'').toLowerCase();const cap=p==='4over4'?caps.fourOverFour:p==='vistaprint'?caps.vistaPrint:caps[p]||{};const data=RAILS.providerPlan({provider:p,job:b.job||{},value:b.value||b.job?.value||0,configured:Boolean(cap?.configured),adapterRegistered:Boolean(fulfillmentAdapterFor?.(p)),credentialsAvailable:Boolean(cap?.configured)});res.status(202).json({ok:true,version:RAILS.VERSION,data});}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/v566/delivery/provider/stage',auth,ownerOnly,async(req,res)=>{try{const b=req.body||{};const data=await V563.stageProvider(getContext(),b);res.status(202).json({ok:true,version:RAILS.VERSION,data});}catch(e){res.status(400).json({ok:false,error:e.message});}});
};
