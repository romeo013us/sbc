'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const VERSION = '64.1.0';
const ID = () => `v64_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
const num = (v,d=0) => Number.isFinite(Number(v)) ? Number(v) : d;
const pct = (v,d=0) => Math.max(0,Math.min(100,num(v,d)));

function summarizeDb(db={}) {
  const arr=(k)=>Array.isArray(db?.[k])?db[k]:[];
  const leads=arr('leads'), orders=arr('orders'), customers=arr('customers'), quotes=arr('quotes');
  const warm=leads.filter(x=>/warm/i.test(String(x?.temperature||x?.leadTemperature||x?.status||''))).length;
  const hot=leads.filter(x=>/hot/i.test(String(x?.temperature||x?.leadTemperature||x?.status||''))).length;
  const paid=orders.filter(x=>/paid|complete|completed/i.test(String(x?.status||'')));
  const revenue=paid.reduce((s,o)=>s+num(o?.paidAmount ?? o?.amountPaid ?? o?.totalPaid ?? o?.total),0);
  const gross=paid.reduce((s,o)=>s+num(o?.grossProfit),0);
  const backlog=arr('fulfillmentJobs').filter(x=>!/(complete|cancel|deliver)/i.test(String(x?.status||''))).length;
  const overdue=arr('actions').filter(x=>x?.dueAt&&new Date(x.dueAt)<new Date()&&!/(done|complete)/i.test(String(x.status||''))).length;
  return {leads:leads.length,warmLeads:warm,hotLeads:hot,customers:customers.length,quotes:quotes.length,orders:orders.length,paidOrders:paid.length,collectedRevenue:revenue,grossProfit:gross,fulfillmentBacklog:backlog,overdueActions:overdue,cashAvailable:num(db?.cashAvailable),timestamp:new Date().toISOString()};
}

function makeTwin(snapshot) {
  const conversionBase=snapshot.leads?((snapshot.paidOrders/snapshot.leads)*100):0;
  const avgOrder=snapshot.paidOrders?snapshot.collectedRevenue/snapshot.paidOrders:0;
  return {
    identity:'SBC OS DIGITAL TWIN', version:VERSION,
    business:{...snapshot,conversionRatePct:Number(conversionBase.toFixed(2)),averageCollectedOrder:Number(avgOrder.toFixed(2))},
    bottlenecks:[
      snapshot.leads>0&&snapshot.paidOrders===0?'REVENUE CONVERSION: no paid-order evidence in current snapshot':null,
      snapshot.overdueActions>0?`OPERATIONS: ${snapshot.overdueActions} overdue actions`:null,
      snapshot.fulfillmentBacklog>10?`FULFILLMENT: ${snapshot.fulfillmentBacklog} backlog items`:null
    ].filter(Boolean),
    assumptions:['Snapshot is an operating view, not a financial statement.','Forecasts are estimates until validated against live outcomes.','No autonomous financial mutation is authorized by this layer.']
  };
}

function predict(snapshot, horizonDays=30) {
  const d=Math.max(1,num(horizonDays,30));
  const daily=snapshot.paidOrders/d;
  const revenueRunRate=daily*30;
  const avg=snapshot.paidOrders?snapshot.collectedRevenue/snapshot.paidOrders:0;
  const grossMargin=snapshot.collectedRevenue>0?(snapshot.grossProfit/snapshot.collectedRevenue):0;
  const projectedOrders=Math.max(0,Math.round(daily*d));
  const projectedRevenue=projectedOrders*avg;
  const confidence=snapshot.paidOrders>=10?0.72:snapshot.paidOrders>=3?0.52:snapshot.paidOrders>0?0.31:0.15;
  return {horizonDays:d,confidence,baseline:{dailyPaidOrders:Number(daily.toFixed(3)),monthlyRevenueRunRate:Number(revenueRunRate.toFixed(2)),grossMarginPct:Number((grossMargin*100).toFixed(2))},forecast:{orders:projectedOrders,revenue:Number(projectedRevenue.toFixed(2)),grossProfit:Number((projectedRevenue*grossMargin).toFixed(2))},drivers:{warmLeads:snapshot.warmLeads,hotLeads:snapshot.hotLeads,conversionRatePct:snapshot.leads?(snapshot.paidOrders/snapshot.leads*100):0}};
}

function simulate(snapshot,scenario={}) {
  const leadGrowth=num(scenario.leadGrowthPct,0)/100;
  const conversionLift=num(scenario.conversionLiftPct,0)/100;
  const orderValueLift=num(scenario.orderValueLiftPct,0)/100;
  const leads=Math.max(0,snapshot.leads*(1+leadGrowth));
  const baseConv=snapshot.leads?snapshot.paidOrders/snapshot.leads:0;
  const conv=Math.max(0,Math.min(1,baseConv*(1+conversionLift)));
  const orders=Math.round(leads*conv);
  const aov=snapshot.paidOrders?snapshot.collectedRevenue/snapshot.paidOrders:0;
  const revenue=orders*aov*(1+orderValueLift);
  const margin=snapshot.collectedRevenue?snapshot.grossProfit/snapshot.collectedRevenue:0;
  return {scenario:{leadGrowthPct:leadGrowth*100,conversionLiftPct:conversionLift*100,orderValueLiftPct:orderValueLift*100},outputs:{modeledLeads:Math.round(leads),modeledOrders:orders,modeledRevenue:Number(revenue.toFixed(2)),modeledGrossProfit:Number((revenue*margin).toFixed(2))},confidence:baseConv>0?0.55:0.2,guardrails:['Scenario only; does not mutate pricing, leads, payments, or production.']};
}

function council(snapshot,prediction) {
  const hotRatio=snapshot.leads?snapshot.hotLeads/snapshot.leads:0;
  const opsRisk=snapshot.overdueActions+snapshot.fulfillmentBacklog;
  const lenses=[
    {role:'CFO Intelligence',recommendation:snapshot.collectedRevenue===0?'Prioritize conversion proof before discretionary spend.':'Protect gross margin and measure collected gross profit, not vanity revenue.',score:snapshot.collectedRevenue===0?0.9:0.82},
    {role:'CRO Intelligence',recommendation:(snapshot.warmLeads+snapshot.hotLeads)>0?'Work the warm/hot queue before acquiring more leads.':'Strengthen lead supply and qualification.',score:(snapshot.warmLeads+snapshot.hotLeads)>0?0.91:0.64},
    {role:'COO Intelligence',recommendation:opsRisk>10?'Clear operational backlog before adding execution volume.':'Keep fulfillment and action queues within capacity.',score:opsRisk>10?0.93:0.78},
    {role:'CTO Intelligence',recommendation:'Preserve the governed single-system control plane; ship through test/stage/canary gates.',score:0.95},
    {role:'CISO/Risk Intelligence',recommendation:'Maintain owner veto, least privilege, immutable auditability, and bounded execution.',score:0.97},
    {role:'Customer Intelligence',recommendation:'Use response and outcome signals to prioritize the next-best customer action.',score:0.74}
  ];
  const priority = snapshot.collectedRevenue===0 && (snapshot.warmLeads+snapshot.hotLeads)>0 ? 'CONVERSION_FIRST' : opsRisk>10 ? 'OPERATIONS_FIRST' : prediction.confidence<0.4 ? 'EVIDENCE_FIRST' : 'SCALE_SELECTIVELY';
  return {chair:'Kevin · Chief Executive Intelligence',priority,lenses,decision:'Synthesize specialist recommendations; execution remains governed and auditable.'};
}

function engineeringPlan(intent='Improve the current bottleneck') {
  return {planId:ID(),intent,stages:['OBSERVE','ARCHITECT','IMPLEMENT','UNIT_TEST','SECURITY_REVIEW','INTEGRATION_TEST','SIMULATE','STAGE','CANARY','VERIFY','ROLLBACK_READY','LEARN'],productionMutation:'BLOCKED_UNLESS_APPROVED',selfApproval:'FORBIDDEN',artifact:'A change package may be generated and staged; this endpoint does not silently deploy code.'};
}

function financialGuard(action={}) {
  const amount=Math.max(0,num(action.amount));
  const type=String(action.type||'').toLowerCase();
  const highRisk=['refund','transfer','payout','price_change','credential_change','delete','withdraw'].some(x=>type.includes(x));
  const approvalRequired=highRisk||amount>=10000;
  return {ok:!approvalRequired,decision:approvalRequired?'HUMAN_APPROVAL_REQUIRED':'BOUNDED_AUTOMATION_ALLOWED',amount,type,reason:approvalRequired?'Financial or destructive boundary crossed.':'Within bounded non-destructive policy.',noSecretExpansion:true};
}

function createControlPlane({app,auth,ownerOnly,getDb,getPool,eventFabric,buildVersion,rootDir}) {
  const state={startedAt:new Date().toISOString(),cycles:0,lastCycle:null,lastError:null};
  let timer=null;
  async function snapshot(){
    const snap=summarizeDb(getDb?.()||{});
    const twin=makeTwin(snap);
    const prediction=predict(snap,30);
    const board=council(snap,prediction);
    const resilience={runtime:{uptimeSeconds:Math.floor(process.uptime()),node:process.version},mysql:Boolean(getPool?.()),eventFabric:null};
    try{resilience.eventFabric=await eventFabric?.health?.();}catch(e){resilience.eventFabric={ok:false,error:e.message};}
    return {ok:true,version:VERSION,build:buildVersion,identity:'SBC OS — ONE SYSTEM',roles:{owner:'Romeo · Sovereign Owner',cei:'Kevin · Chief Executive Intelligence',chiefOfStaff:'Kim · Operational Overseer',leadGeneration:'Lorna · Lead Input'},twin,prediction,board,resilience,state:{...state}};
  }
  async function cycle(){
    try{const out=await snapshot();state.cycles++;state.lastCycle=new Date().toISOString();state.lastError=null;return out;}
    catch(e){state.lastError=e.message;throw e;}
  }
  function register(){
    app.get('/api/v640/control-plane/status',auth,ownerOnly,async(req,res)=>{try{res.json(await snapshot());}catch(e){res.status(503).json({ok:false,error:e.message});}});
    app.get('/api/v640/digital-twin',auth,ownerOnly,async(req,res)=>{try{const s=summarizeDb(getDb?.()||{});res.json({ok:true,twin:makeTwin(s)});}catch(e){res.status(503).json({ok:false,error:e.message});}});
    app.get('/api/v640/predictions',auth,ownerOnly,async(req,res)=>{try{const s=summarizeDb(getDb?.()||{});res.json({ok:true,prediction:predict(s,req.query.days||30)});}catch(e){res.status(503).json({ok:false,error:e.message});}});
    app.post('/api/v640/simulate',auth,ownerOnly,async(req,res)=>{try{const s=summarizeDb(getDb?.()||{});res.json({ok:true,simulation:simulate(s,req.body||{})});}catch(e){res.status(400).json({ok:false,error:e.message});}});
    app.get('/api/v640/board',auth,ownerOnly,async(req,res)=>{try{const s=summarizeDb(getDb?.()||{});res.json({ok:true,board:council(s,predict(s,30))});}catch(e){res.status(503).json({ok:false,error:e.message});}});
    app.post('/api/v640/engineering/plan',auth,ownerOnly,(req,res)=>res.status(201).json({ok:true,...engineeringPlan(req.body?.intent)}));
    app.post('/api/v640/financial/guard',auth,ownerOnly,(req,res)=>res.json({ok:true,...financialGuard(req.body||{})}));
    app.post('/api/v640/cycle',auth,ownerOnly,async(req,res)=>{try{res.json(await cycle());}catch(e){res.status(503).json({ok:false,error:e.message});}});
    app.get('/sbc-god-tier',auth,ownerOnly,(req,res)=>res.sendFile(path.join(rootDir,'public/sbc-god-tier.html')));
  }
  function start(){if(timer)return;const ms=Math.max(300000,num(process.env.SBC_V640_CYCLE_MS,900000));timer=setInterval(()=>cycle().catch(e=>console.warn('[SBC V64]',e.message)),ms);timer.unref?.();cycle().catch(()=>{});}
  function stop(){if(timer)clearInterval(timer);timer=null;}
  register();
  return {VERSION,snapshot,cycle,start,stop,state};
}
module.exports={VERSION,createControlPlane,summarizeDb,makeTwin,predict,simulate,council,engineeringPlan,financialGuard};
