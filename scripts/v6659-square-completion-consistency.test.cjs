'use strict';
// Source-matched compiled runtime test with synthetic Square events.
// NEVER performs a network request or writes customer/provider records.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const src=fs.readFileSync(path.join(root,'server.js'),'utf8');
const P=require(path.join(root,'enterprise/v6659-square-webhook-proof.cjs'));
assert.match(src,/SBC_V6659_SQUARE_COMPLETION_CONSISTENCY/);
const start=src.indexOf("async function handleSquarePaymentEvent(event,baseOverride=''){");
const end=src.indexOf('\nconst PAYMENT_LINKS =',start);
assert.ok(start>=0&&end>start,'compiled handler boundaries');
const originalPayment={id:'pm-7',order_id:'sq-order-7',location_id:'loc-7',status:'COMPLETED',amount_money:{amount:34900,currency:'USD'}};
const makeOrder=()=>({id:'sbc-7',customerId:'none',tenantId:7,price:349,paymentStatus:'Paid',status:'Pending',notes:JSON.stringify({squareOrderId:'sq-order-7',squarePaymentStatus:'PENDING'})});
const createFixture=()=>{
 const order=makeOrder();
 const rec={id:'rec-7',sbcOrderId:order.id,squareOrderId:'sq-order-7',squarePaymentId:'',status:'PENDING'};
 const db={orders:[order],squarePayments:[rec],tasks:[],customers:[]};
 const metrics={saves:0,activities:0,commissions:0,automation:0,commercial:0,webhooks:0};
 const now=()=> '2026-10-26T20:15:00.000Z';
 const orderParsed=o=>{if(o.parsed&&typeof o.parsed==='object')return o.parsed;try{return JSON.parse(o.notes||'{}')}catch{return {}}};
 const updateOrderParsed=(o,patch)=>{o.notes=JSON.stringify({...orderParsed(o),...patch});o.updatedAt=now()};
 const ctx={
   db,now,id:()=>'no-external-id',String,Number,Object,Date,Math,
   process:{env:{SQUARE_LOCATION_ID:'loc-7',SBC_PUBLIC_URL:'https://invalid.example.test'}},
   squarePaymentRecords:()=>db.squarePayments,squareMoneyCents:n=>Math.round(n*100),orderParsed,updateOrderParsed,
   SBC_V6659_SQUARE_PROOF:P,
   saveData:async()=>{metrics.saves++},addActivity:()=>{metrics.activities++},
   REVENUE_AUTOPILOT_V56150:{recordFunnelEvent:async()=>{}},
   SBC_COMMERCIAL:{provisionTenant:async()=>{metrics.commercial++;throw Error('test no commercial provisioning')}},
   V569_PRODUCTION_EXPANSION:{provisionStorefront:()=>{throw Error('test no storefront provisioning')}},
   ensureCommissionForSale:()=>{metrics.commissions++},
   GOD_KIM:{orchestrate:async()=>{metrics.automation++}},
   createFulfillmentJobsForOrder:async()=>[],processReadyFulfillmentJobs:async()=>{},
   vendorCapabilities:()=>({}),audit:()=>{},CATALOG:{},
   sendBig3OfficeBoxHandoff:async()=>({skipped:true,ok:true}),sendOrderIntake:async()=>({sent:false}),
   TENANT_DEFAULT_ID:7,ensureProjectForCustomer:()=>{throw Error('Unexpected customer provisioning')},
   V566_RAILS:{subscriptionRecovery:()=>({eligible:false})},V562NEXT:{billingFriction:()=>null}
 };
 vm.runInNewContext(src.slice(start,end)+'\nthis.processPayment=handleSquarePaymentEvent;',ctx,{timeout:2500});
 return {order,rec,db,metrics,run:p=>ctx.processPayment({type:'payment.updated',event_id:'evt-'+(p.id||'missing'),data:{object:{payment:p}}})};
};
function orderStatus(o){return JSON.parse(o.notes).squarePaymentStatus}
(async()=>{
 for(const [name,changes,code] of [
   ['missing payment id',{id:''},'SQUARE_PAYMENT_ID_OR_STATUS_REQUIRED'],
   ['wrong location',{location_id:'loc-other'},'SQUARE_LOCATION_MISMATCH'],
   ['missing location',{location_id:''},'SQUARE_LOCATION_MISMATCH'],
   ['wrong amount',{amount_money:{amount:34899,currency:'USD'}},'SQUARE_CAPTURE_AMOUNT_MISMATCH'],
   ['non USD',{amount_money:{amount:34900,currency:'EUR'}},'SQUARE_CAPTURE_AMOUNT_MISMATCH']
 ]){
   const f=createFixture(),initial=JSON.stringify(f.db),got=await f.run({...originalPayment,...changes});
   assert.equal(got.ok,false,name);assert.equal(got.code,code,name);
   assert.equal(JSON.stringify(f.db),initial,'bad payment cannot modify customer/payment/order data '+name);
   assert.equal(f.metrics.saves,0,name);
 }
 const unmatched=createFixture(),initialUnmatched=JSON.stringify(unmatched.db);
 const foreignEvent=await unmatched.run({...originalPayment,order_id:'sq-other'});
 assert.equal(foreignEvent.ignored,true,'unlinked Square order must be ignored');
 assert.equal(JSON.stringify(unmatched.db),initialUnmatched);
 const wrongRecord=createFixture();wrongRecord.rec.sbcOrderId='other-tenant-order';
 const wrongResult=await wrongRecord.run(originalPayment);
 assert.equal(wrongResult.code,'SQUARE_RECORD_LINK_MISMATCH');assert.equal(wrongRecord.metrics.saves,0);
 const reversed=createFixture();reversed.order.paymentStatus='Refunded';
 const refundResult=await reversed.run(originalPayment);
 assert.equal(refundResult.code,'SQUARE_REVERSED_ORDER_REQUIRES_RECONCILIATION');
 assert.equal(reversed.order.paymentStatus,'Refunded');assert.equal(reversed.metrics.saves,0);
 const first=createFixture();
 const result=await first.run(originalPayment);
 assert.equal(result.ok,true);
 assert.equal(result.duplicate,undefined,'first genuine capture must not be dismissed as duplicate because of Paid label');
 assert.equal(orderStatus(first.order),'PAID');
 assert.equal(first.metrics.automation,1,'real first-time Square receipt may start fulfillment');
 assert.equal(first.metrics.saves,1,'first-time receipt persisted');
 const again=await first.run(originalPayment);
 assert.equal(again.duplicate,true,'replayed signed payment must be idempotent');
 assert.equal(first.metrics.automation,1,'replay must not start another vendor job');
 assert.equal(first.metrics.saves,2,'duplicate recognition is durable');
 const stale=await first.run({...originalPayment,status:'PENDING'});
 assert.equal(stale.ignored,true,'out-of-order PENDING event must not undo paid capture');
 assert.equal(first.order.paymentStatus,'Paid');
 assert.equal(first.metrics.saves,2,'late event cannot trigger a save');
 const different=await first.run({...originalPayment,id:'pm-different'});
 assert.equal(different.code,'SQUARE_DIFFERENT_CAPTURE_REQUIRES_RECONCILIATION');
 assert.equal(first.metrics.automation,1);
 assert.ok(!P.persistedCompletion(makeOrder().parsed,originalPayment));
 console.log('[SBC V6659] PASS exact Square payment identity, location, amount; legacy Paid not replay; duplicate safe; no invalid writes or vendor dispatch');
})().catch(e=>{console.error('[SBC V6659]',e.stack||e);process.exitCode=1});
