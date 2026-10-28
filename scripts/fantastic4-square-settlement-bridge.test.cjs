'use strict';
const assert=require('node:assert/strict');
const {purchasedPlan,enqueueCommittedOfficeBoxCapture:enqueue}=require('../ecosystem/office-box-settlement-bridge.cjs');
(async()=>{
 const order={id:'sbc_order_a',tenantId:7,price:349,paymentStatus:'PAID',customerId:'cust_a',customerEmail:'buyer@fixture.invalid'};
 const payment={id:'sq_payment_a',order_id:'sq_order_a',location_id:'sq_location_a',status:'COMPLETED',amount_money:{amount:34900,currency:'USD'}};
 const parsed={squareOrderId:'sq_order_a',squarePaymentId:'sq_payment_a',squarePaymentStatus:'PAID',
  squarePaymentCompletedAt:'2026-10-27T12:00:00Z',items:[{sku:'OFFICE_BOX_BUSINESS',quantity:1}]};
 const paymentRecord={tenantId:7,sbcOrderId:'sbc_order_a',squareOrderId:'sq_order_a',squarePaymentId:'sq_payment_a',status:'PAID'};
 const customer={id:'cust_a',tenantId:7,businessName:'Fixture Co',ownerEmail:'buyer@fixture.invalid'};
 const snapshot={source:'COMMITTED_MYSQL',commitVerified:true,order,payment,parsed,paymentRecord,customer};
 let reads=0,writes=0;
 const seen=new Set();
 const outbox={async enqueue(proof){writes++;
  const {buildPaidHandoff}=require('../enterprise/office-box-paid-handoff.cjs');
  const event=buildPaidHandoff(proof),created=!seen.has(event.correlationId);
  seen.add(event.correlationId);return {eventId:event.correlationId,created};
 }};
 const make=(patch={},snap=snapshot)=>({
  tenantId:7,orderId:'sbc_order_a',squarePaymentId:'sq_payment_a',expectedLocation:'sq_location_a',
  publishedWriter:true,recoveryVerified:true,writerLeaseHeld:true,
  readCommitted:async identity=>{reads++;assert.deepEqual(identity,{tenantId:7,orderId:'sbc_order_a',squarePaymentId:'sq_payment_a'});return snap},
  outbox,...patch
 });
 assert.deepEqual(purchasedPlan([{sku:'OFFICE_BOX_TEAM',quantity:1}]),{sku:'OFFICE_BOX_TEAM',plan:'team'});
 for(const items of [null,[],[{sku:'WEBSITE',quantity:1}],[{sku:'OFFICE_BOX_ADMIN',quantity:1}],
  [{sku:'OFFICE_BOX_BUSINESS',quantity:2}],
  [{sku:'OFFICE_BOX_BUSINESS',quantity:1},{sku:'OFFICE_BOX_TEAM',quantity:1}]]){
  assert.throws(()=>purchasedPlan(items),/OFFICE_BOX_/);
 }
 for(const control of ['publishedWriter','recoveryVerified','writerLeaseHeld']){
  await assert.rejects(()=>enqueue(make({[control]:false})),/PUBLISHED_COMMITTED_WRITER_REQUIRED/);
 }
 assert.equal(reads,0,'writer disabled cannot access customer records');
 assert.equal(writes,0,'writer disabled cannot enqueue');
 for(const change of [
  {source:'BROWSER'},
  {commitVerified:false},
  {order:{...order,tenantId:8}},
  {customer:{...customer,tenantId:8}},
  {paymentRecord:{...paymentRecord,tenantId:8}},
  {order:{...order,customerId:'other'}},
  {parsed:{...parsed,items:[]}},
  {order:{...order,officeBoxSku:'OFFICE_BOX_TEAM'}},
  {payment:{...payment,amount_money:{amount:34901,currency:'USD'}}},
  {payment:{...payment,status:'PENDING'}},
  {payment:{...payment,location_id:'wrong'}},
  {parsed:{...parsed,squarePaymentCompletedAt:''}},
  {order:{...order,paymentStatus:'PENDING'}},
  {customer:{...customer,ownerEmail:'tampered@fixture.invalid'}},
  {paymentRecord:{...paymentRecord,sbcOrderId:'other-order'}}
 ]){
  const value={...snapshot,...change};
  await assert.rejects(()=>enqueue(make({},value)),/OFFICE_BOX_|SQUARE_/);
 }
 assert.equal(writes,0,'invalid committed snapshots never queue an outbox event');
 const one=await enqueue(make());
 assert.equal(one.status,'QUEUED');assert.equal(one.externalSent,false);
 assert.equal(one.tenantActivated,false);assert.equal(one.tenantId,7);
 assert(/^officebox_[a-f0-9]{40}$/.test(one.eventId));
 const two=await enqueue(make());
 assert.equal(two.status,'ALREADY_QUEUED');assert.equal(one.eventId,two.eventId);
 assert.equal(seen.size,1,'replayed provider event creates exactly one durable event ID');
 await assert.rejects(()=>enqueue(make({outbox:{enqueue:async()=>({eventId:'wrong',created:true})}})),/OUTBOX_ACK_INCONSISTENT/);
 assert.equal(seen.size,1);
 console.log('SBC P0 COMMITTED SQUARE → OFFICE BOX BRIDGE PASS: post-commit read, tenant, SKU, payment, idempotent queue, no dispatch');
})().catch(e=>{console.error(e);process.exitCode=1});
