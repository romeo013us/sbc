'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {verifyReadback,outcome}=require('../enterprise/v6671-square-webhook-readback.cjs');
const {patchServer,MARK}=require('./v6671-square-webhook-stage.cjs');
const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const staged=patchServer(source).source;
assert.equal(patchServer(staged).source,staged,'staging compiler idempotent');
assert.ok(staged.includes(MARK));
const section=staged.slice(staged.indexOf("async function handleSquarePaymentEvent("),staged.indexOf("async function processPendingSquareWebhooks("));
assert.ok(section.includes("SQUARE_COMPLETED_PAYMENT_UNMATCHED"),'unlinked completed payment is not silently ignored');
assert.ok(section.includes("const provider=await squareApi('/v2/payments/'+encodeURIComponent(squarePaymentId));"));
assert.ok(section.indexOf("verifyReadback(payment,provider?.payment)")<section.indexOf("SBC_V6659_SQUARE_PROOF.validateCompleted("),'readback must precede ledger mutation');
assert.equal((staged.match(/rec\.status=SBC_V6671_SQUARE_WEBHOOK\.outcome\(result\)/g)||[]).length,2,'both queue and retry worker classify reconciliation');
const payment={id:'pay_abc',order_id:'sqord_1',location_id:'LOC_1',status:'COMPLETED',amount_money:{amount:19900,currency:'USD'}};
const matching={...payment,amount_money:{...payment.amount_money}};
assert.deepEqual(verifyReadback(payment,matching),{ok:true});
for(const [data,expected] of [
 [{...payment,id:'pay_other'},'SQUARE_PAYMENT_ID_READBACK_MISMATCH'],
 [{...payment,status:'PENDING'},'SQUARE_PROVIDER_CAPTURE_NOT_COMPLETED'],
 [{...payment,order_id:'wrong'},'SQUARE_PROVIDER_ORDER_READBACK_MISMATCH'],
 [{...payment,location_id:'wrong'},'SQUARE_PROVIDER_LOCATION_READBACK_MISMATCH'],
 [{...payment,amount_money:{amount:9900,currency:'USD'}},'SQUARE_PROVIDER_AMOUNT_READBACK_MISMATCH'],
 [{...payment,amount_money:{amount:19900,currency:'EUR'}},'SQUARE_PROVIDER_AMOUNT_READBACK_MISMATCH']
 ]){
 const result=verifyReadback(payment,data);
 assert.equal(result.ok,false);
 assert.equal(result.code,expected);
}
assert.equal(outcome({ignored:true}),'PROCESSED');
assert.equal(outcome({ok:true,status:'PAID'}),'PROCESSED');
assert.equal(outcome({ok:false,status:'RECONCILIATION_REQUIRED',code:'SQUARE_COMPLETED_PAYMENT_UNMATCHED'}),'RECONCILIATION_REQUIRED');
assert.equal(outcome({ok:false,status:'AMOUNT_MISMATCH'}),'RECONCILIATION_REQUIRED');
assert.equal(outcome({ok:false}),'RECONCILIATION_REQUIRED');
console.log('[SBC V6671] PASS: provider-completed proof, order/location/amount match, no orphan auto-fulfillment, reconciliation retained on both processing paths, zero financial writes');
