'use strict';
const RAILS=require('../enterprise/v566-scale-revenue-rails');
const V565=require('../enterprise/v565-operational-hardening');
module.exports=function registerIntelligence(app,{auth,getContext}){
  app.get('/api/v566/intelligence/funnel-90d',auth,async(req,res)=>{try{const ctx=getContext();const data=V565.learnedFunnel90d(ctx,{days:90});res.json({ok:true,version:RAILS.VERSION,data});}catch(e){res.status(500).json({ok:false,error:e.message});}});
  app.get('/api/v566/intelligence/capacity',auth,async(req,res)=>{try{res.json({ok:true,version:RAILS.VERSION,data:RAILS.capacity(getContext().db)});}catch(e){res.status(500).json({ok:false,error:e.message});}});
};
