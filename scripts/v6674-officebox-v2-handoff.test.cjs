'use strict';
// Synthetic evidence only. No provider calls, DB writes or tenant activation.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {prepareHandoff,signHandoffV2,interpretAck}=require('../enterprise/v6674-officebox-v2-handoff.cjs');
const secret='synthetic-contract-signing-key-32-chars-minimum';
const order={id:'sbc_order_example_123',customerId:'cust_example_123',price:349,officeBoxSku:'OFFICE_BOX_BUSINESS',paymentStatus:'Paid',squareOrderId:'square_order_example_123'};
const customer={id:'cust_example_123',businessName:'Example Auto Detail',email:'owner@example.test',industry:'Automotive'};
const squareReadback={source:'SQUARE_PROVIDER_READBACK',providerVerified:true,squareOrderId:'square_order_example_123',payment:{id:'square_payment_123',order_id:'square_order_example_123',location_id:'square_loc_example_1',status:'COMPLETED',amount_money:{amount:34900,currency:'USD'}}};
const commitReceipt={source:'COMMITTED_MYSQL',commitVerified:true};
const args={order,customer,squareReadback,commitReceipt,expectedLocationId:'square_loc_example_1'};
const verified=prepareHandoff(args);
assert.equal(verified.eventType,'customer.subscription.paid');
assert.equal(verified.customerId,customer.id);
assert.deepEqual(Object.keys(verified.payload).sort(),['businessName','industry','orderId','ownerEmail','paymentReference','paymentStatus','plan'].sort());
assert.equal(verified.payload.plan,'business');assert.equal(verified.payload.paymentStatus,'PAID');
assert.equal(prepareHandoff(args).correlationId,verified.correlationId);
const request=signHandoffV2(verified,secret,1700000000);
assert.equal(request.path,'/api/sbc/handoff');
assert.equal(request.headers['x-sbc-timestamp'],'1700000000');
const want=crypto.createHmac('sha256',secret).update('1700000000.'+request.body).digest('hex');
assert.equal(request.headers['x-sbc-signature-v2'],'sha256='+want);
assert.deepEqual(JSON.parse(request.body),verified);
const invalidCases=[
 [{...args,commitReceipt:{source:'COMMITTED_MYSQL',commitVerified:false}},'OFFICEBOX_COMMIT_NOT_VERIFIED'],
 [{...args,squareReadback:{...squareReadback,providerVerified:false}},'OFFICEBOX_SQUARE_READBACK_UNVERIFIED'],
 [{...args,squareReadback:{...squareReadback,payment:{...squareReadback.payment,status:'PENDING'}}},'OFFICEBOX_SQUARE_NOT_SETTLED'],
 [{...args,squareReadback:{...squareReadback,payment:{...squareReadback.payment,amount_money:{amount:1,currency:'USD'}}}},'OFFICEBOX_SQUARE_AMOUNT_MISMATCH'],
 [{...args,squareReadback:{...squareReadback,payment:{...squareReadback.payment,location_id:'unmatched'}}},'OFFICEBOX_SQUARE_IDENTITY_MISMATCH'],
 [{...args,order:{...order,customerId:'wrong_customer'}},'OFFICEBOX_CUSTOMER_ORDER_MISMATCH'],
 [{...args,order:{...order,officeBoxSku:''}},'OFFICEBOX_EXPLICIT_PURCHASE_SKU_REQUIRED'],
 [{...args,order:{...order,launchQaOwnerCreated:true}},'OFFICEBOX_QA_ORDER_NOT_ELIGIBLE'],
 [{...args,order:{...order,paymentStatus:'Pending'}},'OFFICEBOX_ORDER_NOT_PAID'],
 [{...args,customer:{...customer,email:'invalid'}},'OFFICEBOX_CUSTOMER_CONTACT_INVALID']
];
for(const [over,code] of invalidCases)assert.throws(()=>prepareHandoff(over),e=>e.code===code,code);
assert.throws(()=>signHandoffV2(verified,'short',1700000000),/SECRET_NOT_CONFIGURED/);
const ack={ok:true,data:{accepted:true,status:'READY_FOR_ACTIVATION',correlationId:verified.correlationId,activation_url:'https://office-box.example.test/activate?token=synthetic_token'}};
assert.equal(interpretAck(ack).reason,'PENDING_CUSTOMER_ACTIVATION');
assert.equal(interpretAck({ok:true,data:{accepted:true,duplicate:true}}).reason,'OFFICEBOX_RECONCILE_EXISTING_INVITE');
assert.equal(interpretAck({ok:false}).accepted,false);
assert.equal(interpretAck({ok:true,data:{accepted:true,activation_url:'http://localhost/activate?token=x'}}).activationUrl,null);
console.log('SBC V6674 PASS: committed Square event, Office Box V2 envelope and HMAC, replay behavior, QA exclusion. No live I/O.');
