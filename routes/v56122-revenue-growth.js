'use strict';
const {RevenueGrowthEngine}=require('../enterprise/sbc-revenue-growth-v56122');
function registerV56122RevenueGrowth(app,{auth,ownerOnly,getContext={}}={}){
  const ctx=()=>getContext?getContext():{};
  const engine=new RevenueGrowthEngine(ctx());
  global.__SBC_REVENUE_GROWTH=engine;
  app.get('/api/v56122/revenue-growth/status',auth,ownerOnly,async(req,res)=>{try{res.json({ok:true,version:'56.13.0',identity:'REVENUE GROWTH ENGINE',automaticPlanning:true,automaticExecution:String(process.env.SBC_REVENUE_GROWTH_AUTO_EXECUTE||'false').toLowerCase()==='true',practices:['lead-quality-gate','speed-to-lead','next-best-action','offer-ladder','objection-recovery','follow-up-cadence','win-back','expansion-referrals','continuous-experimentation','unit-economics-capacity']})}catch(e){res.status(500).json({ok:false,error:e.message})}});
  app.get('/api/v56122/revenue-growth/dashboard',auth,ownerOnly,async(req,res)=>{try{const out=await engine.dashboard(global.__SBC_REQUIRE_TENANT(req));const hard=ctx().hardening||global.__SBC_ELITE_HARDENING;const ledger=hard?hard.ledgerMetrics({interactions:ctx().db?.eliteCloserInteractions||[],calls:ctx().db?.aiCallSessions||[],revenueEvents:ctx().db?.revenueContactEvents||[]}):{};const interactions=ctx().db?.eliteCloserInteractions||[];const objectionWins=interactions.filter(x=>/OBJECTION_RESOLVED|OBJECTION_WON|SALE|WON|CLOSED/i.test(String(x.outcome||''))).length;const objections=interactions.filter(x=>/OBJECTION/i.test(String(x.outcome||''))).length;out.metrics={...(out.metrics||{}),revenuePerAIHour:ledger.revenuePerAIHour||0,aiHours:ledger.aiHours||0,objectionWinRate:objections?objectionWins/objections:0};res.json(out);}catch(e){res.status(500).json({ok:false,error:e.message})}});
  app.post('/api/v56122/revenue-growth/cycle',auth,ownerOnly,async(req,res)=>{try{const auto=String(process.env.SBC_REVENUE_GROWTH_AUTO_EXECUTE||'false').toLowerCase()==='true';res.json(await engine.cycle({tenantId:global.__SBC_REQUIRE_TENANT(req),limit:req.body?.limit||100,auto}));}catch(e){res.status(500).json({ok:false,error:e.message})}});
}
module.exports=registerV56122RevenueGrowth;
