// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
/**
 * SBC V56.13.5 — Kim Autonomous Mission Controller
 * One conductor over the existing 10-brain, BI-OS, consultative, revenue,
 * Square, Twilio/voice, fulfillment, recovery, and telemetry rails.
 *
 * This module deliberately does NOT create a second payment or fulfillment rail.
 */
const VERSION='56.13.5-KIM-MISSION';
const PAYMENT_EVIDENCE=require('./v6640-payment-evidence.cjs');
const REVENUE_GATE=require('./v56134-god-tier-revenue.js');
// SBC_V6642_KIM_MISSION_FINANCIAL_GOVERNANCE: share verified payment and durable fulfillment rules.
const MAX_BATCH=20;
const MISSION_STAGES=Object.freeze([
  'PROSPECT','CONTEXT','DISCOVERY','SOLUTION','OFFER','CLOSING','PAYMENT','FULFILLMENT','ACCOUNT_MANAGER','RECOVERY','TELEMETRY'
]);
function now(){return new Date().toISOString();}
function clean(v,n=1000){return String(v??'').replace(/[\u0000]/g,'').trim().slice(0,n);}
function suppressed(c){const s=String(c?.status||'').trim().toLowerCase();return c?.doNotContact===true||c?.doNotCall===true||c?.salesSuppressed===true||c?.optedOut===true||c?.isSuppressed===true||['do not contact','do not call','opt out','unsubscribe','lost','closed','duplicate'].includes(s);}
function strictVerified(c){
 const status=String(c?.verificationStatus||'').trim().toLowerCase().replace(/[-_]+/g,' ').replace(/\s+/g,' ');
 return ['verified','passed','sales ready'].includes(status)||(status===''&&c?.verified===true);
}
function eligible(c){
  if(!c||suppressed(c))return false;
  const status=String(c.status||'').toLowerCase();
  if(['active_customer','fulfilled','active','do not contact'].includes(status))return false;
  const verification=String(c.verificationStatus||'').toLowerCase();
  const temp=String(c.leadTemperature||'').toLowerCase();
  return strictVerified(c) && (temp==='warm'||temp==='hot'); // SBC_V6627_KIM_ELIGIBILITY_TENANT_EVIDENCE: 'unverified' must never count as verified
}
function recentMission(c,windowMs=6*60*60*1000){
  const t=new Date(c?.sbcKimMission?.updatedAt||0).getTime();
  return Number.isFinite(t)&&t>0&&(Date.now()-t)<windowMs;
}
function isSystemTestOrder(o){
 if(!o||typeof o!=='object')return false;
 if(o.testMode===true||o.sbcTest===true)return true;
 const n=String(o.customerName||o.customer_name||'').trim().toLowerCase();
 const p=String(o.product||o.productName||'').trim().toLowerCase();
 const notes=String(o.notes||'').trim().toLowerCase();
 return n==='sbc system test — do not service'||n==='sbc system test - do not service'||/system test|do not service/.test(p+' '+notes);
}
function safeMetric(db){
  const orders=Array.isArray(db?.orders)?db.orders:[];
  const paid=orders.filter(o=>!isSystemTestOrder(o)&&PAYMENT_EVIDENCE.confirmedPaid(o));
  const revenue=paid.reduce((n,o)=>n+Number(o?.price||o?.total||0),0);
  return {paidOrders:paid.length,recognizedRevenue:Number(revenue.toFixed(2)),revenuePer1000:Number((revenue/Math.max(1,Number(process.env.SBC_REVENUE_PROSPECT_DENOMINATOR||1000))).toFixed(2))};
}
function sbcAdvisoryScreen(db, tenantId, limit, eligible, recentMission) {
  const scopedId=Number(tenantId);
  if(!Number.isSafeInteger(scopedId)||scopedId<1)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED'});
  const cap=Math.min(20,Math.max(1,Number(limit)||20));
  const raw=Array.isArray(db?.customers)?db.customers:[];
  const unresolvedTenantRecords=raw.filter(c=>c&&(c.tenantId===null||c.tenantId===undefined||String(c.tenantId).trim()==='')).length;
  const all=raw.filter(c=>Number(c?.tenantId)===scopedId);
  const warmHot=all.filter(c=>['warm','hot'].includes(String(c?.leadTemperature||'').trim().toLowerCase()));
  const verified=all.filter(eligible);
  const ready=verified.filter(c=>!recentMission(c));
  return {ok:true,advisoryOnly:true,tenantId:scopedId,tenantCustomers:all.length,tenantWarmHot:warmHot.length,unresolvedTenantRecords,
    qualifiedWarmHot:verified.length,notQualified:all.length-verified.length,
    prospects:Math.min(cap,ready.length),missions:0,externalActions:0,writeAttempts:0};
}
function createController({db,getCanonicalDb,saveData,audit,addActivity,tenBrain,closer,consultative,revenueSupervisor,globalBIOS,superbrain,dispatchCall,godKim,createConsultativeCheckout,createFulfillmentJobsForOrder,processReadyFulfillmentJobs,vendorCapabilities,catalog,sendCustomerStatus,ownerThreshold=10000,logger=console}={}){
  // SBC_V6628_KIM_CANONICAL_DB_REBIND: refresh the CRM object after async MySQL hydration.
  function refreshCanonicalDb(){
    const current=typeof getCanonicalDb==='function'?getCanonicalDb():db;
    if(!current||!Array.isArray(current.customers)||!Array.isArray(current.orders)){
      throw Object.assign(new Error('CRM_CANONICAL_DATA_UNAVAILABLE'),{code:'CRM_CANONICAL_DATA_UNAVAILABLE'});
    }
    db=current;
    return current;
  }
  const state={version:VERSION,lastCycleAt:'',lastCycleResult:null,running:false,missions:[],events:[]};
  const emit=(type,message,meta={})=>{
    const event={id:`kim-mission-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,type,message,meta,createdAt:now()};
    state.events.unshift(event);state.events=state.events.slice(0,200);global.__SBC_RECENT_RUNTIME_EVENTS=Array.isArray(global.__SBC_RECENT_RUNTIME_EVENTS)?global.__SBC_RECENT_RUNTIME_EVENTS:[];global.__SBC_RECENT_RUNTIME_EVENTS.push({id:event.id,timestamp:Date.now(),event:type,level:'INFO',version:VERSION,context:meta});global.__SBC_RECENT_RUNTIME_EVENTS=global.__SBC_RECENT_RUNTIME_EVENTS.slice(-500);return event;
  };
  async function persist(){if(typeof saveData!=='function')throw new Error('KIM_DURABLE_SAVE_UNAVAILABLE');await saveData();}
  function findCustomer(id){refreshCanonicalDb();return (db?.customers||[]).find(c=>String(c.id)===String(id));}
  function missionSummary(c){
    const m=c?.sbcKimMission||{};
    return {leadId:c?.id,company:c?.businessName||c?.contactName||'',stage:m.stage||'PROSPECT',status:m.status||'READY',action:m.action||'',updatedAt:m.updatedAt||'',orderId:c?.sbcRevenueCheckoutOrderId||'',checkoutUrl:c?.sbcRevenueCheckoutUrl||''};
  }
  async function runMission(customer,interactionData={},options={}){
    if(!customer)throw new Error('Customer is required.');
    if(!Number.isSafeInteger(Number(customer.tenantId))||Number(customer.tenantId)<1)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED'});
    const current=refreshCanonicalDb().customers.find(c=>String(c.id)===String(customer.id));
    if(!current||Number(current.tenantId)!==Number(customer.tenantId))throw Object.assign(new Error('CRM_CUSTOMER_CONTEXT_STALE'),{code:'CRM_CUSTOMER_CONTEXT_STALE'});
    customer=current;
    if(suppressed(customer)){
      customer.sbcKimMission={version:VERSION,stage:'RECOVERY',status:'SUPPRESSED',action:'TERMINATE',updatedAt:now(),reason:'Suppression gate enforced.'};
      await persist();
      emit('kim_mission_suppressed','Kim terminated mission because the prospect is suppressed.',{customerId:customer.id});
      return {ok:true,terminal:true,action:'TERMINATE',stage:'RECOVERY',reason:'Suppression gate enforced.',summary:missionSummary(customer)};
    }
    const started=Date.now();
    customer.sbcKimMission={...(customer.sbcKimMission||{}),version:VERSION,status:'RUNNING',stage:'CONTEXT',startedAt:customer.sbcKimMission?.startedAt||now(),updatedAt:now()};
    let evaluation;
    try{
      evaluation=await tenBrain.evaluate({customer,leadId:customer.id,closer:closer||options.closer,revenueSupervisor,db,catalog,tenantId:__sbcRequireTenantId(customer.tenantId),interactionData,mode:options.mode||'evaluate',dispatchCall,consultativeEngine:consultative,createConsultativeCheckout,intelligence:superbrain,globalIntelligence:globalBIOS});
    }catch(e){
      customer.sbcKimMission={...customer.sbcKimMission,stage:'RECOVERY',status:'RECOVERY',action:'MISSION_RECOVERY',error:clean(e.message,500),updatedAt:now()};
      await persist();emit('kim_mission_recovery','Kim mission entered recovery after orchestration failure.',{customerId:customer.id,error:e.message});
      return {ok:false,action:'MISSION_RECOVERY',stage:'RECOVERY',error:clean(e.message,500),summary:missionSummary(customer)};
    }
    const action=evaluation?.action||'CONTINUE_CONVERSATION';
    const stage=action==='CHECKOUT_READY'?'PAYMENT':action==='CHECKOUT_RECOVERY'?'RECOVERY':action==='CALL_DISPATCHED'?'CLOSING':evaluation?.nodes?.some(n=>n.brain==='SOLUTION_BRAIN'&&n.state==='COMPOSED')?'SOLUTION':'DISCOVERY';
    customer.sbcKimMission={...customer.sbcKimMission,stage,status:action==='CHECKOUT_RECOVERY'?'RECOVERY':'ACTIVE',action,updatedAt:now(),durationMs:Date.now()-started,lastEvaluation:{action,version:evaluation.version,nodes:evaluation.nodes?.map(n=>({brain:n.brain,state:n.state}))||[]}};
    if(evaluation?.checkout?.order?.id){customer.sbcRevenueCheckoutOrderId=evaluation.checkout.order.id;customer.sbcRevenueCheckoutUrl=evaluation.checkout.url||customer.sbcRevenueCheckoutUrl||'';customer.pipelineStage='Checkout';}
    if(action==='CHECKOUT_READY')emit('kim_checkout_ready','Kim created an authorized checkout through the existing Square rail.',{customerId:customer.id,orderId:evaluation.checkout?.order?.id||evaluation.checkout?.orderId||'',truth:'Checkout created; payment remains pending until Square confirmation.'});
    if(action==='CHECKOUT_RECOVERY')emit('kim_checkout_recovery','Kim preserved purchase intent and entered recovery.',{customerId:customer.id});
    await persist();
    try{audit?.({id:'system',name:'Kim Autonomous Mission Controller',role:'system'},'kim_autonomous_mission',`Kim mission ${action} for ${customer.businessName||customer.contactName||customer.id}`,{customerId:customer.id,stage,action,durationMs:Date.now()-started});}catch{}
    return {ok:true,version:VERSION,action,stage,evaluation,summary:missionSummary(customer)};
  }
  const fulfillmentInFlight=new Set();
  async function reconcilePaidOrders(limit=MAX_BATCH,tenantId=null){
    const scopedTenant=__sbcRequireTenantId(tenantId);
    refreshCanonicalDb();
    const durableJobs=Array.isArray(db.fulfillmentJobs)?db.fulfillmentJobs:[];
    // SBC_V6644_FAIR_OWNER_HOLD_BATCH: partition BEFORE the slice; large owner holds must not starve small paid orders.
    const cap=Math.min(MAX_BATCH,Math.max(1,Number(limit)||MAX_BATCH));
    const eligible=(db?.orders||[]).filter(o=>Number(o?.tenantId)===scopedTenant)
      .filter(o=>!isSystemTestOrder(o)&&PAYMENT_EVIDENCE.confirmedPaid(o))
      .filter(o=>REVENUE_GATE.needsReconciliation(o,durableJobs))
      .filter(o=>String(o?.metadata?.kimMissionFulfillmentStarted||'')!=='true');
    const held=eligible.filter(o=>REVENUE_GATE.orderRisk(o).ownerClearanceRequired);
    const paid=eligible.filter(o=>!REVENUE_GATE.orderRisk(o).ownerClearanceRequired)
      .filter(o=>!fulfillmentInFlight.has(String(o.id))).slice(0,cap);
    const results=held.slice(0,cap).map(o=>({orderId:o.id,status:'OWNER_CLEARANCE_REQUIRED',amount:REVENUE_GATE.orderRisk(o).amount}));
    for(const order of paid){
      const oid=String(order.id);
      if(fulfillmentInFlight.has(oid))continue;
      fulfillmentInFlight.add(oid);
      try{
        if(typeof godKim?.orchestrate!=='function')throw new Error('GodKim fulfillment orchestrator unavailable.');
        order.metadata={...(order.metadata||{}),kimMissionFulfillmentStarted:'true',kimMissionFulfillmentStartedAt:now()};
        const result=await godKim.orchestrate({order,requestUser:{id:'kim-mission-controller',name:'Kim Autonomous Mission Controller'},createFulfillmentJobsForOrder,processReadyFulfillmentJobs,vendorCapabilities,addActivity,audit,saveData,db,catalog,sendCustomerStatus:sendCustomerStatus|| (async()=>({sent:false})),testMode:false});
        results.push({orderId:order.id,status:'FULFILLMENT_ORCHESTRATED',stage:result?.stage||'FULFILLMENT'});
        emit('kim_fulfillment_started','Kim handed the paid order to the existing GodKim fulfillment rail.',{orderId:order.id});
      }catch(e){
        order.metadata={...(order.metadata||{}),kimMissionFulfillmentStarted:'false',kimMissionRecoveryAt:now()};
        results.push({orderId:order.id,status:'RECOVERY',error:clean(e.message,500)});
        emit('kim_fulfillment_recovery','Kim could not start fulfillment and preserved the order for recovery.',{orderId:order.id,error:e.message});
      }finally{fulfillmentInFlight.delete(oid);}
    }
    // Holds are advisory and must not cause repeated MySQL writes every cycle.
    const attempted=results.filter(r=>r.status==='FULFILLMENT_ORCHESTRATED'||r.status==='RECOVERY').length;
    if(attempted)await persist();
    return {processed:results.length,attempted,heldForOwner:held.length,dispatchCandidates:paid.length,results};
  }
  async function cycle({limit=MAX_BATCH,reason='scheduled',tenantId=null,advisoryOnly=false}={}){
    if(state.running)return {ok:true,skipped:true,reason:'cycle_already_running'};
    refreshCanonicalDb();
    if(advisoryOnly)return sbcAdvisoryScreen(db,tenantId,limit,eligible,recentMission);
    state.running=true;const started=Date.now();
    try{
      const cap=Math.min(MAX_BATCH,Math.max(1,Number(limit)||MAX_BATCH));
      const selectedTenant=Number(tenantId);if(!Number.isSafeInteger(selectedTenant)||selectedTenant<1)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED'});
      const candidates=(db?.customers||[]).filter(c=>Number(c?.tenantId)===selectedTenant).filter(eligible).filter(c=>!recentMission(c)).slice(0,cap);
      const autonomousOutbound=!advisoryOnly && String(process.env.SBC_KIM_MISSION_AUTONOMOUS_OUTBOUND||'false').toLowerCase()==='true';
      const results=[];
      for(const customer of candidates){
        try{results.push(await runMission(customer,{text:customer.researchNotes||customer.notes||'',needsMatrix:customer.consultativeNeeds?.discovery?.matrix||{}},{mode:autonomousOutbound?'dispatch':'evaluate'}));}
        catch(e){results.push({ok:false,customerId:customer.id,error:clean(e.message,500)});}
      }
      const fulfillment=advisoryOnly?{processed:0,results:[]}:await reconcilePaidOrders(cap,selectedTenant);
      state.lastCycleAt=now();state.lastCycleResult={ok:true,reason,prospects:candidates.length,missions:results.length,fulfillment,metrics:safeMetric(db),durationMs:Date.now()-started};
      await persist();
      return state.lastCycleResult;
    }catch(e){state.lastCycleAt=now();state.lastCycleResult={ok:false,reason,error:clean(e.message,500),durationMs:Date.now()-started};return state.lastCycleResult;}
    finally{state.running=false;}
  }
  function overview(tenantId){const tenant=__sbcRequireTenantId(tenantId);try{refreshCanonicalDb()}catch(_){/* read-only boot may hydrate later */}const scopedCustomers=(db?.customers||[]).filter(c=>Number(c?.tenantId)===tenant);const scopedOrders=(db?.orders||[]).filter(o=>Number(o?.tenantId)===tenant);const visibleCustomerIds=new Set(scopedCustomers.map(c=>String(c.id)));const visibleOrderIds=new Set(scopedOrders.map(o=>String(o.id)));return {version:VERSION,brains:tenBrain.BRAINS,stages:MISSION_STAGES,maxBatch:MAX_BATCH,ownerThreshold,autonomousRoutine:String(process.env.SBC_KIM_AUTONOMOUS_ROUTINE||'true').toLowerCase()!=='false',autonomousOutbound:String(process.env.SBC_KIM_MISSION_AUTONOMOUS_OUTBOUND||'false').toLowerCase()==='true',state:{lastCycleAt:state.lastCycleAt,lastCycleResult:state.lastCycleResult,running:state.running},metrics:safeMetric({orders:scopedOrders}),recentEvents:state.events.filter(e=>Number(e.meta?.tenantId)===tenant||(e.meta?.customerId&&visibleCustomerIds.has(String(e.meta.customerId)))||(e.meta?.orderId&&visibleOrderIds.has(String(e.meta.orderId)))).slice(0,20),missions:scopedCustomers.filter(c=>c?.sbcKimMission).slice(0,20).map(missionSummary),truth:'Observed runtime state only. No synthetic revenue, payment, fulfillment, or 100M-record claims.'};}
  return {VERSION,MAX_BATCH,MISSION_STAGES,runMission,cycle,reconcilePaidOrders,overview,eligible,suppressed};
}
module.exports={VERSION,MAX_BATCH,MISSION_STAGES,createController};
