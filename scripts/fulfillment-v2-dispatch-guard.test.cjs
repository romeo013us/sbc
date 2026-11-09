'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {assertVendorDispatchAuthorized:guard}=require('../enterprise/fulfillment-v2-dispatch-guard.cjs');
const Gateway=require('../enterprise/stateless-fulfillment-gateway.js');
const base=()=>({id:'job_123',orderId:'ord_123',tenantId:1,idempotencyKey:'sbc:job_123',ownerApproval:{approved:true,actorId:'owner_1',approvedAt:'2026-11-09T20:00:00Z'},paymentEvidence:{id:'ord_123',tenantId:1,paymentStatus:'PAID',squareOrderId:'sqorder_123',squarePaymentId:'sqpay_123',squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-11-09T20:00:00Z'}});
test('valid evidenced authorized vendor job passes',()=>assert.equal(guard(base()),true));
for(const [label,mutate] of [
 ['unpaid',j=>{j.paymentEvidence.paymentStatus='PENDING';j.paymentEvidence.squarePaymentStatus='PENDING'}],
 ['status only',j=>{delete j.paymentEvidence.squareOrderId;delete j.paymentEvidence.squarePaymentId}],
 ['refunded',j=>{j.paymentEvidence.paymentStatus='REFUNDED'}],
 ['tenant mismatch',j=>{j.paymentEvidence.tenantId=2}],
 ['order mismatch',j=>{j.paymentEvidence.id='ord_other'}],
 ['missing approval',j=>{delete j.ownerApproval}],
 ['qa',j=>{j.qaMode=true}],
 ['unknown submission',j=>{j.vendorSubmissionStatus='SUBMISSION_OUTCOME_UNKNOWN'}],
 ['duplicate submission',j=>{j.vendorSubmissionStatus='SUBMITTED'}],
 ['no idempotency',j=>{delete j.idempotencyKey}]
])test('reject '+label,()=>{const j=base();mutate(j);assert.throws(()=>guard(j))});
test('gateway blocks before vendor network call',async()=>{const g=new Gateway({env:{FOUROVER4_ORDER_ENDPOINT:'https://invalid.example',FOUROVER4_API_KEY:'fake',SBC_FOUROVER4_AUTO_EXECUTE:'true'}});await assert.rejects(g.dispatchToVendor({...base(),qaMode:true}));});
