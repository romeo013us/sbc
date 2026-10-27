/**
 * SBC V56.3.0 — Maturity Layer
 * Purpose: consolidate the strongest V56.2 ideas into clean, additive services.
 * No legacy engine is deleted or replaced here.
 */
'use strict';

const crypto = require('crypto');

function money(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
function safe(v,max=500){ return String(v??'').slice(0,max); }
function hash(value){ return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function iso(){ return new Date().toISOString(); }

function rowsResult(result){
  if(Array.isArray(result) && Array.isArray(result[0])) return result[0];
  return Array.isArray(result)?result:[];
}

function customerFromMemory(db,id){
  const list=Array.isArray(db?.customers)?db.customers:[];
  return list.find(c=>String(c.id)===String(id))||null;
}

function statusStage(status){
  const s=String(status||'').toLowerCase();
  if(['won','customer','active','paid','fulfilled'].includes(s)) return 'WON';
  if(['quote','quoted','proposal'].includes(s)) return 'QUOTE';
  if(['contacted','conversation','engaged','follow-up','followup'].includes(s)) return 'CONVERSATION';
  if(['verified','qualified','sales ready','sales_ready'].includes(s)) return 'VERIFIED';
  return 'LEAD';
}

async function query(pool, sql, params=[]){
  if(!pool) return [];
  try { return rowsResult(await pool.query(sql,params)); }
  catch(e){ return []; }
}

async function customer360(ctx, customerId){
  const id=String(customerId||'').trim();
  if(!id) throw new Error('customerId is required.');

  const memory=customerFromMemory(ctx.db,id);
  let profile=memory;
  let quotes=[], orders=[], renewals=[], activities=[];

  if(ctx.mysqlPool){
    const [p,q,o,r,a]=await Promise.all([
      query(ctx.mysqlPool,'SELECT * FROM sbc_customers WHERE id=? LIMIT 1',[id]),
      query(ctx.mysqlPool,'SELECT * FROM sbc_quotes WHERE customer_id=? ORDER BY created_at DESC LIMIT 20',[id]),
      query(ctx.mysqlPool,'SELECT * FROM sbc_orders WHERE customer_id=? ORDER BY created_at DESC LIMIT 20',[id]),
      query(ctx.mysqlPool,'SELECT * FROM sbc_renewals WHERE customer_id=? ORDER BY due_date ASC LIMIT 20',[id]),
      query(ctx.mysqlPool,'SELECT * FROM sbc_activities ORDER BY created_at DESC LIMIT 100',[])
    ]);
    if(p[0]) profile=p[0];
    quotes=q; orders=o; renewals=r;
    activities=a.filter(x=>{
      try{const m=typeof x.meta_json==='string'?JSON.parse(x.meta_json):x.meta_json;return String(m?.customerId||m?.customer_id||'')===id;}catch{return false;}
    });
  } else {
    quotes=(ctx.db.quotes||[]).filter(q=>String(q.customerId||q.customer_id||'')===id).slice(0,20);
    orders=(ctx.db.orders||[]).filter(o=>String(o.customerId||o.customer_id||'')===id).slice(0,20);
    renewals=(ctx.db.renewals||[]).filter(r=>String(r.customerId||r.customer_id||'')===id).slice(0,20);
    activities=(ctx.db.activities||[]).filter(a=>String(a.meta?.customerId||a.meta?.customer_id||'')===id).slice(0,100);
  }

  if(!profile) return null;

  const wonOrders=orders.filter(o=>['paid','won','fulfilled','in progress','ready'].includes(String(o.status||'').toLowerCase()));
  const openQuotes=quotes.filter(q=>!['won','accepted','expired','cancelled'].includes(String(q.status||'').toLowerCase()));
  const ltv=wonOrders.reduce((s,o)=>s+money(o.price??o.total),0);
  const pipeline=openQuotes.reduce((s,q)=>s+money(q.total),0);
  const touchpoints=[
    ...activities.map(a=>({epoch:a.created_at||a.createdAt,channel:a.activity_type||a.type||'SYSTEM',summary:a.message||'',actor:a.user_name||a.userName||'SBC'})),
    ...quotes.map(q=>({epoch:q.created_at||q.createdAt,channel:'QUOTE',summary:`Quote ${q.quote_number||q.quoteNumber||q.id} · $${money(q.total).toFixed(2)}`,actor:'SBC'})),
    ...orders.map(o=>({epoch:o.created_at||o.createdAt,channel:'ORDER',summary:`${o.product||o.name||'Order'} · ${String(o.status||'')}`,actor:'SBC'}))
  ].filter(x=>x.epoch).sort((a,b)=>new Date(b.epoch)-new Date(a.epoch)).slice(0,30);

  const score=customerScore(profile,touchpoints,openQuotes,pipeline);
  const nextBestAction=score>=80?'Contact now — high-confidence opportunity.'
    : openQuotes.length?'Advance the open quote before sourcing more leads.'
    : statusStage(profile.status||profile.conversion_state)==='WON'?'Review renewal / expansion opportunity.'
    :'Verify and qualify this account.';

  return {
    accountId:id,
    companyName:safe(profile.business_name||profile.businessName||profile.company_name||profile.contact_name||'Unnamed account',255),
    contactName:safe(profile.contact_name||profile.contactName,'255'),
    phone:safe(profile.phone||profile.phone_digits||'',80),
    email:safe(profile.email||profile.email_address||'',255),
    website:safe(profile.website||'',500),
    industry:safe(profile.industry||'',120),
    status:profile.status||profile.conversion_state||'Lead',
    score,
    nextBestAction,
    financials:{lifetimeValue:ltv,openPipeline:pipeline,completedOrders:wonOrders.length,mrr:money(profile.monthly_recurring_rate||profile.mrr)},
    counts:{quotes:quotes.length,openQuotes:openQuotes.length,orders:orders.length,renewals:renewals.length,touchpoints:touchpoints.length},
    timeline:touchpoints,
    leadIntelligence:profile.lead_intelligence_json||profile.leadIntelligence||null,
    generatedAt:iso()
  };
}

function customerScore(profile,timeline,openQuotes,pipeline){
  let score=45;
  score+=Math.min(20,timeline.length*2);
  score+=Math.min(20,openQuotes.length*7);
  if(pipeline>0) score+=10;
  const stage=statusStage(profile.status||profile.conversion_state);
  if(stage==='VERIFIED') score+=10;
  if(stage==='WON') score+=20;
  return Math.max(0,Math.min(100,score));
}

async function funnelTelemetry(ctx){
  let counts={};
  if(ctx.mysqlPool){
    const rows=await query(ctx.mysqlPool,'SELECT status, COUNT(*) AS tally FROM sbc_customers GROUP BY status');
    rows.forEach(r=>counts[String(r.status||'').toUpperCase()]=Number(r.tally||0));
  } else {
    (ctx.db.customers||[]).forEach(c=>{const k=String(c.status||'Lead').toUpperCase();counts[k]=(counts[k]||0)+1;});
  }
  const lead=Object.entries(counts).filter(([k])=>['LEAD','PROSPECT'].includes(k)).reduce((a,[,v])=>a+v,0);
  const conversation=Object.entries(counts).filter(([k])=>['CONTACTED','CONVERSATION','ENGAGED','FOLLOW-UP','FOLLOWUP'].includes(k)).reduce((a,[,v])=>a+v,0);
  const verified=Object.entries(counts).filter(([k])=>['VERIFIED','QUALIFIED','SALES READY','SALES_READY'].includes(k)).reduce((a,[,v])=>a+v,0);
  const won=Object.entries(counts).filter(([k])=>['WON','CUSTOMER','ACTIVE'].includes(k)).reduce((a,[,v])=>a+v,0);

  // Conservative fallbacks only when there is not enough observed volume.
  const ratios={
    leadToConversation:lead>0?conversation/lead:null,
    conversationToVerified:conversation>0?verified/conversation:null,
    verifiedToWon:verified>0?won/verified:null
  };
  const confidence=lead+conversation+verified+won>=30?'observed':'baseline';
  return {window:'current CRM state',counts:{lead,conversation,verified,won},ratios,confidence,generatedAt:iso()};
}

async function strategyPlan(ctx,{salesGoal=1,niche='',targetRevenue=0}={}){
  const goal=Math.max(1,Math.min(10000,Number(salesGoal)||1));
  const telemetry=await funnelTelemetry(ctx);
  const r=telemetry.ratios;
  const l2c=r.leadToConversation>0?r.leadToConversation:0.38;
  const c2v=r.conversationToVerified>0?r.conversationToVerified:0.31;
  const v2w=r.verifiedToWon>0?r.verifiedToWon:0.42;
  const winsNeeded=goal;
  const verifiedNeeded=Math.ceil(winsNeeded/v2w);
  const conversationsNeeded=Math.ceil(verifiedNeeded/c2v);
  const leadsNeeded=Math.ceil(conversationsNeeded/l2c);
  const gap=Math.max(0,leadsNeeded-telemetry.counts.lead-telemetry.counts.conversation-telemetry.counts.verified);
  const steps=[];
  if(telemetry.counts.verified>0) steps.push(`Work ${telemetry.counts.verified} verified opportunities before sourcing more.`);
  if(telemetry.counts.conversation<conversationsNeeded) steps.push(`Create ${Math.max(0,conversationsNeeded-telemetry.counts.conversation)} more qualified conversations.`);
  if(telemetry.counts.lead<leadsNeeded) steps.push(`Source/verify approximately ${Math.max(0,leadsNeeded-telemetry.counts.lead)} additional prospects.`);
  if(!steps.length) steps.push('Pipeline volume is sufficient; focus on conversion and fulfillment.');
  return {
    goal:{sales:goal,niche:safe(niche,120),targetRevenue:money(targetRevenue)},
    telemetry,
    projection:{leadsNeeded,conversationsNeeded,verifiedNeeded,winsNeeded},
    gap,
    nextBestActions:steps.slice(0,5),
    confidence:telemetry.confidence
  };
}

function buildCampaignToolkit({niche='local businesses',location='Miami, FL',salesGoal=10,offer='SBC Business Launch'}={}){
  const nicheSafe=safe(niche,120)||'local businesses';
  const loc=safe(location,120)||'Miami, FL';
  const goal=Math.max(1,Math.min(10000,Number(salesGoal)||10));
  return {
    campaignId:`GROWTH-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    objective:`Acquire ${goal} new ${nicheSafe} customers in ${loc}.`,
    audience:{niche:nicheSafe,location:loc},
    offer:safe(offer,255),
    funnel:{salesGoal:goal,planningModel:'learned CRM ratios with conservative fallbacks'},
    assets:{
      landing:{status:'DRAFT',purpose:'Offer and conversion page'},
      email:{status:'DRAFT',purpose:'Initial outreach + follow-up sequence'},
      sms:{status:'DRAFT',purpose:'Consent-safe qualified-prospect follow-up'},
      call:{status:'DRAFT',purpose:'Human sales conversation script'},
      tracking:{status:'READY',purpose:'Campaign ID / attribution anchor'}
    },
    governance:{deployment:'OWNER_APPROVAL_REQUIRED',external_send:'provider_policy_gate',high_value:'existing_owner_guardrails'},
    createdAt:iso()
  };
}

async function commitCampaign(ctx,campaign){
  const id=String(campaign?.campaignId||'');
  if(!id) throw new Error('campaignId is required.');
  const payload={...campaign,committedAt:iso()};
  if(ctx.mysqlPool){
    await ctx.mysqlPool.query(
      'INSERT INTO sbc_kim_growth_runs(id,tenant_id,automation_id,status,input_hash,result_json,started_at,finished_at) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE result_json=VALUES(result_json),status=VALUES(status),finished_at=VALUES(finished_at)',
      [id,1,'V563-GROWTH','QUEUED',hash(campaign),JSON.stringify(payload),new Date(),new Date()]
    );
  }
  if(ctx.audit) ctx.audit(ctx.user||{id:'system',name:'SBC System',role:'system'},'growth_campaign_queued',`Growth campaign ${id} queued for owner-controlled deployment.`,{campaignId:id});
  return {success:true,campaignId:id,status:'QUEUED',trackingToken:hash({id,at:Date.now()}).slice(0,24)};
}

async function stageProvider(ctx,{provider='4OVER4',jobId,orderManifest={}}={}){
  const p=String(provider).toUpperCase();
  if(!jobId) throw new Error('jobId is required.');
  if(!ctx.mysqlPool) return {success:true,mode:'LOCAL_STAGE',provider:p,jobId,status:'STAGED',liveSubmission:false};
  const idempotency=hash({provider:p,jobId,orderManifest});
  const row={
    id:`V563-${jobId}`,
    tenant_id:1,provider:p,job_id:String(jobId),attempts:0,status:'STAGED',
    idempotency_key:idempotency,request_json:JSON.stringify(orderManifest),response_json:'',last_error:''
  };
  await ctx.mysqlPool.query(
    'INSERT INTO sbc_vendor_outbox(id,tenant_id,provider,job_id,attempts,status,idempotency_key,request_json,response_json,last_error,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,NOW(),NOW()) ON DUPLICATE KEY UPDATE updated_at=NOW(),status="STAGED"',
    [row.id,row.tenant_id,row.provider,row.job_id,row.attempts,row.status,row.idempotency_key,row.request_json,row.response_json,row.last_error]
  );
  return {success:true,mode:'PROVIDER_OUTBOX',provider:p,jobId,status:'STAGED',liveSubmission:false,idempotencyKey:idempotency,note:'Staged only. No vendor endpoint is invented or called.'};
}

function communicationGate({channel='SMS',senderConfigured=false,explicitConsent=false,optOut=false}={}){
  const c=String(channel).toUpperCase();
  if(optOut) return {allowed:false,reason:'SUPPRESSED_OPT_OUT'};
  if(['SMS','MMS','TEXT'].includes(c) && !explicitConsent) return {allowed:false,reason:'EXPLICIT_SMS_CONSENT_REQUIRED'};
  if(!senderConfigured) return {allowed:false,reason:'OUTBOUND_PROVIDER_NOT_READY'};
  return {allowed:true,reason:'POLICY_GATE_PASSED'};
}

function operationalScore(ctx){
  const customers=Array.isArray(ctx.db.customers)?ctx.db.customers:[];
  const orders=Array.isArray(ctx.db.orders)?ctx.db.orders:[];
  const quotes=Array.isArray(ctx.db.quotes)?ctx.db.quotes:[];
  const active=customers.filter(c=>!['won','customer','active'].includes(String(c.status||'').toLowerCase())).length;
  const unworked=customers.filter(c=>['lead','prospect'].includes(String(c.status||'').toLowerCase())).length;
  const paidWork=orders.filter(o=>['paid','in progress','ready','processing'].includes(String(o.status||'').toLowerCase())).length;
  const openQuotes=quotes.filter(q=>!['won','accepted','expired','cancelled'].includes(String(q.status||'').toLowerCase())).length;
  const dataScore=customers.length?Math.min(100,70+(customers.filter(c=>c.email||c.phone).length/customers.length)*30):70;
  const executionScore=100-Math.min(60,unworked*2+Math.max(0,paidWork-20)*1);
  const score=Math.round((dataScore+executionScore+(openQuotes>=0?90:70))/3);
  return {score,signals:{customers:customers.length,activePipeline:active,unworked,paidWork,openQuotes},grade:score>=95?'TOP_TIER':score>=90?'STRONG':score>=80?'HEALTHY':'NEEDS_ATTENTION',generatedAt:iso()};
}

function registerRoutes(app,{auth,ownerOnly,getContext}){
  const ctx=()=>getContext();
  app.get('/api/v56/intel/customer-360/:id',auth,async(req,res)=>{
    try{const data=await customer360(ctx(),req.params.id);if(!data)return res.status(404).json({ok:false,error:'Customer not found.'});res.json({ok:true,version:'56.3.0',data});}
    catch(e){res.status(400).json({ok:false,error:e.message});}
  });
  app.get('/api/v56/intel/funnel',auth,async(req,res)=>{
    try{res.json({ok:true,version:'56.3.0',data:await funnelTelemetry(ctx())});}catch(e){res.status(500).json({ok:false,error:e.message});}
  });
  app.post('/api/v56/intel/strategy',auth,async(req,res)=>{
    try{res.json({ok:true,version:'56.3.0',data:await strategyPlan(ctx(),req.body||{})});}catch(e){res.status(400).json({ok:false,error:e.message});}
  });
  app.get('/api/v56/ops/score',auth,async(req,res)=>{
    try{res.json({ok:true,version:'56.3.0',data:operationalScore(ctx())});}catch(e){res.status(500).json({ok:false,error:e.message});}
  });
  app.post('/api/v56/growth/toolkit',auth,async(req,res)=>{
    try{res.json({ok:true,version:'56.3.0',data:buildCampaignToolkit(req.body||{})});}catch(e){res.status(400).json({ok:false,error:e.message});}
  });
  app.post('/api/v56/growth/deploy',auth,ownerOnly,async(req,res)=>{
    try{res.status(202).json({ok:true,version:'56.3.0',data:await commitCampaign(ctx(),req.body?.campaign||req.body||{})});}catch(e){res.status(400).json({ok:false,error:e.message});}
  });
  app.post('/api/v56/delivery/provider/stage',auth,ownerOnly,async(req,res)=>{
    try{res.status(202).json({ok:true,version:'56.3.0',data:await stageProvider(ctx(),req.body||{})});}catch(e){res.status(400).json({ok:false,error:e.message});}
  });
  app.post('/api/v56/communications/gate',auth,async(req,res)=>{
    try{res.json({ok:true,version:'56.3.0',data:communicationGate(req.body||{})});}catch(e){res.status(400).json({ok:false,error:e.message});}
  });
  app.get('/api/v56/facade/manifest',auth,(req,res)=>{
    res.json({ok:true,version:'56.3.0',domains:[
      {domain:'crm',routes:['/api/v56/intel/customer-360/:id']},
      {domain:'growth',routes:['/api/v56/growth/toolkit','/api/v56/growth/deploy']},
      {domain:'delivery',routes:['/api/v56/delivery/provider/stage']},
      {domain:'intel',routes:['/api/v56/intel/funnel','/api/v56/intel/strategy']},
      {domain:'ops',routes:['/api/v56/ops/score']},
      {domain:'communications',routes:['/api/v56/communications/gate']}
    ]});
  });
}

module.exports={
  customer360,funnelTelemetry,strategyPlan,buildCampaignToolkit,commitCampaign,stageProvider,
  communicationGate,operationalScore,registerRoutes,customerScore
};
