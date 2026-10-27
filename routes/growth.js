'use strict';
const RAILS=require('../enterprise/v566-scale-revenue-rails');
const V563=require('../enterprise/v563-maturity-layer');
module.exports=function registerGrowth(app,{auth,ownerOnly,getContext}){
  app.post('/api/v566/growth/factory',auth,async(req,res)=>{try{res.json({ok:true,version:RAILS.VERSION,data:RAILS.growthFactory(req.body||{})});}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/v566/growth/strategy',auth,async(req,res)=>{try{res.json({ok:true,version:RAILS.VERSION,data:await V563.strategyPlan(getContext(),req.body||{})});}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/v566/growth/deploy',auth,ownerOnly,async(req,res)=>{try{res.status(202).json({ok:true,version:RAILS.VERSION,data:await V563.commitCampaign(getContext(),req.body?.campaign||req.body||{})});}catch(e){res.status(400).json({ok:false,error:e.message});}});
};
