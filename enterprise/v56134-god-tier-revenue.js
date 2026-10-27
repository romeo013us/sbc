'use strict';

/**
 * SBC V56.13.4 — God-Tier Revenue Reconciliation
 *
 * Additive coordinator around the proven Square -> paid order -> GodKim path.
 * It never invents payment, never creates a charge, and never submits an
 * external vendor order unless the existing GodKim/provider gates allow it.
 */
const VERSION='56.13.4';
const PAYMENT_EVIDENCE=require('./v6640-payment-evidence.cjs');
const PAID=new Set(['PAID','COMPLETED','FULFILLED']);
const TERMINAL=new Set(['COMPLETED','FULFILLED','DELIVERED','CANCELLED','CANCELED']);

// SBC_V6529_OPEN_READINESS: synthetic diagnostics never count as revenue or fulfillment work.
function isSystemTestOrder(o){if(!o||typeof o!=='object')return false;if(o.testMode===true||o.sbcTest===true)return true;const n=String(o.customerName||o.customer_name||'').trim().toLowerCase(),p=String(o.product||o.productName||'').trim().toLowerCase(),notes=String(o.notes||'').trim().toLowerCase();return n==='sbc system test — do not service'||n==='sbc system test - do not service'||/system test|do not service/.test(p+' '+notes);}
function isSystemTestCustomer(c){if(!c||typeof c!=='object')return false;const n=String(c.businessName||c.business_name||c.name||'').trim().toLowerCase(),src=String(c.source||'').toLowerCase(),notes=String(c.notes||'').toLowerCase();return n==='sbc system test — do not service'||n==='sbc system test - do not service'||/sbc system test|sbc full-cycle test|v47 full-cycle test|do not service/.test(src+' '+notes);}
function low(v){return String(v??'').trim().toLowerCase();}
// SBC_V6658_PROVENANCE_REVENUE_FULFILLMENT: a paid label cannot cause an autonomous fulfillment attempt.
function isPaid(order){return PAYMENT_EVIDENCE.providerCapturedSquare(order);}
function isTerminal(order){return TERMINAL.has(String(order?.status||'').toUpperCase());}
function needsReconciliation(order,jobs){
  if(!order||isSystemTestOrder(order)||!isPaid(order)||isTerminal(order)) return false;
  if(String(order?.fulfillmentStatus||'').toUpperCase()==='COMPLETE — TEST') return false;
  const rows=(jobs||[]).filter(j=>String(j.orderId)===String(order.id));
  // The existing Square/GodKim path owns job creation. The reconciliation worker
  // only repairs a paid order that has no durable fulfillment job at all; it never
  // creates a second job for an order already represented in the fulfillment ledger.
  return rows.length===0;
}
function orderRisk(order){
  const amount=Number(order?.price||order?.total||0);
  return {amount,ownerClearanceRequired:amount>=10000};
}
function snapshot(db,capabilities={}){
  const orders=Array.isArray(db?.orders)?db.orders:[];
  const jobs=Array.isArray(db?.fulfillmentJobs)?db.fulfillmentJobs:[];
  const customers=Array.isArray(db?.customers)?db.customers:[];
  const paid=orders.filter(o=>isPaid(o)&&!isSystemTestOrder(o));
  const reconcile=paid.filter(o=>needsReconciliation(o,jobs));
  const revenue=paid.reduce((n,o)=>{const x=Number(o?.price??o?.total??0);return n+(Number.isFinite(x)&&x>0&&x<1e9?x:0);},0);
  const customerIds=new Set(customers.filter(c=>!isSystemTestCustomer(c)).map(c=>String(c.id)));
  const orphanJobs=jobs.filter(j=>j.orderId&&!orders.some(o=>String(o.id)===String(j.orderId))).length;
  return {
    version:VERSION,
    generatedAt:new Date().toISOString(),
    metrics:{orders:orders.filter(o=>!isSystemTestOrder(o)).length,paidOrders:paid.length,unverifiedFulfillmentOrders:orders.filter(o=>!isSystemTestOrder(o)&&PAYMENT_EVIDENCE.unverifiedFulfillment(o)).length,reconciliationCandidates:reconcile.length,fulfillmentJobs:jobs.length,orphanFulfillmentJobs:orphanJobs,recognizedPaidRevenue:Number(revenue.toFixed(2)),customers:customerIds.size},
    capabilities:{
      internal:Boolean(capabilities.internal?.configured!==false),
      fourOverFour:{configured:Boolean(capabilities.fourOverFour?.configured),autoExecution:Boolean(capabilities.fourOverFour?.autoExecution)},
      godaddy:{configured:Boolean(capabilities.godaddy?.configured),autoExecution:Boolean(capabilities.godaddy?.autoExecution)},
      vistaPrint:{configured:Boolean(capabilities.vistaPrint?.configured),autoExecution:Boolean(capabilities.vistaPrint?.autoExecution)}
    },
    truthGate:'Square-backed value uses stored SBC settlement metadata, NOT verified cash deposits; paid labels excluded.'
  };
}

async function reconcilePaidOrders({db, godKim, createFulfillmentJobsForOrder, processReadyFulfillmentJobs, vendorCapabilities, addActivity, audit, saveData, limit=20, requestUser={id:'kim-god-tier',name:'Kim / Revenue Autopilot'}}={}){
  if(!db) throw new Error('Database context is required.');
  if(!godKim||typeof godKim.orchestrate!=='function') throw new Error('GodKim orchestration is unavailable.');
  const max=Math.max(1,Math.min(20,Number(limit)||20));
  const jobs=Array.isArray(db.fulfillmentJobs)?db.fulfillmentJobs:[];
  // SBC_V6644_FAIR_OWNER_HOLD_BATCH: owner holds remain visible but cannot occupy fulfillment slots.
  const eligible=(db.orders||[]).filter(o=>needsReconciliation(o,jobs));
  const held=eligible.filter(o=>orderRisk(o).ownerClearanceRequired);
  const candidates=eligible.filter(o=>!orderRisk(o).ownerClearanceRequired).slice(0,max);
  const results=held.slice(0,max).map(o=>({orderId:o.id,status:'OWNER_CLEARANCE_REQUIRED',amount:orderRisk(o).amount}));
  for(const order of candidates){
    try{
      const result=await godKim.orchestrate({order,requestUser,createFulfillmentJobsForOrder,processReadyFulfillmentJobs,vendorCapabilities,addActivity,audit,saveData,db,testMode:false});
      results.push({orderId:order.id,status:result?.stage||'UNKNOWN',ok:result?.ok!==false,traceId:result?.traceId||'',externalExecution:Boolean(result?.externalExecution),provider:result?.provider||''});
    }catch(error){
      results.push({orderId:order.id,status:'ERROR',ok:false,error:String(error?.message||error).slice(0,300)});
    }
  }
  return {ok:true,version:VERSION,processed:results.length,heldForOwner:held.length,candidates:candidates.length,results,generatedAt:new Date().toISOString()};
}

module.exports={VERSION,isPaid,isTerminal,needsReconciliation,orderRisk,snapshot,reconcilePaidOrders};
