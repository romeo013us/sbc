'use strict';
/* SBC 9.5 revenue-proof regression: isolated, no database, Square credentials or network.
 * These tests verify behavior of production pure functions and a stubbed checkout transaction.
 * They DO NOT substitute for a real Square captured-payment/authoritative MySQL test.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const evidence=require('../enterprise/v6640-payment-evidence.cjs');
const square=require('../enterprise/v6645-square-checkout-safety.cjs');
const Checkout=require('../enterprise/StorefrontCheckoutEventHandler.js');

const directory=path.join(__dirname,'..');
const c360=fs.readFileSync(path.join(directory,'public/sbc-customer360-workspace-v6525.js'),'utf8');
assert.equal(c360,fs.readFileSync(path.join(directory,'browser_public/sbc-customer360-workspace-v6525.js'),'utf8'));
assert.equal((c360.match(/\['paid'\]\.includes/g)||[]).length,3,'all three customer checkout guards should only classify Paid');
assert.doesNotMatch(c360,/\['paid','won','completed'\]/,'won cannot masquerade as settled');
assert.match(c360,/Won means the sale is agreed, not paid/);

const squarePaid={
  id:'o1',status:'Fulfilled',paymentStatus:'PAID',price:100.25,
  squareOrderId:'so1',squarePaymentId:'sp1',squarePaymentLinkId:'sl1',
  squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-10-29T20:00:00Z'
};
assert.equal(evidence.providerCapturedSquare(squarePaid),true);
assert.equal(evidence.confirmedPaid(squarePaid),true);
assert.equal(evidence.confirmedPaid({...squarePaid,squarePaymentStatus:'REFUNDED'}),false);
assert.equal(evidence.providerCapturedSquare({...squarePaid,squarePaymentCompletedAt:null}),false);
assert.equal(evidence.confirmedPaid({...squarePaid,squarePaymentId:''}),false);
assert.equal(evidence.confirmedPaid({status:'Won',price:500}),false);
assert.equal(evidence.confirmedPaid({status:'Paid',price:500}),false);
assert.equal(evidence.providerCapturedSquare({paymentStatus:'PAID',price:500}),false);
assert.equal(evidence.confirmedPaid({paymentStatus:'PAID',price:500}),true,'historical payment flag classification is distinct from verified Square capture');
const revenue=evidence.snapshot([squarePaid,{status:'Paid',price:999},{paymentStatus:'PAID',price:500}]);
assert.equal(revenue.paidOrders,1);
assert.equal(revenue.recognizedPaidRevenue,100.25);
assert.equal(revenue.statusOnlyPaidNeedsReview,1);
assert.equal(revenue.providerVerificationPending,true);

const inputs={tenantId:'tenant-1',orderId:'order-1',locationId:'loc-1',amountCents:10025,environment:'production'};
const key=square.linkIdempotencyKey(inputs);
assert.equal(key,square.linkIdempotencyKey({...inputs}));
for(const changed of [{tenantId:'tenant-2'},{orderId:'order-2'},{locationId:'loc-2'},{amountCents:10026},{environment:'sandbox'}]){
  assert.notEqual(key,square.linkIdempotencyKey({...inputs,...changed}));
}
assert.throws(()=>square.linkIdempotencyKey({...inputs,amountCents:0}),/INVALID/);
const payment={id:'sp1',status:'COMPLETED',order_id:'so1',location_id:'loc-1',amount_money:{amount:10025,currency:'USD'}};
const expected={squareOrderId:'so1',locationId:'loc-1',expectedAmountCents:10025};
assert.equal(square.capturedForOrder(payment,expected),true);
assert.equal(square.capturedForOrder({...payment,status:'APPROVED'},expected),false);
assert.equal(square.capturedForOrder({...payment,location_id:'loc-2'},expected),false);
assert.equal(square.capturedForOrder({...payment,amount_money:{amount:10024,currency:'USD'}},expected),false);
assert.equal(square.capturedForOrder({...payment,amount_money:{amount:10025,currency:'CAD'}},expected),false);

function fakePool({vendorCost=null,blocked=false,duplicate=false}={}){
  const calls=[];let inserted=0,rolled=0,committed=0,released=0;
  const conn={
    async beginTransaction(){calls.push('BEGIN')},
    async rollback(){rolled++;calls.push('ROLLBACK')},
    async commit(){committed++;calls.push('COMMIT')},
    release(){released++;calls.push('RELEASE')},
    async query(sql,params=[]){
      calls.push({sql,params});
      if(sql.includes('FROM sbc_global_settings'))return [[...(blocked?[{setting_value:'1'}]:[])]];
      if(sql.includes('FROM sbc_product_catalog')){
        assert.match(sql,/tenant_id\s*=\s*\?/);
        assert.match(sql,/sku\s*=\s*\?/);
        assert.deepEqual(params,['tenant-1','SBC_VALID_SKU']);
        return [[...(vendorCost===null?[]:[{sku:'SBC_VALID_SKU',vendor_cost:vendorCost,retail_price:100,active:1,economic_status:'ACTIVE'}])]];
      }
      if(sql.includes('FROM sbc_checkout_event_ledger')){
        return [[...(duplicate?[{id:1,status:'QUEUED',revenue_event_id:2,agent_event_id:3}]:[])]];
      }
      if(/^\s*INSERT\b/i.test(sql))return [{insertId:++inserted}];
      if(/^\s*UPDATE\b/i.test(sql))return [{affectedRows:1}];
      throw Error('Unexpected SQL in mocked checkout: '+sql.slice(0,100));
    }
  };
  return {pool:{async getConnection(){return conn;}},calls,get summary(){return {inserted,rolled,committed,released}}};
}
const purchase={provider:'square',provider_event_id:'evt1',tenant_id:'tenant-1',sku:'SBC_VALID_SKU',order_id:'order1',amount:100,currency:'USD'};
async function check(){
  const missing=fakePool();
  let result=await new Checkout({pool:missing.pool}).handle(purchase);
  assert.equal(result.accepted,false);assert.equal(result.reason,'UNCONFIGURED_SKU_COST_REJECTION');
  assert.equal(missing.summary.inserted,0);assert.equal(missing.summary.rolled,1);
  assert.equal(missing.summary.committed,0);assert.equal(missing.summary.released,1);

  const lowMargin=fakePool({vendorCost:85});
  result=await new Checkout({pool:lowMargin.pool}).handle(purchase);
  assert.equal(result.accepted,false);assert.equal(result.reason,'MARGIN_BELOW_MINIMUM_POLICY_THRESHOLD');
  assert.equal(lowMargin.summary.inserted,0);assert.equal(lowMargin.summary.rolled,1);

  const stop=fakePool({vendorCost:15,blocked:true});
  result=await new Checkout({pool:stop.pool}).handle(purchase);
  assert.equal(result.status,'FROZEN_GLOBAL_KILL_SWITCH');
  assert.equal(stop.summary.inserted,0);assert.equal(stop.summary.committed,0);

  const duplicate=fakePool({vendorCost:15,duplicate:true});
  result=await new Checkout({pool:duplicate.pool}).handle(purchase);
  assert.equal(result.status,'REJECTED_DUPLICATE');
  assert.equal(duplicate.summary.committed,0);

  const accepted=fakePool({vendorCost:25});
  result=await new Checkout({pool:accepted.pool}).handle(purchase);
  assert.equal(result.accepted,true);assert.equal(result.status,'QUEUED');
  assert.equal(accepted.summary.committed,1);assert.equal(accepted.summary.rolled,0);
  assert.equal(accepted.summary.inserted,3);
  assert.equal(accepted.summary.released,1);

  const badSignature=fakePool({vendorCost:25});
  result=await new Checkout({pool:badSignature.pool,signatureVerifier:async()=>false}).handle(purchase);
  assert.equal(result.status,'REJECTED_SIGNATURE');assert.equal(badSignature.calls.length,0);

  console.log('[SBC 9.5 PAYMENT] PASS: status truth, Square proof, tenant/supplier costs, margin, kill switch, duplicate, atomic checkout and signature checks');
}
check().catch(e=>{console.error(e);process.exitCode=1});
