'use strict';
// Test actual assembled V66 modules, not just the source-level patch script.
// Requires no network, live credentials, database, or real payment processor.
const assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const E=require(path.join(root,'enterprise/v6640-payment-evidence.cjs'));
const T=require(path.join(root,'enterprise/v56134-ten-brain.js'));
const G=require(path.join(root,'enterprise/v56134-god-tier-revenue.js'));
const S=require(path.join(root,'enterprise/revenue-autopilot-supervisor-v552.js'));
const records=[
 {id:'workflow-done-unpaid',status:'Completed',paymentStatus:'Pending',price:199},
 {id:'fulfillment-done-unpaid',status:'Fulfilled',paymentStatus:'Pending',price:349},
 {id:'paid-in-Square',status:'Pending',paymentStatus:'Pending',metadata:{squareOrderId:'sq-order-99',squarePaymentId:'sq-payment-99',squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-10-26T19:00:00Z'},price:99},
 {id:'paid-in-CRM',status:'Pending',paymentStatus:'Paid',price:599},
 {id:'refunded',status:'Completed',paymentStatus:'REFUNDED',price:699},
 {id:'system-test',status:'Paid',paymentStatus:'Paid',price:1,testMode:true}
];
const db={customers:[{id:'prospect',tenantId:1}],orders:records,fulfillmentJobs:[]};
const t=T.snapshot({db}),g=G.snapshot(db);
assert.equal(t.metrics.paidOrders,1,'10-brain must only count Square-backed settlement records');
assert.equal(g.metrics.paidOrders,1,'God-Tier must match 10-brain Square-backed classification');
assert.equal(t.metrics.unverifiedFulfillmentOrders,2);
assert.equal(g.metrics.unverifiedFulfillmentOrders,2);
assert.equal(t.metrics.recognizedRevenue,99);
assert.equal(g.metrics.recognizedPaidRevenue,99);
assert.equal(E.providerCapturedSquare(records[2]),true);
assert.equal(E.providerCapturedSquare(records[3]),false,'legacy status-only Paid is not Square evidence');
assert.equal(E.confirmedPaid(records[0]),false);
assert.equal(G.needsReconciliation(records[0],[]),false,'unpaid order must never be sent for fulfillment');
assert.equal(G.needsReconciliation(records[2],[]),true,'confirmed paid order may be reconciled');
(async()=>{
 const state={provider:{square:{failures:3,state:'OPEN',openedUntil:Date.now()+120000}},events:[],inbound:[],failures:[]};
 const fixture={revenueSupervisor:state,customers:[],orders:[]};
 let calls=0;
 const s=S.createSupervisor({db:fixture,catalog:{packages:[{id:'starter',name:'SBC Starter',price:199}]},
  saveData:async()=>{},addActivity:()=>{},audit:()=>{},id:k=>k+'-test',now:()=>new Date().toISOString(),
  createSquarePaymentLinkForOrder:async()=>{calls++;return {url:'https://example.test/checkout'};}});
 const lead={id:'lead',tenantId:1,businessName:'Test Business'};
 await assert.rejects(s.createCheckoutForCustomer(lead,'starter'),e=>e.code==='CIRCUIT_OPEN');
 assert.equal(fixture.orders.length,0,'open Square circuit must not create phantom orders');
 assert.equal(calls,0,'no API calls allowed while circuit is open');
 assert.equal(lead.sbcRevenueCheckoutUrl,undefined,'no checkout URL fabricated');
 console.log('[SBC V6640 COMPILED] PASS reconciled UI metrics, unpaid fulfillment protection, Square-circuit no-ghost-order');
})().catch(e=>{console.error(e);process.exitCode=1});
