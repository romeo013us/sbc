'use strict';
const assert=require('node:assert/strict');
const {loadCommittedOfficeBoxPayment,purchasedOfficeBoxSku}
 =require('../ecosystem/office-box-committed-readback.cjs');
const inputPayment={id:'square_payment_ci_101',order_id:'square_order_ci_101',
 location_id:'square_location_ci',status:'COMPLETED',
 amount_money:{amount:34900,currency:'USD'}};
const notes={squareOrderId:inputPayment.order_id,squarePaymentId:inputPayment.id,
 squarePaymentStatus:'PAID',squarePaymentCompletedAt:'2026-10-28T12:00:00Z',
 customerEmail:'buyer@example.invalid',officeBoxSku:'OFFICE_BOX_BUSINESS',
 items:[{sku:'OFFICE_BOX_BUSINESS',quantity:1}]};
const row={id:'sbc_order_ci_101',tenant_id:7,customer_id:'sbc_customer_ci_101',
 customer_name:'CI Customer',product:'Office Box',price:'349.00',status:'Paid',
 notes:JSON.stringify(notes)};
const customer={id:row.customer_id,tenant_id:7,business_name:'Synthetic Shop',
 email:notes.customerEmail,industry:'Barbershop'};
const capture={sbcOrderId:row.id,squareOrderId:inputPayment.order_id,
 squarePaymentId:inputPayment.id,status:'PAID',amount:349,currency:'USD'};
const snapshot={order:row,customer,workspace:{payload:JSON.stringify({squarePayments:[capture]})}};
const proofRequest={orderId:row.id,tenantId:7,payment:inputPayment,expectedLocation:'square_location_ci'};
function fixture(data=snapshot){
 const seen=[];let released=false,rolledBack=false,failedWriteAttempt=false;
 const pool={async getConnection(){return{
  async query(sql,args){
   seen.push([sql,args]);
   if(!/^(START TRANSACTION READ ONLY|SELECT )/.test(sql))failedWriteAttempt=true;
   if(sql==='START TRANSACTION READ ONLY')return [[],[]];
   if(sql.includes('FROM sbc_orders'))return [data.order&&String(data.order.tenant_id)===String(args[1])?[data.order]:[]];
   if(sql.includes('FROM sbc_customers'))return [data.customer&&String(data.customer.tenant_id)===String(args[1])?[data.customer]:[]];
   if(sql.includes('FROM sbc_workspace'))return [data.workspace?[data.workspace]:[]];
   throw Error('Unexpected SQL');
  },
  async rollback(){rolledBack=true},release(){released=true}
 }}};
 return {pool,seen,state:()=>({released,rolledBack,failedWriteAttempt})};
}
(async()=>{
 assert.deepEqual(purchasedOfficeBoxSku(notes),{sku:'OFFICE_BOX_BUSINESS',plan:'business'});
 let f=fixture(),verified=await loadCommittedOfficeBoxPayment({...proofRequest,pool:f.pool});
 assert.equal(verified.source,'READ_ONLY_COMMITTED_MYSQL');
 assert.equal(verified.event.eventType,'customer.subscription.paid');
 assert.equal(verified.event.payload.orderId,row.id);
 assert.equal(verified.event.payload.ownerEmail,notes.customerEmail);
 assert.equal(verified.event.payload.paymentReference,inputPayment.id);
 assert.equal(verified.verified.plan,'business');
 assert.deepEqual(f.state(),{released:true,rolledBack:true,failedWriteAttempt:false});
 assert.equal(f.seen.length,4);
 assert.deepEqual(f.seen[1][1],[row.id,7]);
 assert.deepEqual(f.seen[2][1],[customer.id,7]);
 const bad=[
  [{order:{...row,status:'Pending'}},'COMMITTED_ORDER_NOT_PAID'],
  [{order:null},'COMMITTED_ORDER_MISSING'],
  [{customer:null},'COMMITTED_CUSTOMER_MISSING'],
  [{customer:{...customer,email:'other@example.invalid'}},'ORDER_BILLING_EMAIL_MISMATCH'],
  [{order:{...row,notes:JSON.stringify({...notes,items:[{sku:'OFFICE_BOX_TEAM',quantity:1}]})}},'OFFICE_BOX_SKU_CONFLICT'],
  [{order:{...row,notes:JSON.stringify({...notes,items:[{sku:'GENERIC_CRM'}]})}},'EXACTLY_ONE_PURCHASED_SKU_REQUIRED'],
  [{order:{...row,notes:JSON.stringify({...notes,items:[{sku:'OFFICE_BOX_BUSINESS',quantity:2}]})}},'APPROVED_ONE_SEAT_PLAN_REQUIRED'],
  [{order:{...row,notes:JSON.stringify({...notes,items:[{sku:'OFFICE_BOX_BUSINESS'}]})}},'APPROVED_ONE_SEAT_PLAN_REQUIRED'],
  [{order:{...row,notes:JSON.stringify({...notes,items:[{sku:'OFFICE_BOX_BUSINESS',quantity:1},{sku:'OFFICE_BOX_ENTERPRISE',quantity:1}]})}},'EXACTLY_ONE_PURCHASED_SKU_REQUIRED'],
  [{order:{...row,notes:JSON.stringify({...notes,items:[{sku:'OFFICE_BOX_ENTERPRISE',quantity:1}],officeBoxSku:'OFFICE_BOX_ENTERPRISE'})}},'APPROVED_ONE_SEAT_PLAN_REQUIRED'],
  [{workspace:{payload:JSON.stringify({squarePayments:[{...capture,tenantId:8}]})}},'COMMITTED_CAPTURE_TENANT_MISMATCH'],
  [{workspace:{payload:JSON.stringify({squarePayments:[]})}},'COMMITTED_CAPTURE_AMBIGUOUS_OR_MISSING'],
  [{workspace:{payload:JSON.stringify({squarePayments:[capture,capture]})}},'COMMITTED_CAPTURE_AMBIGUOUS_OR_MISSING'],
  [{workspace:{payload:JSON.stringify({squarePayments:[{...capture,status:'PENDING'}]})}},'COMMITTED_CAPTURE_MISMATCH'],
  [{workspace:{payload:JSON.stringify({squarePayments:[{...capture,amount:599}]})}},'COMMITTED_CAPTURE_MISMATCH'],
  [{workspace:{payload:JSON.stringify({squarePayments:[{...capture,currency:'CAD'}]})}},'COMMITTED_CAPTURE_MISMATCH'],
 ];
 for(const [overrides,expected] of bad){
  f=fixture({...snapshot,...overrides});
  try{
   await loadCommittedOfficeBoxPayment({...proofRequest,pool:f.pool});
   throw Error('INVALID_PROOF_WAS_ACCEPTED '+expected);
  }catch(e){
   assert(String(e.code||e.message).includes(expected),String(e));
  }
  assert.deepEqual(f.state(),{released:true,rolledBack:true,failedWriteAttempt:false});
 }
 const another=fixture();
 await assert.rejects(()=>loadCommittedOfficeBoxPayment({...proofRequest,tenantId:8,pool:another.pool}),
  /OFFICE_BOX_VERIFIED_CAPTURE_REQUIRED|OFFICE_BOX_COMMITTED_ORDER/);
 assert.deepEqual(another.state(),{released:true,rolledBack:true,failedWriteAttempt:false});
 await assert.rejects(()=>loadCommittedOfficeBoxPayment({...proofRequest,expectedLocation:'other',pool:fixture().pool}),
  /SQUARE_LOCATION_MISMATCH|VERIFIED_CAPTURE_REQUIRED/);
 await assert.rejects(()=>loadCommittedOfficeBoxPayment({...proofRequest,tenantId:0,pool:fixture().pool}),
  /OFFICE_BOX_TRUSTED_ORDER_TENANT_REQUIRED/);
 console.log('[SBC OFFICE BOX MYSQL READBACK] PASS: read-only transaction, source-stable order/plan/capture/email, ambiguous/missing proof refusal; no writes/HTTP');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
