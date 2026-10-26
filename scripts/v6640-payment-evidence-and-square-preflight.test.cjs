'use strict';
const assert=require('node:assert/strict');
const {confirmedPaid,unverifiedFulfillment,snapshot}=require('../enterprise/v6640-payment-evidence.cjs');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const orders=[
 {id:'completed-but-unpaid',status:'Completed',paymentStatus:'Pending',price:199},
 {id:'fulfilled-but-unpaid',status:'Fulfilled',price:349},
 {id:'explicitly-paid',status:'Pending',paymentStatus:'Paid',price:599},
 {id:'square-captured',status:'Pending',paymentStatus:'Pending',metadata:{squarePaymentStatus:'COMPLETED'},price:99},
 {id:'refunded',status:'Completed',paymentStatus:'REFUNDED',squarePaymentStatus:'PAID',price:1000},
 {id:'system-test',status:'Paid',paymentStatus:'Paid',testMode:true,price:1}
];
const report=snapshot(orders,o=>o.testMode===true);
assert.equal(report.paidOrders,2);
assert.equal(report.recognizedPaidRevenue,698);
assert.equal(report.unverifiedFulfillmentOrders,2);
assert.equal(confirmedPaid(orders[0]),false);
assert.equal(confirmedPaid(orders[1]),false);
assert.equal(confirmedPaid(orders[2]),true);
assert.equal(confirmedPaid(orders[3]),true);
assert.equal(confirmedPaid(orders[4]),false);
assert.equal(unverifiedFulfillment(orders[0]),true);
assert.equal(unverifiedFulfillment(orders[3]),false);
assert.match(report.methodology,/fulfillment status never implies payment/);
const patch=fs.readFileSync(path.join(__dirname,'../hotfix-assets/apply-v6640-payment-evidence-and-square-preflight.js'),'utf8');
new vm.Script(patch);
const verifyOrder=patch.indexOf("const sq=circuit('square')");
const mutateOrder=patch.indexOf('    let order=(db.orders||[]).find');
assert.ok(verifyOrder>=0&&mutateOrder>verifyOrder,'Square circuit preflight must run before touching order');
assert.match(patch,/CIRCUIT_OPEN/);
console.log('[SBC V6640] PASS no synthetic revenue, explicit paid proof, ambiguous orders, Square preflight order, strict anchors');
