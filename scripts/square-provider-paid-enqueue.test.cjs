'use strict';
/** End-to-end synthetic verification of the OFF-by-default paid queue boundary.
 * Real pre-saved MySQL proof -> fresh Square GET -> exact paid event -> queue.
 * No real Square, MySQL, customer, Office Box, or network writes in this test.
 */
const assert=require('node:assert/strict');
const {createSquareSettlementVerifier}=require('../ecosystem/square-provider-settlement.cjs');
const {enqueueVerifiedCommittedOfficeBox}=require('../ecosystem/office-box-committed-enqueue.cjs');
const {buildPaidHandoff}=require('../enterprise/office-box-paid-handoff.cjs');
const now=Date.parse('2026-10-28T19:00:00Z');
const payment={id:'square_payment_fake_900',order_id:'square_order_fake_900',location_id:'square_location_fake_900',
 status:'COMPLETED',created_at:'2026-10-27T19:00:00Z',
 amount_money:{amount:34900,currency:'USD'},refunded_money:{amount:0,currency:'USD'},refund_ids:[]};
const notes={squareOrderId:payment.order_id,squarePaymentId:payment.id,
 squarePaymentStatus:'PAID',squarePaymentCompletedAt:'2026-10-28T18:00:00Z',
 customerEmail:'buyer@example.invalid',officeBoxSku:'OFFICE_BOX_BUSINESS',
 items:[{sku:'OFFICE_BOX_BUSINESS',quantity:1}]};
const order={id:'sbc_order_fake_900',tenant_id:7,customer_id:'sbc_customer_fake_900',
 customer_name:'Synthetic Customer',product:'Office Box',price:'349.00',status:'Paid',notes:JSON.stringify(notes)};
const customer={id:order.customer_id,tenant_id:7,business_name:'Synthetic Shop',
 email:'buyer@example.invalid',industry:'Services'};
const capture={tenantId:7,sbcOrderId:order.id,squareOrderId:payment.order_id,
 squarePaymentId:payment.id,status:'PAID',amount:349,currency:'USD'};
let refunded=false,disputed=false,writerLeaseHeld=true,sqlReads=0,queued=0,getCalls=0;
const pool={async getConnection(){return{
 async query(sql,args){
  sqlReads++;
  if(sql==='START TRANSACTION READ ONLY')return [[],[]];
  if(sql.includes('FROM sbc_orders'))return [args[0]===order.id&&args[1]===7?[order]:[]];
  if(sql.includes('FROM sbc_customers'))return [args[0]===customer.id&&args[1]===7?[customer]:[]];
  if(sql.includes('FROM sbc_workspace'))return [[{payload:JSON.stringify({squarePayments:[capture]})}]];
  throw Error('TEST_SQL_UNEXPECTED');
 },async rollback(){},release(){}
}}};
const transport=async(url,opt)=>{
 getCalls++;assert.equal(opt.method,'GET');assert.equal(opt.redirect,'error');
 assert(url.startsWith('https://connect.squareup.com/v2/'));
 const pathname=new URL(url).pathname;
 const body=pathname.startsWith('/v2/payments/')?{payment}:
  pathname==='/v2/refunds'?{refunds:refunded?[{payment_id:payment.id,status:'PENDING'}]:[]}:
  pathname==='/v2/disputes'?{disputes:disputed?
   [{disputed_payment:{payment_id:payment.id},state:'EVIDENCE_REQUIRED'}]:[]}:
   (()=>{throw Error('BAD_TEST_URL')})();
 return {status:200,text:async()=>JSON.stringify(body)};
};
const verifier=createSquareSettlementVerifier({accessToken:'ci-synthetic-token-not-valid',transport,clock:()=>now});
const writerAuthority=async()=>({publishedWriter:true,recoveryVerified:true,writerLeaseHeld});
const outbox={async enqueue(proof){
 queued++;
 assert.equal(proof.customer.ownerEmail,'buyer@example.invalid');
 assert.equal(proof.plan,'business');
 const event=buildPaidHandoff(proof);
 assert.equal(event.payload.paymentReference,payment.id);
 return {eventId:event.correlationId,created:queued===1};
}};
const request={pool,orderId:order.id,tenantId:7,payment,expectedLocation:payment.location_id,
 outbox,enabled:true,publishedWriter:true,writerAuthority,
 verifyLiveSettlement:verifier.verifyLiveSettlement,clock:()=>now};
(async()=>{
 await assert.rejects(()=>enqueueVerifiedCommittedOfficeBox({...request,enabled:false}),/RECONCILIATION_DISABLED/);
 assert.equal(sqlReads,0);assert.equal(getCalls,0);
 let r=await enqueueVerifiedCommittedOfficeBox(request);
 assert.equal(r.state,'PENDING_DISPATCH');assert.equal(r.created,true);assert.equal(queued,1);
 assert.equal(r.source,'READ_ONLY_COMMITTED_MYSQL');
 assert.equal(getCalls,3);
 r=await enqueueVerifiedCommittedOfficeBox(request);
 assert.equal(r.created,false);assert.equal(queued,2);
 disputed=true;
 await assert.rejects(()=>enqueueVerifiedCommittedOfficeBox(request),/SQUARE_PAYMENT_DISPUTE_EXISTS/);
 assert.equal(queued,2);
 disputed=false;refunded=true;
 await assert.rejects(()=>enqueueVerifiedCommittedOfficeBox(request),/SQUARE_PAYMENT_REFUND_EXISTS/);
 assert.equal(queued,2);
 refunded=false;writerLeaseHeld=false;const before=sqlReads;
 await assert.rejects(()=>enqueueVerifiedCommittedOfficeBox(request),/PUBLISHED_WRITER_REVOKED/);
 assert.equal(sqlReads,before,'lost live writer lease must stop before MySQL reads');
 assert.equal(queued,2);
 console.log('[SBC SQUARE PROVIDER → COMMITTED MYSQL → PAID OUTBOX] PASS: approved only after 3 fresh Square GET pages, verified tenant/plan/payment, exact queue; disputes/refunds/lease fail closed; no real IO');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
