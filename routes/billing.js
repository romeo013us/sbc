'use strict';
const RAILS=require('../enterprise/v566-scale-revenue-rails');
const V562=require('../enterprise/v562-next-architecture');
module.exports=function registerBilling(app,{auth,getContext}){
  app.post('/api/v566/billing/recovery',auth,async(req,res)=>{try{const plan=RAILS.subscriptionRecovery(req.body||{});if(!plan.eligible)return res.json({ok:true,version:RAILS.VERSION,data:plan});const durable=V562.billingFriction(req.body||{});res.status(202).json({ok:true,version:RAILS.VERSION,data:{...plan,durable}});}catch(e){res.status(400).json({ok:false,error:e.message});}});
};
