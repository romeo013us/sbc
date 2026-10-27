// SBC_V6648_TENANT_SCOPED_REVENUE
'use strict';
const R=require('../enterprise/v56140-90day-revenue-command');

module.exports=function register(app,{auth,ownerOnly,getContext,getKimMission}={}){
  const ctx=()=>getContext();
  app.get('/api/v56140/revenue-command/overview',auth,async(req,res)=>{
    try{const c=ctx();let recoveryCensus={mysqlCustomers:null,preservedLeadMesh:null,readOnly:true};if(c.recoveryRequired&&c.mysqlPool){try{const [[x]]=await c.mysqlPool.query('SELECT (SELECT COUNT(*) FROM sbc_customers) mysqlCustomers,(SELECT COUNT(*) FROM sbc_lead_mesh) preservedLeadMesh');recoveryCensus={mysqlCustomers:Number(x?.mysqlCustomers||0),preservedLeadMesh:Number(x?.preservedLeadMesh||0),readOnly:true};}catch{recoveryCensus.error='MYSQL_CENSUS_UNAVAILABLE';}}res.setHeader('Cache-Control','no-store');res.json({ok:true,...R.snapshot(c),recoveryRequired:Boolean(c.recoveryRequired),recoveryCensus});}
    catch(e){res.status(500).json({ok:false,error:'90-day revenue command unavailable.',message:String(e?.message||e)});}
  });

  app.post('/api/v56140/revenue-command/plan',auth,ownerOnly,async(req,res)=>{
    try{
      const c=ctx();
      const allowed=['targetRevenue','targetNewMrr','campaignDays','leadResearchPerDay','leadResearchDaysPerWeek','assumedAverageSale','startedAt'];
      const incoming={};
      for(const key of allowed)if(req.body?.[key]!==undefined){
        if(key==='startedAt')incoming[key]=String(req.body[key]);
        else incoming[key]=Math.max(0,Number(req.body[key]));
      }
      const plan=R.persistPlan(c.db,incoming);
      await c.saveData?.();
      c.audit?.({id:req.user?.id||'owner',name:req.user?.name||'Owner',role:req.user?.role||'owner'},'90_day_revenue_plan_updated','Updated SBC 90-day revenue command plan',{plan});
      res.json({ok:true,plan,...R.snapshot(c)});
    }catch(e){res.status(400).json({ok:false,error:'90-day plan could not be updated.',details:String(e.message||e)});}
  });

  app.post('/api/v56140/revenue-command/ai-prep',auth,ownerOnly,async(req,res)=>{
    try{
      const c=ctx();
      const controller=getKimMission?.();
      if(!controller)return res.status(503).json({ok:false,error:'Kim Mission Controller unavailable.'});
      const limit=Math.min(20,Math.max(1,Number(req.body?.limit||10)));
      const out=await controller.cycle({limit,reason:'90-day-revenue-ai-prep'});
      res.json({ok:true,mode:'AI_SALES_PREP',...out,command:R.snapshot(c)});
    }catch(e){res.status(400).json({ok:false,error:'AI sales preparation failed.',details:String(e.message||e)});}
  });

  app.post('/api/v56140/revenue-command/revenue-play',auth,ownerOnly,async(req,res)=>{
    try{
      const c=ctx();
      if(typeof c.runRevenueFirstPlay!=='function')return res.status(503).json({ok:false,error:'Existing Revenue PLAY rail unavailable.'});
      const limit=Math.min(20,Math.max(1,Number(req.body?.limit||10)));
      const out=await c.runRevenueFirstPlay({limit,reason:'90-day-revenue-command',tenantId:global.__SBC_REQUIRE_TENANT(req)});
      res.json({ok:true,mode:'REVENUE_PLAY',...out,command:R.snapshot(c)});
    }catch(e){res.status(400).json({ok:false,error:'Revenue PLAY failed.',details:String(e.message||e)});}
  });
};
module.exports.ENGINE=R;
