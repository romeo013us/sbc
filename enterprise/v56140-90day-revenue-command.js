'use strict';

/**
 * SBC V56.14.0 — 90-Day Revenue Command
 *
 * Strategic control layer for the $100K / 90-day campaign.
 * This module does not create a payment rail, fulfillment rail, or second
 * outbound dispatcher. It measures the existing rails and gives the owner
 * one operating target, one funnel, and one AI-sales control surface.
 */

const VERSION='56.14.0-90DAY-REVENUE';
const DEFAULT_PLAN=Object.freeze({
  targetRevenue:100000,
  targetNewMrr:10000,
  campaignDays:90,
  leadResearchPerDay:15,
  leadResearchDaysPerWeek:5,
  averageWorkDaysPerMonth:22,
  firstSalesHire:'AI-first / human closer on demand'
});

function now(){return new Date().toISOString();}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function clean(v,n=500){return String(v??'').replace(/[\u0000]/g,'').trim().slice(0,n);}
function asDate(v){const d=new Date(v||0);return Number.isFinite(d.getTime())?d:null;}
function within(d,start){return d && d.getTime()>=start.getTime();}
function paidOrder(o){
  return /PAID|COMPLETED|FULFILLED/i.test(String(o?.paymentStatus||o?.status||''));
}
function paidAt(o){return asDate(o?.paidAt||o?.completedAt||o?.updatedAt||o?.createdAt);}
function money(n){return Number(num(n).toFixed(2));}
function monthlyFromOrder(o){
  return num(o?.metadata?.monthlyRecurring||o?.monthlyRecurring||o?.recurringAmount||o?.mrr);
}
function uniqueMonthlyCustomers(orders,start){
  const by=new Map();
  for(const o of orders||[]){
    if(!paidOrder(o))continue;
    const d=paidAt(o); if(!within(d,start))continue;
    const m=monthlyFromOrder(o); if(m<=0)continue;
    const key=String(o.customerId||o.customerName||o.id);
    by.set(key,Math.max(by.get(key)||0,m));
  }
  return money([...by.values()].reduce((a,b)=>a+b,0));
}
function observedLeadActivity(db){
  const events=Array.isArray(db?.revenueContactEvents)?db.revenueContactEvents:[];
  const out={attempts:0,contacts:0,conversations:0,offers:0,sales:0,revenue:0,appointments:0};
  for(const e of events){
    const t=String(e.eventType||'').toUpperCase();
    if(t==='CALL_ATTEMPT'||t==='CONTACT'||t==='SMS_SENT'||t==='EMAIL_SENT')out.attempts++;
    if(t==='CALL_CONNECTED'||t==='CONTACT')out.contacts++;
    if(t==='CONVERSATION')out.conversations++;
    if(t==='OFFER_EXTENDED'||t==='QUOTE_SENT')out.offers++;
    if(t==='APPOINTMENT'||t==='APPOINTMENT_SET')out.appointments++;
    if(t==='SALE_WON'){out.sales++;out.revenue+=num(e.amount);}
  }
  return {...out,revenue:money(out.revenue)};
}
function funnel(customers,activity){
  const rows=Array.isArray(customers)?customers:[];
  const verified=rows.filter(c=>String(c.verificationStatus||'').toLowerCase().includes('verified')||String(c.verificationStatus||'').toLowerCase()==='sales ready'||c.verified===true);
  const warmHot=rows.filter(c=>['warm','hot'].includes(String(c.leadTemperature||'').toLowerCase()));
  const salesReady=rows.filter(c=>String(c.verificationStatus||'').toLowerCase()==='sales ready');
  const active=rows.filter(c=>!['customer','active_customer','fulfilled','lost','do not contact','do not call'].includes(String(c.status||'').toLowerCase()));
  return {
    totalProspects:rows.length,
    activeProspects:active.length,
    verified:verified.length,
    warmHot:warmHot.length,
    salesReady:salesReady.length,
    contactedObserved:num(activity.contacts),
    conversationsObserved:num(activity.conversations),
    appointmentsObserved:num(activity.appointments),
    offersObserved:num(activity.offers),
    salesObserved:num(activity.sales)
  };
}
function offerLadder(catalog){
  const all=[...(Array.isArray(catalog?.packages)?catalog.packages:[]),...(Array.isArray(catalog?.services)?catalog.services:[])];
  const find=(terms)=>all.find(x=>terms.some(t=>String(x.id||'').toLowerCase()===t||String(x.name||'').toLowerCase().includes(t)));
  const pick=[
    find(['sbc-99-starter','business starter']),
    find(['sbc-199-starter']),
    find(['sbc-349-essentials','business essentials']),
    find(['sbc-699-complete','sbc complete business launch','complete business']),
    find(['officebox_starter','office box starter']),
    find(['officebox_business','office box business']),
    find(['officebox_professional','office box professional']),
    find(['officebox_team','office box team'])
  ].filter(Boolean);
  const seen=new Set();
  return pick.filter(x=>{const k=String(x.id||x.name);if(seen.has(k))return false;seen.add(k);return true;})
    .map(x=>({sku:String(x.id||''),name:String(x.name||''),price:money(x.price),unit:String(x.unit||''),category:String(x.category||'')}));
}
function aiSalesStatus(){
  const openai=Boolean(process.env.OPENAI_API_KEY);
  const twilio=Boolean(
    process.env.SBC_TWILIO_ACCOUNT_SID&&
    process.env.SBC_TWILIO_AUTH_TOKEN&&
    (process.env.SBC_TWILIO_FROM||process.env.TWILIO_PHONE_NUMBER)
  );
  const voiceConsent=String(process.env.SBC_AI_OUTBOUND_POLICY||'strict').toLowerCase();
  const autonomousOutbound=String(process.env.SBC_KIM_MISSION_AUTONOMOUS_OUTBOUND||'false').toLowerCase()==='true';
  return {
    openaiConfigured:openai,
    twilioConfigured:twilio,
    consultativeEngine:true,
    tenBrain:true,
    revenueCloser:true,
    kimMission:true,
    voicePolicy:voiceConsent,
    autonomousOutbound,
    mode:openai?'READY':'STANDBY',
    recommendation:openai
      ? (autonomousOutbound?'AUTONOMOUS_OUTBOUND_ENABLED':'AI-ASSISTED / OWNER-CONTROLLED OUTBOUND')
      : 'CONNECT EXISTING OPENAI PROVIDER'
  };
}
function buildPlan(db,catalog,overrides={}){
  const plan={...DEFAULT_PLAN,...(db?.sbc90RevenuePlan||{}),...overrides};
  const start=asDate(plan.startedAt)||new Date();
  const end=new Date(start.getTime()+Number(plan.campaignDays)*86400000);
  const orders=Array.isArray(db?.orders)?db.orders:[];
  const campaignOrders=orders.filter(o=>paidOrder(o)&&within(paidAt(o),start));
  const collected=money(campaignOrders.reduce((a,o)=>a+num(o.price||o.total),0));
  const newMrr=uniqueMonthlyCustomers(orders,start);
  const customers=Array.isArray(db?.customers)?db.customers:[];
  const activity=observedLeadActivity(db);
  const f=funnel(customers,activity);
  const projectedLeads=Math.round(Number(plan.leadResearchPerDay)*Number(plan.leadResearchDaysPerWeek)*(Number(plan.campaignDays)/7));
  const daysElapsed=Math.max(1,Math.min(Number(plan.campaignDays),Math.ceil((Date.now()-start.getTime())/86400000)));
  const daysRemaining=Math.max(0,Number(plan.campaignDays)-daysElapsed);
  const revenueGap=Math.max(0,Number(plan.targetRevenue)-collected);
  const mrrGap=Math.max(0,Number(plan.targetNewMrr)-newMrr);
  const paceRequired=daysRemaining>0?money(revenueGap/daysRemaining):revenueGap;
  const leadsPerWorkDay=Number(plan.leadResearchPerDay);
  const requiredCloseCount=Math.ceil(revenueGap/Math.max(1,Number(plan.assumedAverageSale||699)));
  const status=collected>=Number(plan.targetRevenue)?'TARGET_REACHED':daysRemaining===0?'CAMPAIGN_COMPLETE':'IN_PROGRESS';
  return {
    version:VERSION,
    plan:{...plan,startedAt:start.toISOString(),endsAt:end.toISOString()},
    scorecard:{
      status,targetRevenue:money(plan.targetRevenue),collectedRevenue:collected,revenueGap:money(revenueGap),
      targetNewMrr:money(plan.targetNewMrr),observedNewMrr:money(newMrr),mrrGap:money(mrrGap),
      revenuePct:Number(Math.min(100,(collected/Math.max(1,Number(plan.targetRevenue)))*100).toFixed(1)),
      mrrPct:Number(Math.min(100,(newMrr/Math.max(1,Number(plan.targetNewMrr)))*100).toFixed(1)),
      daysElapsed,daysRemaining,requiredRevenuePerRemainingDay:paceRequired
    },
    acquisition:{
      lornaDailyTarget:leadsPerWorkDay,
      projected90DayLeads:projectedLeads,
      currentLeadPool:f.totalProspects,
      warmHot:f.warmHot,
      salesReady:f.salesReady,
      funnel:f
    },
    salesMath:{
      assumedAverageSale:money(plan.assumedAverageSale||699),
      requiredAdditionalCustomers:requiredCloseCount,
      projectedInitialRevenueAtTargetCustomers:money(requiredCloseCount*Number(plan.assumedAverageSale||699)),
      note:'Planning math only; actual conversion and revenue remain telemetry-driven.'
    },
    observedActivity:activity,
    offers:offerLadder(catalog),
    aiSales:aiSalesStatus(),
    existingRails:{
      revenuePlayCap:20,
      consultativeSolutionGraph:true,
      kimMissionController:true,
      squareCheckout:true,
      godKimFulfillment:true,
      lornaLeadPipeline:true
    },
    nextActions:[
      f.salesReady>0?`Work ${Math.min(20,f.salesReady)} Sales Ready prospects through the existing AI/Revenue PLAY rail.`:'Increase verified Sales Ready inventory before increasing lead volume.',
      activity.offers>0?'Follow up every open offer before sourcing additional volume.':'Generate the first observed offers from the existing sales-ready pool.',
      newMrr<Number(plan.targetNewMrr)?'Attach a recurring service to every qualified solution where the canonical catalog supports it.':'Protect and expand recurring revenue.',
      'Use AI for repetitive discovery/follow-up and escalate high-intent, negotiated, or protected decisions to a human.'
    ]
  };
}
function snapshot(ctx={}){
  return buildPlan(ctx.db||{},ctx.catalog||{},ctx.plan||{});
}
function persistPlan(db,plan){
  db.sbc90RevenuePlan={...(db.sbc90RevenuePlan||{}),...plan,updatedAt:now()};
  return db.sbc90RevenuePlan;
}
module.exports={VERSION,DEFAULT_PLAN,snapshot,buildPlan,persistPlan,aiSalesStatus,offerLadder};
