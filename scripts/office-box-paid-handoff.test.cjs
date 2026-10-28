'use strict';
const assert=require('node:assert/strict');const crypto=require('node:crypto');
const {buildPaidHandoff,signPaidHandoff}=require('../enterprise/office-box-paid-handoff.cjs');
const order={id:'sbc_order_100',price:349,paymentStatus:'PAID',officeBoxSku:'OFFICE_BOX_BUSINESS',customerId:'sbc_customer_100',customerEmail:'owner@fixture.invalid'};
const payment={id:'square_payment_100',order_id:'square_order_100',location_id:'square_location_100',status:'COMPLETED',amount_money:{amount:34900,currency:'USD'}};
const parsed={squareOrderId:'square_order_100',squarePaymentId:'square_payment_100',squarePaymentStatus:'PAID',squarePaymentCompletedAt:'2026-10-27T10:00:00.000Z'};
const paymentRecord={sbcOrderId:order.id,squareOrderId:payment.order_id,squarePaymentId:payment.id,status:'PAID'};
const customer={id:'sbc_customer_100',businessName:'Fixture Test Co',ownerEmail:'owner@fixture.invalid',industry:'Agency'};
const input={order,parsed,payment,paymentRecord,expectedLocation:'square_location_100',customer,plan:'business'};
const evt=buildPaidHandoff(input),evt2=buildPaidHandoff(input);assert.deepEqual(evt,evt2);
assert.equal(evt.eventType,'customer.subscription.paid');assert.equal(evt.payload.orderId,order.id);
const secret='sbc-officebox-verification-secret-64-characters-long';const signed=signPaidHandoff(evt,secret,{nowSeconds:1793100000});
const raw=Buffer.from(signed.body),expected=crypto.createHmac('sha256',secret).update(raw).digest('hex');
assert.equal(signed.headers['x-sbc-signature'],'sha256='+expected);
assert.equal(signed.headers['x-sbc-signature-v2'],'sha256='+crypto.createHmac('sha256',secret).update('1793100000.').update(raw).digest('hex'));
for(const change of [
 x=>({...x,payment:{...x.payment,status:'PENDING'}}),
 x=>({...x,payment:{...x.payment,location_id:'other-location'}}),
 x=>({...x,payment:{...x.payment,amount_money:{amount:1,currency:'USD'}}}),
 x=>({...x,parsed:{...x.parsed,squarePaymentStatus:'UNPAID'}}),
 x=>({...x,order:{...x.order,paymentStatus:'REFUNDED'}}),
 x=>({...x,order:{...x.order,officeBoxSku:'WEBSITE_BUNDLE'}}),
 x=>({...x,order:{...x.order,isTest:true}}),
 x=>({...x,paymentRecord:{...x.paymentRecord,squarePaymentId:'another-tender'}}),
 x=>({...x,customer:{...x.customer,ownerEmail:'not-an-email'}}),
 x=>({...x,customer:{...x.customer,ownerEmail:'other@fixture.invalid'}}),
 x=>({...x,order:{...x.order,customerId:'another-customer'}})
])assert.throws(()=>buildPaidHandoff(change(input)));
assert.throws(()=>signPaidHandoff(evt,'short'));
console.log('SBC VERIFIED OFFICE BOX HANDOFF: PASS (stable event identity, dual signatures, invalid provider evidence rejected)');
