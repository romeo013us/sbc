'use strict';
const {EliteHardening,callWindowGate,isolateObjection,discoveryTree,bus,VERSION,STATE}=require('../enterprise/sbc-elite-hardening-v56121');
const Runtime=require('../enterprise/sbc-runtime-hardening-v56130');
function registerV56121Hardening(app,{auth,ownerOnly,getContext={},onRuntimeEvent=()=>{}}={}){
  const ctx=()=>getContext?getContext():{};
  const hard=new EliteHardening({db:ctx().db,mysqlPool:ctx().mysqlPool,saveData:ctx().saveData,sendSms:ctx().sendSms,sendEmail:ctx().sendEmail});
  global.__SBC_ELITE_HARDENING=hard;
  global.__SBC_RUNTIME_HARDENING=Runtime;
  app.get('/api/v56121/hardening/status',auth,ownerOnly,async(req,res)=>{try{await hard.ensureTables();res.json({ok:true,version:'56.13.0',layers:{realtimeTelemetry:true,audioInterruption:true,discoveryTrees:true,multichannelHandshake:true,memoryVault:true,objectionIsolation:true,hotLeadFreeze:true,revenueLedger:true,abExperimentWorker:true,immutableExpenseLedger:true,slowRequestIsolation:true,duplicateWebhookGuard:true,requestRecovery:true},runtime:Runtime.recoverySnapshot(),telemetry:hard.snapshot(),callPolicy:'08:00-21:00 local baseline; DNC/consent/suppression gates remain mandatory'});}catch(e){res.status(500).json({ok:false,error:e.message})}});
  app.get('/api/v56121/runtime/status',auth,ownerOnly,(req,res)=>res.json({ok:true,version:'56.13.0',runtime:Runtime.recoverySnapshot()}));
  app.get('/api/v56121/telemetry',auth,ownerOnly,(req,res)=>res.json({ok:true,...hard.snapshot(),runtime:Runtime.recoverySnapshot()}));
  app.get('/api/v56121/telemetry/socket-ticket',auth,ownerOnly,(req,res)=>{const V451=require('../enterprise/v451-god-tier-telemetry');res.setHeader('Cache-Control','no-store');res.json({ok:true,...V451.issueTicket(req.user||{})});});
  app.post('/api/v56121/call-window/check',auth,ownerOnly,(req,res)=>res.json({ok:true,...callWindowGate(req.body?.customer||req.body||{},req.body?.at?new Date(req.body.at):new Date())}));
  app.post('/api/v56121/objection/detect',auth,(req,res)=>res.json({ok:true,...isolateObjection(req.body?.text||'')}));
  app.post('/api/v56121/discovery/tree',auth,(req,res)=>res.json({ok:true,...discoveryTree(req.body?.customer||{},req.body?.profile||{},Array.isArray(req.body?.history)?req.body.history:[])}));
  app.post('/api/v56121/memory/:leadId',auth,async(req,res)=>{try{const c=(ctx().db?.customers||[]).find(x=>String(x.id)===String(req.params.leadId));if(!c)return res.status(404).json({ok:false,error:'Lead not found.'});res.json({ok:true,memory:await hard.persistMemory(c,req.body||{})});}catch(e){res.status(400).json({ok:false,error:e.message})}});
  app.get('/api/v56121/memory/:leadId',auth,async(req,res)=>{try{res.json({ok:true,memory:await hard.memory(req.params.leadId,global.__SBC_REQUIRE_TENANT(req))});}catch(e){res.status(500).json({ok:false,error:e.message})}});
  app.post('/api/v56121/handshake/queue',auth,async(req,res)=>{try{const c=(ctx().db?.customers||[]).find(x=>String(x.id)===String(req.body?.leadId));if(!c)return res.status(404).json({ok:false,error:'Lead not found.'});const row=await hard.queueHandshake(c,String(req.body?.status||'NO_ANSWER'),req.body?.metadata||{});res.status(row.queued===false?409:201).json({ok:row.queued!==false,row});}catch(e){res.status(400).json({ok:false,error:e.message})}});
  app.get('/api/v56121/revenue/ledger',auth,ownerOnly,async(req,res)=>{try{const interactions=ctx().db?.eliteCloserInteractions||[];const calls=ctx().db?.aiCallSessions||[];const revenueEvents=ctx().db?.revenueContactEvents||[];const metrics=hard.ledgerMetrics({interactions,calls,revenueEvents});res.json({ok:true,version:'56.13.0',metrics,definition:'Outcome-driven metrics from recorded SBC events; no vendor claims are treated as proof.'});}catch(e){res.status(500).json({ok:false,error:e.message})}});
  global.__SBC_ELITE_TELEMETRY_BUS=bus; global.__SBC_ELITE_TELEMETRY_STATE=STATE;
}
module.exports=registerV56121Hardening;
module.exports.runtimeMiddleware=Runtime.runtimeMiddleware;
