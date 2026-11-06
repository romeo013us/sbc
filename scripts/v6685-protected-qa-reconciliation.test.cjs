'use strict';
// V66.85: protect the already-paid owner-only $1 QA order from the real
// commercial fulfillment reconciliation queue. Synthetic only: no MySQL,
// Square network, vendor fulfillment, checkout, or financial mutation.
const assert=require('node:assert/strict');
const revenue=require('../enterprise/v56134-god-tier-revenue.js');
const captured={
  paymentStatus:'PAID',squareOrderId:'sq-order-1',squarePaymentId:'sq-pay-1',
  squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-11-01T19:14:10-05:00'
};
const qa={
  id:'ord_mvxhmq7f_b777aafa',tenantId:1,product:'SBC Launch QA - $1 Test Service',
  price:1,fulfillmentStatus:'QA VERIFIED - NO FULFILLMENT',
  notes:JSON.stringify({sbcLaunchQa:{kind:'OWNER_ONLY_ONE_DOLLAR_CHECKOUT',version:1}}),
  ...captured
};
const paidCustomer={
  id:'ord-genuine-349',tenantId:1,product:'SBC Business Essentials',
  price:349,fulfillmentStatus:'Ready for Fulfillment',
  ...captured,squareOrderId:'sq-order-real',squarePaymentId:'sq-pay-real'
};
// Real captured QA remains visible in paid order totals but is never a
// fulfillment reconciliation candidate.
assert.equal(revenue.isPaid(qa),true,'protect settlement truth; do not erase paid evidence');
assert.equal(revenue.isProtectedLaunchQaOrder(qa),true);
assert.equal(revenue.needsReconciliation(qa,[]),false);
assert.equal(revenue.needsReconciliation({...qa,fulfillmentStatus:'QA - NO VENDOR FULFILLMENT'},[]),false);
assert.equal(revenue.needsReconciliation(paidCustomer,[]),true);
assert.equal(revenue.needsReconciliation(paidCustomer,[{orderId:paidCustomer.id}]),false);

// Fail closed: a normal commercial order must NEVER escape reconciliation
// merely by supplying QA in its name or an ambiguous no-fulfillment status.
for(const candidate of [
  {...qa,notes:''},
  {...qa,notes:'not-json'},
  {...qa,notes:'{}'},
  {...qa,notes:JSON.stringify({sbcLaunchQa:{kind:'wrong'}})},
  {...qa,fulfillmentStatus:'Ready for Fulfillment'},
  {...qa,product:'SBC Business Essentials'},
  {...qa,price:349},
  {...qa,price:null,total:349},
  {...paidCustomer,fulfillmentStatus:'QA VERIFIED - NO FULFILLMENT'},
  {...paidCustomer,notes:qa.notes},
  {...paidCustomer,product:qa.product},
  {...paidCustomer,price:1,fulfillmentStatus:qa.fulfillmentStatus}
]){
  assert.equal(revenue.isProtectedLaunchQaOrder(candidate),false,'do not accidentally exempt commercial orders');
  assert.equal(revenue.needsReconciliation(candidate,[]),true,'unfulfilled paid order must remain in queue');
}
const refunded={...qa,paymentStatus:'REFUNDED',squarePaymentStatus:'REFUNDED'};
assert.equal(revenue.needsReconciliation(refunded,[]),false);
const invalidProof={...paidCustomer,squarePaymentId:''};
assert.equal(revenue.needsReconciliation(invalidProof,[]),false);
const snap=revenue.snapshot({orders:[qa,paidCustomer],fulfillmentJobs:[],customers:[]});
assert.equal(snap.metrics.paidOrders,2,'keep the historical QA payment in the paid evidence count');
assert.equal(snap.metrics.recognizedPaidRevenue,350,'do not falsify payment metadata for this focused fix');
assert.equal(snap.metrics.reconciliationCandidates,1,'only the unfulfilled real customer order is queued');
const qaOnly=revenue.snapshot({orders:[qa],fulfillmentJobs:[],customers:[]});
assert.equal(qaOnly.metrics.reconciliationCandidates,0,'QA-only queue must show 0');

(async()=>{
 let called=[],unexpectedWrite=false;
 const godKim={orchestrate:async ({order,testMode})=>{
   called.push(order.id);
   assert.equal(testMode,false);
   return {ok:true,stage:'POLICY_GATED'};
 }};
 const shared={godKim,createFulfillmentJobsForOrder:()=>{unexpectedWrite=true;throw Error('unexpected write')},
  processReadyFulfillmentJobs:()=>{unexpectedWrite=true;throw Error('unexpected fulfillment')},
  saveData:()=>{unexpectedWrite=true;throw Error('unexpected save')}};
 const onlyQa=await revenue.reconcilePaidOrders({...shared,db:{orders:[qa],fulfillmentJobs:[]}});
 assert.equal(onlyQa.processed,0);assert.equal(onlyQa.candidates,0);
 assert.deepEqual(called,[],'never orchestrate the protected QA order');
 const mixed=await revenue.reconcilePaidOrders({...shared,db:{orders:[qa,paidCustomer],fulfillmentJobs:[]}});
 assert.equal(mixed.candidates,1);
 assert.deepEqual(called,['ord-genuine-349']);
 assert.equal(unexpectedWrite,false,'synthetic test must not invoke any mutation');
 console.log('[SBC V66.85] PASS: protected QA settlement is paid but excluded from reconcile/fulfillment; genuine paid orders remain queued; fail-closed 12 negative cases; no writes');
})().catch(e=>{console.error(e);process.exitCode=1});
