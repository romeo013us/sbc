'use strict';
/**
 * SBC V56.13.4 — 10-Brain Revenue Closer
 *
 * Fast deterministic orchestration over existing SBC revenue infrastructure.
 * It does not invent payment, bypass suppression, or create a second fulfillment rail.
 */
const VERSION='56.13.4-10B';
const PAYMENT_EVIDENCE=require('./v6640-payment-evidence.cjs');
const BRAINS=Object.freeze([
  'PROSPECT_BRAIN','CONTEXT_BRAIN','OPENING_BRAIN','OFFERING_BRAIN','CLOSING_BRAIN',
  'FULFILLMENT_BRAIN','ACCOUNT_MANAGER_BRAIN','CONTROLLER_BRAIN','RECOVERY_BRAIN','TELEMETRY_BRAIN'
]);
function now(){return new Date().toISOString();}
function clean(v,n=1000){return String(v??'').replace(/[\u0000]/g,'').trim().slice(0,n);}
// SBC_V6529_OPEN_READINESS: synthetic diagnostic records are not prospects or revenue.
function isSystemTestOrder(o){if(!o||typeof o!=='object')return false;if(o.testMode===true||o.sbcTest===true)return true;const n=String(o.customerName||o.customer_name||'').trim().toLowerCase(),p=String(o.product||o.productName||'').trim().toLowerCase(),notes=String(o.notes||'').trim().toLowerCase();return n==='sbc system test — do not service'||n==='sbc system test - do not service'||/system test|do not service/.test(p+' '+notes);}
function isSystemTestCustomer(c){if(!c||typeof c!=='object')return false;const n=String(c.businessName||c.business_name||c.name||'').trim().toLowerCase(),src=String(c.source||'').toLowerCase(),notes=String(c.notes||'').toLowerCase();return n==='sbc system test — do not service'||n==='sbc system test - do not service'||/sbc system test|sbc full-cycle test|v47 full-cycle test|do not service/.test(src+' '+notes);}
function tempScore(c){const t=String(c?.leadTemperature||'').toLowerCase();return t==='hot'?30:t==='warm'?18:5;}
function revenuePerThousand(orders=[]){
  const revenue=(orders||[]).filter(o=>!isSystemTestOrder(o)&&PAYMENT_EVIDENCE.providerCapturedSquare(o)).reduce((n,o)=>{const x=Number(o?.price??o?.total??0);return n+(Number.isFinite(x)&&x>0&&x<1e9?x:0);},0);
  return Number((revenue/Math.max(1,Number(process.env.SBC_REVENUE_PROSPECT_DENOMINATOR||1000))).toFixed(2));
}
async function evaluate({customer,leadId,closer,revenueSupervisor,db,catalog,tenantId=1,interactionData={},mode='evaluate',dispatchCall=null,consultativeEngine=null,createConsultativeCheckout=null,intelligence=null,globalIntelligence=null}={}){
  if(!customer) throw new Error('Lead/customer is required.');
  const start=Date.now();
  const suppressed=isSystemTestCustomer(customer)||customer.doNotContact===true || customer.salesSuppressed===true || String(customer.status||'').toLowerCase()==='do not contact';
  const profile=closer?.profile ? closer.profile(customer,[]) : {intentScore:Number(customer.intentScore||0),stage:'DISCOVERY',offer:null};
  const nodes=[];
  nodes.push({brain:'PROSPECT_BRAIN',state:suppressed?'SUPPRESSED':'CLEAN',ms:Date.now()-start});
  if(suppressed)return {ok:true,version:VERSION,leadId:String(leadId||customer.id),terminal:true,action:'TERMINATE',nodes,reason:'Suppression gate enforced.'};
  nodes.push({brain:'CONTEXT_BRAIN',state:'INJECTED',facts:['businessName','industry','website','leadTemperature','verificationStatus'].filter(k=>customer[k]!==undefined)});
  let intelligencePreview=null;
  let globalIntelligencePreview=null;
  try{
    globalIntelligencePreview=globalIntelligence?.retrieve?.({customer,needs:interactionData.needs||interactionData.needsMatrix||[],text:interactionData.text||interactionData.message||interactionData.discoveryText||'',industry:customer.industry});
    nodes.push({brain:'CONTEXT_BRAIN',state:'GLOBAL_BI_ENRICHED',industry:globalIntelligencePreview?.industry||'unknown',confidence:globalIntelligencePreview?.confidence||0,benchmarks:globalIntelligencePreview?.benchmarks?.length||0,patterns:globalIntelligencePreview?.patterns?.length||0,evidence:globalIntelligencePreview?.evidence?.length||0});
  }catch(e){nodes.push({brain:'RECOVERY_CONTROLLER_BRAIN',state:'GLOBAL_BI_DEGRADED',error:clean(e.message,240)});}
  try{
    intelligencePreview=intelligence?.recommend?.({customer,needs:interactionData.needs||interactionData.needsMatrix||[],text:interactionData.text||interactionData.message||interactionData.discoveryText||'',catalog});
    if(globalIntelligencePreview?.provenSkus?.length) intelligencePreview.globalProvenSkus=globalIntelligencePreview.provenSkus.slice(0,8);
    nodes.push({brain:'CONTEXT_BRAIN',state:'HISTORICALLY_ENRICHED',confidence:intelligencePreview?.confidence||0,evidence:intelligencePreview?.evidence||{},topRecommendations:(intelligencePreview?.recommended||[]).slice(0,5).map(x=>x.sku)});
  }catch(e){nodes.push({brain:'RECOVERY_CONTROLLER_BRAIN',state:'INTELLIGENCE_DEGRADED',error:clean(e.message,240)});}
  let consultativeSolution=null;
  try{
    if(consultativeEngine&&catalog){
      const discoveryText=[interactionData.text,interactionData.message,interactionData.discoveryText,customer.notes,customer.researchNotes,customer.websiteStatus].filter(Boolean).join(' ');
      consultativeSolution=consultativeEngine.composeSolution({catalog,needsMatrix:interactionData.needsMatrix||customer.consultativeNeeds?.discovery?.matrix||{},discoveryText,customer,intelligence});
    }
  }catch(e){nodes.push({brain:'RECOVERY_BRAIN',state:'DISCOVERY_DEGRADED',error:clean(e.message,240)});}
  const buying=String(interactionData.text||interactionData.message||'').match(/\b(buy|purchase|pay|checkout|get started|sign me up|let(?:'|’)s do it|send me the link|when can you start)\b/i);
  const objection=String(interactionData.objection||'').trim();
  nodes.push({brain:'OPENING_BRAIN',state:'READY'});
  const offer=profile.offer||null;
  const dynamicSolution=consultativeSolution?.status==='SOLUTION_COMPOSED'?consultativeSolution:null;
  nodes.push({brain:'DISCOVERY_BRAIN',state:dynamicSolution?'DIAGNOSED':'DISCOVERY_PENDING',needs:dynamicSolution?.needs||[]});
  nodes.push({brain:'SOLUTION_BRAIN',state:dynamicSolution?'COMPOSED':'CATALOG_PENDING',items:dynamicSolution?.solutionProfile?.map(x=>x.sku)||[]});
  nodes.push({brain:'OFFERING_BRAIN',state:(dynamicSolution||offer)?'MAPPED':'CATALOG_PENDING',offer:dynamicSolution?{sku:'CONSULTATIVE_BUNDLE',price:dynamicSolution.customerPayableNow,name:`${dynamicSolution.solutionProfile.length} item solution`}:offer?{sku:offer.sku,price:offer.price,name:offer.name}:null});
  let action='CONTINUE_CONVERSATION';
  if(buying){
    nodes.push({brain:'CLOSING_BRAIN',state:'BUYING_SIGNAL',signal:clean(buying[0],120)});
    action='CREATE_CHECKOUT';
  } else if(objection){
    nodes.push({brain:'CLOSING_BRAIN',state:'OBJECTION',objection:clean(objection,300)});
    action='RESOLVE_OBJECTION';
  } else {
    nodes.push({brain:'CLOSING_BRAIN',state:profile.intentScore>=88?'HIGH_INTENT':'DISCOVERY'});
  }
  nodes.push({brain:'FULFILLMENT_BRAIN',state:'PAYMENT_GATED'});
  nodes.push({brain:'ACCOUNT_MANAGER_BRAIN',state:'READY_AFTER_PAYMENT'});
  nodes.push({brain:'CONTROLLER_BRAIN',state:'POLICY_BOUNDED'});
  nodes.push({brain:'RECOVERY_BRAIN',state:'WATCHING'});
  const telemetry={revenuePer1000:revenuePerThousand(db?.orders||[]),intentScore:Number(profile.intentScore||0),stage:profile.stage||'DISCOVERY'};
  nodes.push({brain:'TELEMETRY_BRAIN',state:'UPDATED',metrics:telemetry});
  let checkout=null;
  if(action==='CREATE_CHECKOUT' && mode!=='dispatch'){action='CHECKOUT_REVIEW_REQUIRED';nodes.push({brain:'CONTROLLER_BRAIN',state:'HUMAN_PURCHASE_CONFIRMATION_REQUIRED'});}
  if(action==='CREATE_CHECKOUT'){
    try{
      if(dynamicSolution&&typeof createConsultativeCheckout==='function') checkout=await createConsultativeCheckout(customer,dynamicSolution);
      else if(revenueSupervisor?.createCheckoutForCustomer) checkout=await revenueSupervisor.createCheckoutForCustomer(customer,profile.offer?.id||customer.sbcRevenueOfferPackageId||'starter');
      else throw new Error('Checkout service unavailable.');
      action='CHECKOUT_READY';
    }
    catch(e){action='CHECKOUT_RECOVERY';nodes.push({brain:'RECOVERY_BRAIN',state:'CHECKOUT_RETRY_REQUIRED',error:clean(e.message,300)});}
  }
  if(mode==='dispatch' && dispatchCall && !checkout && Number(profile.intentScore||0)>=70){
    try{const call=await dispatchCall(String(customer.id),tenantId);action='CALL_DISPATCHED';return {ok:true,version:VERSION,leadId:String(customer.id),action,profile,checkout,call,nodes,intelligence:intelligencePreview,globalIntelligence:globalIntelligencePreview,durationMs:Date.now()-start};}
    catch(e){action='CALL_BLOCKED';nodes.push({brain:'RECOVERY_BRAIN',state:'OUTBOUND_BLOCKED',error:clean(e.message,300)});}
  }
  return {ok:true,version:VERSION,leadId:String(customer.id),action,profile,checkout,nodes,intelligence:intelligencePreview,globalIntelligence:globalIntelligencePreview,durationMs:Date.now()-start};
}
function snapshot({db}={}){
  const customers=(Array.isArray(db?.customers)?db.customers:[]).filter(c=>!isSystemTestCustomer(c));
  const orders=(Array.isArray(db?.orders)?db.orders:[]).filter(o=>!isSystemTestOrder(o));
  const paid=orders.filter(o=>!isSystemTestOrder(o)&&PAYMENT_EVIDENCE.providerCapturedSquare(o));
  const unverifiedFulfillmentOrders=orders.filter(o=>PAYMENT_EVIDENCE.unverifiedFulfillment(o)).length;
  return {version:VERSION,brains:BRAINS.map(brain=>({brain,state:'ONLINE'})),metrics:{prospects:customers.length,paidOrders:paid.length,unverifiedFulfillmentOrders,recognizedRevenue:Number(paid.reduce((n,o)=>{const x=Number(o?.price??o?.total??0);return n+(Number.isFinite(x)&&x>0&&x<1e9?x:0);},0).toFixed(2)),revenuePer1000:revenuePerThousand(orders)},truth:'Square settlement metadata recorded by SBC, not proof of deposited cash; status-only orders excluded.'};
}
module.exports={VERSION,BRAINS,evaluate,snapshot,revenuePerThousand};
