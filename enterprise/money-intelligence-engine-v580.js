'use strict';
const crypto = require('crypto');
const VERSION = '58.0.0-MONEY-INTELLIGENCE';
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));
const hash=(x)=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');

function expectedRevenue({dealValue=0,probability=0,cost=0,monthly=0,months=12}={}){
  const value=Math.max(0,Number(dealValue)||0)+(Math.max(0,Number(monthly)||0)*Math.max(0,Number(months)||12));
  const p=clamp(probability,0,1);
  return {grossValue:Number(value.toFixed(2)),expectedRevenue:Number((value*p).toFixed(2)),expectedContribution:Number(((value-Math.max(0,Number(cost)||0))*p).toFixed(2)),probability:p};
}
function revenuePrediction(x={}){
  const fit=clamp(x.fitScore??50),intent=clamp(x.intentScore??40),engagement=clamp(x.engagementScore??35),contactability=clamp(x.contactabilityScore??35),urgency=clamp(x.urgencyScore??45),history=clamp(x.historyScore??50),risk=clamp(x.riskScore??0);
  const probability=clamp((fit*.18+intent*.24+engagement*.18+contactability*.12+urgency*.12+history*.10-risk*.20)/100,0,1);
  return {...expectedRevenue({dealValue:x.dealValue,probability,cost:x.cost,monthly:x.monthly,months:x.months}),probabilityPct:Number((probability*100).toFixed(1)),signals:{fit,intent,engagement,contactability,urgency,history,risk}};
}
function opportunityHunter(db={}){
  const customers=Array.isArray(db.customers)?db.customers:[];
  const quotes=Array.isArray(db.quotes)?db.quotes:[];
  const orders=Array.isArray(db.orders)?db.orders:[];
  const renewals=Array.isArray(db.renewals)?db.renewals:[];
  const out=[]; const now=Date.now();
  for(const c of customers){
    const id=String(c.id||c.email||c.businessName||''); if(!id) continue;
    const customerOrders=orders.filter(o=>String(o.customerId||'')===String(c.id));
    const customerQuotes=quotes.filter(q=>String(q.customerId||'')===String(c.id));
    const openQuote=customerQuotes.find(q=>!['paid','accepted','lost','expired'].includes(String(q.status||'').toLowerCase()));
    const last=Date.parse(c.updatedAt||c.createdAt||'')||0;
    const dormant=last>0 && now-last>30*86400000;
    const services=String(c.services||c.products||c.notes||'').toLowerCase();
    const missing=['email','security','backup','seo'].filter(s=>!services.includes(s));
    if(openQuote) out.push({id:`quote:${openQuote.id}`,customerId:c.id,type:'UNPAID_PROPOSAL',reason:'Proposal/quote remains open.',dealValue:Number(openQuote.total||0),urgencyScore:88,historyScore:80});
    if(dormant && customerOrders.length) out.push({id:`dormant:${id}`,customerId:c.id,type:'REACTIVATION',reason:'Existing customer has gone dormant.',dealValue:customerOrders.reduce((n,o)=>n+Number(o.price||o.total||0),0)||349,urgencyScore:65,historyScore:95});
    if(missing.length) out.push({id:`upsell:${id}`,customerId:c.id,type:'EXPANSION',reason:`Missing services: ${missing.join(', ')}`,dealValue:Math.max(199,missing.length*199),urgencyScore:60,historyScore:90});
  }
  const seen=new Set(); return out.filter(o=>{if(seen.has(o.id))return false;seen.add(o.id);return true;}).map(o=>({...o,prediction:revenuePrediction(o)})).sort((a,b)=>b.prediction.expectedRevenue-a.prediction.expectedRevenue);
}
function nextBestAction(x={}){
  const state=String(x.state||x.status||'NEW').toUpperCase();
  if(['SUPPRESSED','LOST'].includes(state))return {action:'NO_ACTION',priority:'LOW',reason:'Opportunity is suppressed or lost.'};
  if(x.paymentStarted&&!x.paid)return {action:'CHECKOUT_RECOVERY',priority:'CRITICAL',reason:'Purchase intent exists without payment.'};
  if(x.proposalViewed&&!x.accepted)return {action:'PROPOSAL_FOLLOW_UP',priority:'HIGH',reason:'Proposal viewed without acceptance.'};
  if(x.dormant)return {action:'REACTIVATE_CUSTOMER',priority:'HIGH',reason:'Existing customer is dormant.'};
  if(x.missingServices?.length)return {action:'PREPARE_UPSELL',priority:'HIGH',reason:'Existing customer has expansion opportunities.'};
  if(Number(x.probabilityPct||0)>=90)return {action:'CONTACT_NOW',priority:'CRITICAL',reason:'Highest expected-conversion opportunity.'};
  if(Number(x.probabilityPct||0)>=75)return {action:'CONTACT_TODAY',priority:'HIGH',reason:'Sales-ready opportunity.'};
  return {action:'NURTURE',priority:'NORMAL',reason:'No higher-confidence action available.'};
}
function moneyNow(opportunities=[],limit=10){return [...opportunities].sort((a,b)=>Number(b.prediction?.expectedRevenue||0)-Number(a.prediction?.expectedRevenue||0)).slice(0,Math.max(1,Math.min(50,Number(limit)||10))).map(o=>({...o,nextAction:nextBestAction({...o,...o.prediction})}));}
function adaptiveScheduler({queueDepth=0,avgLatencyMs=0,errorRatePct=0,dbUtilizationPct=0,maxWorkers=1}={}){
  const safeMax=Math.max(1,Number(maxWorkers)||1); let workers=1;
  if(errorRatePct>10||dbUtilizationPct>85) workers=1;
  else if(queueDepth>100) workers=Math.min(safeMax,Math.max(3,Math.ceil(queueDepth/50)));
  else if(queueDepth>25) workers=Math.min(safeMax,2);
  if(avgLatencyMs>5000) workers=Math.min(workers,safeMax>1?Math.max(1,Math.floor(safeMax/2)):1);
  return {workers,mode:workers===1?'PROTECT':'SCALE',reason:errorRatePct>10||dbUtilizationPct>85?'Protect database/provider health':'Match worker concurrency to queue pressure'};
}
function aiBudgetDecision({task='normal',estimatedTokens=0,dailySpent=0,dailyBudget=5,expectedRevenue=0}={}){
  const remaining=Math.max(0,Number(dailyBudget)-Number(dailySpent)); const value=Math.max(0,Number(expectedRevenue));
  if(remaining<=0)return {allowed:false,tier:'CHEAP',reason:'AI_DAILY_BUDGET_EXHAUSTED'};
  const highValue=value>=500, complex=['deep','analysis','research'].includes(String(task).toLowerCase());
  const tier=highValue&&complex?'PREMIUM':complex?'STANDARD':'CHEAP';
  const estimatedCost=Math.max(.001,(Number(estimatedTokens)||0)/1000000*(tier==='PREMIUM'?.15:tier==='STANDARD'?.05:.01));
  return {allowed:estimatedCost<=remaining,tier,estimatedCost:Number(estimatedCost.toFixed(4)),remainingAfter:Number(Math.max(0,remaining-estimatedCost).toFixed(4)),roiGuard:value>0?Number((value/estimatedCost).toFixed(1)):0};
}
function customerLTV({orders=[],renewals=[],customerId,monthlyRecurring=0,months=12}={}){
 const os=orders.filter(o=>String(o.customerId)===String(customerId)); const rs=renewals.filter(r=>String(r.customerId)===String(customerId));
 const historical=os.reduce((n,o)=>n+Number(o.price||o.total||0),0); const renewal=rs.reduce((n,r)=>n+Number(r.amount||0),0); const projected=Number(monthlyRecurring||0)*Number(months||12);
 return {customerId,historicalRevenue:Number(historical.toFixed(2)),renewalValue:Number(renewal.toFixed(2)),projectedRecurring:Number(projected.toFixed(2)),estimatedLTV:Number((historical+renewal+projected).toFixed(2))};
}
function sequenceOptimizer(events=[]){
 const buckets={}; for(const e of events){const key=`${e.channel||'unknown'}:${e.hour??'na'}`;const b=buckets[key]||(buckets[key]={attempts:0,responses:0,conversions:0,revenue:0});b.attempts++;if(e.responded)b.responses++;if(e.converted)b.conversions++;b.revenue+=Number(e.revenue||0);}
 return Object.entries(buckets).map(([key,b])=>({...b,key,responseRatePct:b.attempts?Number((b.responses/b.attempts*100).toFixed(1)):0,conversionRatePct:b.attempts?Number((b.conversions/b.attempts*100).toFixed(1)):0,revenuePerAttempt:b.attempts?Number((b.revenue/b.attempts).toFixed(2)):0})).sort((a,b)=>b.revenuePerAttempt-a.revenuePerAttempt);
}
function anomalyDetect(metrics={},baseline={}){const alerts=[]; for(const [k,v] of Object.entries(metrics)){const base=Number(baseline[k]);const n=Number(v);if(!Number.isFinite(base)||base<=0||!Number.isFinite(n))continue;const pct=(n-base)/base*100;if(pct>=100)alerts.push({metric:k,value:n,baseline:base,changePct:Number(pct.toFixed(1)),severity:pct>=300?'CRITICAL':'HIGH'});}return {healthy:alerts.length===0,alerts};}
function ceoBrief({moneyNow=[],pipeline=0,collected=0,bottleneck='',score=0}={}){const top=moneyNow[0]||null;return {version:VERSION,headline:'SBC MONEY INTELLIGENCE ENGINE',collected:Number(collected||0),pipeline:Number(pipeline||0),moneyMachineScore:Number(score||0),topOpportunity:top,bottleneck:bottleneck||'No blocking bottleneck detected.',recommendedAction:top?.nextAction||{action:'BUILD_PIPELINE',priority:'NORMAL',reason:'No eligible opportunity detected.'},generatedAt:new Date().toISOString()};}
function commandIntent(text=''){const t=String(text).toLowerCase(); if(/make money|money now|top opportunities/.test(t))return 'MONEY_NOW'; if(/morning|brief|ceo/.test(t))return 'CEO_BRIEF'; if(/anomal/.test(t))return 'ANOMALIES'; if(/worker|scale/.test(t))return 'WORKER_STATUS'; if(/ltv|lifetime/.test(t))return 'LTV'; return 'HELP';}
function idempotencyKey(scope,payload){return `${scope}:${hash(payload)}`;}
module.exports={VERSION,opportunityHunter,revenuePrediction,expectedRevenue,nextBestAction,moneyNow,adaptiveScheduler,aiBudgetDecision,customerLTV,sequenceOptimizer,anomalyDetect,ceoBrief,commandIntent,idempotencyKey};
