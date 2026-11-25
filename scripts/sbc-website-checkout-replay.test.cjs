'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {inspectExisting}=require('../enterprise/v6672-site-checkout-integrity.cjs');
const requestId='sbcweb_'+'a'.repeat(32);
const order={id:'order-a',tenantId:7,customerId:'customer-a',status:'New',paymentStatus:'Pending',paymentUrl:'https://square.link/u/example',notes:JSON.stringify({websiteCheckoutRequestId:requestId,bundleId:'starter',squareOrderId:'square-order-a'})};
const customer={id:'customer-a',tenantId:7,businessName:'Synthetic Shop',email:'owner@example.test'};
const input={tenantId:7,clientRequestId:requestId,packageId:'starter',email:customer.email,businessName:customer.businessName,orders:[order],customers:[customer]};
test('terminal and failed checkout states never return old links',()=>{for(const field of ['status','paymentStatus'])for(const state of ['Cancelled','Canceled','Refunded','Expired','Failed','Deleted','Archived','Void','Voided','Partially Refunded']){const r=inspectExisting({...input,orders:[{...order,[field]:state}]});assert.equal(r.code,'WEBSITE_CHECKOUT_RECONCILIATION_REQUIRED',field+': '+state);assert.equal(r.automaticRetry,false);assert.equal(r.paymentUrl,undefined);}});
test('duplicate checkout correlation requires reconciliation rather than selecting first match',()=>{const r=inspectExisting({...input,orders:[order,{...order,id:'order-b'}]});assert.equal(r.code,'WEBSITE_CHECKOUT_RECONCILIATION_REQUIRED');assert.equal(r.automaticRetry,false);assert.equal(r.paymentUrl,undefined);});
test('valid pending replay remains idempotent, paid state is blocked, foreign tenant ignored',()=>{assert.equal(inspectExisting(input).noNewPaymentLink,true);assert.equal(inspectExisting({...input,orders:[{...order,paymentStatus:'Paid'}]}).code,'WEBSITE_CHECKOUT_ALREADY_PAID');assert.deepEqual(inspectExisting({...input,tenantId:8}),{found:false});});
test('malformed null metadata on unrelated orders does not block a valid replay',()=>{assert.equal(inspectExisting({...input,orders:[{...order,id:'other',notes:'null'},order]}).noNewPaymentLink,true);});

test('checkout replay rejects ambiguous customer identity and conflicting saved provider links',()=>{
 assert.equal(inspectExisting({...input,customers:[customer,{...customer}]}).code,'WEBSITE_CHECKOUT_RECONCILIATION_REQUIRED');
 const mismatched={...order,notes:JSON.stringify({...JSON.parse(order.notes),squarePaymentLinkUrl:'https://square.link/u/other'})};
 assert.equal(inspectExisting({...input,orders:[mismatched]}).code,'WEBSITE_CHECKOUT_RECONCILIATION_REQUIRED');
 const same={...order,notes:JSON.stringify({...JSON.parse(order.notes),squarePaymentLinkUrl:order.paymentUrl})};
 assert.equal(inspectExisting({...input,orders:[same]}).noNewPaymentLink,true);
});
