'use strict';
const {EliteCloser,OBJECTIONS,STYLES,PLAYBOOKS}=require('../enterprise/sbc-elite-closer-v5612');

function registerV5612EliteCloser(app,{auth,ownerOnly,getContext={}}={}){
  const ctx=()=>getContext?getContext():{};
  const elite=new EliteCloser(ctx());
  const customerFor=id=>(ctx().db?.customers||[]).find(x=>String(x.id)===String(id));
  const revenueCloser=ctx().revenueCloser;
  const eligibility=c=>revenueCloser?.eligibility?revenueCloser.eligibility(c,{policy:'strict'}):{allowed:false,reasons:['REVENUE_CLOSER_UNAVAILABLE']};

  app.get('/api/v5612/elite-closer/status',auth,ownerOnly,async(req,res)=>{try{await elite.ensureTables();const b=await elite.benchmark(global.__SBC_REQUIRE_TENANT(req));const arena=await elite.arenaReport(global.__SBC_REQUIRE_TENANT(req));res.json({ok:true,version:'56.12.2',identity:'AI SALES REPRESENTATIVE / REVENUE CLOSER',mode:'sales-outcome-first',automaticIntelligence:true,automaticDispatch:String(process.env.SBC_ELITE_CLOSER_AUTO_DISPATCH||'false').toLowerCase()==='true',openaiRealtimeModel:String(process.env.SBC_AI_VOICE_MODEL||'gpt-realtime-2.1'),capabilities:['industry-playbooks','adaptive-sales-style','discovery-engine','pain-impact-mapping','dynamic-offer','objection-intelligence','trial-close','close-or-handoff','persistent-memory','closer-arena','revenue-benchmark','automatic-queue-ranking','post-call-coaching'],benchmark:b,arena});}catch(e){res.status(500).json({ok:false,error:e.message})}});

  app.get('/api/v5612/elite-closer/benchmark',auth,async(req,res)=>{try{res.json({ok:true,version:'56.12.2',benchmark:await elite.benchmark(global.__SBC_REQUIRE_TENANT(req)),arena:await elite.arenaReport(global.__SBC_REQUIRE_TENANT(req))})}catch(e){res.status(500).json({ok:false,error:e.message})}});

  app.post('/api/v5612/elite-closer/profile/:leadId',auth,async(req,res)=>{try{const c=customerFor(req.params.leadId);if(!c)return res.status(404).json({ok:false,error:'Lead not found.'});await elite.ensureTables();const p=await elite.upsertProfile(c,{history:req.body?.history||[]});res.json({ok:true,version:'56.12.2',profile:p,prompt:elite.prompt(c,p,{transcript:req.body?.transcript||'',objection:req.body?.objection||''})});}catch(e){res.status(400).json({ok:false,error:e.message})}});

  app.post('/api/v5612/elite-closer/queue/rebuild',auth,ownerOnly,async(req,res)=>{try{const leads=(ctx().db?.customers||[]).filter(c=>String(c.status||'').toLowerCase()!=='do not contact');const queue=await elite.buildQueue(leads,c=>eligibility(c),global.__SBC_REQUIRE_TENANT(req));res.json({ok:true,version:'56.12.2',count:queue.length,eligible:queue.filter(x=>x.eligible).length,queue:queue.slice(0,20)})}catch(e){res.status(500).json({ok:false,error:e.message})}});

  app.get('/api/v5612/elite-closer/queue',auth,async(req,res)=>{try{await elite.ensureTables();if(elite.pool){const [rows]=await elite.pool.query('SELECT * FROM sbc_elite_closer_queue WHERE tenant_id=? ORDER BY priority_score DESC LIMIT 50',[global.__SBC_REQUIRE_TENANT(req)]);return res.json({ok:true,queue:rows});}res.json({ok:true,queue:(elite.db.eliteCloserQueue||[]).slice(0,50)});}catch(e){res.status(500).json({ok:false,error:e.message})}});

  app.post('/api/v5612/elite-closer/next-best-action/:leadId',auth,async(req,res)=>{try{const c=customerFor(req.params.leadId);if(!c)return res.status(404).json({ok:false,error:'Lead not found.'});const p=await elite.upsertProfile(c,{history:req.body?.history||[]});const e=eligibility(c);res.json({ok:true,leadId:c.id,eligible:e.allowed,eligibility:e,profile:p,action:e.allowed?(p.intentScore>=88?'CALL_TO_CLOSE':'DISCOVERY_CALL'):'WAIT_FOR_ELIGIBILITY'});}catch(e){res.status(400).json({ok:false,error:e.message})}});

  app.post('/api/v5612/elite-closer/interaction',auth,async(req,res)=>{try{await elite.ensureTables();const row=await elite.recordInteraction(req.body||{});if(revenueCloser?.recordEvent){await revenueCloser.recordEvent({leadId:row.leadId,tenantId:row.tenantId,eventType:req.body?.outcome==='WON'?'SALE_WON':'CONVERSATION',channel:row.channelType,outcome:row.outcome,amount:row.revenue,metadata:{eliteCloser:true,style:row.style,stage:row.stage}});}res.status(201).json({ok:true,row});}catch(e){res.status(400).json({ok:false,error:e.message})}});

  app.get('/api/v5612/elite-closer/arena',auth,async(req,res)=>{try{res.json({ok:true,...await elite.arenaReport(global.__SBC_REQUIRE_TENANT(req))})}catch(e){res.status(500).json({ok:false,error:e.message})}});

  app.post('/api/v5612/elite-closer/objection',auth,async(req,res)=>{const key=String(req.body?.key||'').toUpperCase();res.json({ok:true,objection:OBJECTIONS[key]||null,known:Object.keys(OBJECTIONS)})});

  app.get('/api/v5612/elite-closer/playbooks',auth,async(req,res)=>res.json({ok:true,playbooks:PLAYBOOKS,styles:STYLES}));

  global.__SBC_ELITE_CLOSER=elite;
}

module.exports=registerV5612EliteCloser;
