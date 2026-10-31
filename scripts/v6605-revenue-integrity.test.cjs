'use strict';
/* SBC_V6605_REVENUE_INTEGRITY: no network, no production databases and no payment calls. */
const assert=require('node:assert/strict');
const {createFinancialGovernor}=require('../enterprise/financial-governor-v56-25-3');
const {MIN_MARGIN_PCT}=require('../enterprise/sbc-margin-policy.cjs');
const RAILS=require('../enterprise/v566-scale-revenue-rails');

function poolStub(){
  const costRows=new Map(),ledger=[],queries=[];
  return {costRows,ledger,queries,async query(sql,params=[]){
    queries.push({sql,params});
    if(/^SELECT (item_id FROM sbc_cost_catalog|id FROM sbc_economic_exposure_ledger) LIMIT 0$/.test(sql))return [[],[]];
    if(/INSERT INTO sbc_cost_catalog/.test(sql)){
      const [id,name,wholesale,shipping,source,actor]=params;
      costRows.set(id,{item_id:id,item_name:name,wholesale_cost:wholesale,shipping_cost:shipping,source,actor});
      return [{affectedRows:1}];
    }
    if(/SELECT item_id,item_name,wholesale_cost,shipping_cost FROM sbc_cost_catalog/.test(sql))
      return [[...costRows.values()].filter(x=>params.includes(x.item_id))];
    if(/SELECT COUNT\(\*\) count FROM sbc_cost_catalog/.test(sql))
      return [[{count:[...costRows.keys()].filter(x=>x.startsWith(String(params[0]).slice(0,-1))).length}]];
    if(/SELECT \* FROM sbc_economic_exposure_ledger/.test(sql))return [[]];
    if(/SELECT COALESCE\(SUM\(amount\+vendor_commitment\)/.test(sql))return [[{exposure:0}]];
    if(/INSERT INTO sbc_economic_exposure_ledger/.test(sql)){ledger.push(params);return [{insertId:ledger.length}];}
    throw Error('Unexpected economic test SQL: '+sql.slice(0,130));
  }};
}
const sample=(id,c)=>({itemId:id,itemName:'Verified Service',wholesaleCost:c,shippingCost:1,source:'vendor-invoice',actor:'owner'});
async function test(){
 const db=poolStub();
 const governor=createFinancialGovernor({getPool:()=>db,getAgentOS:()=>({governorEvaluate:async()=>({status:'ALLOWED'})}),logger:{error(){}}});
 assert.ok(!require('node:fs').readFileSync(require('node:path').join(__dirname,'../enterprise/financial-governor-v56-25-3.js'),'utf8').includes('CREATE TABLE IF NOT EXISTS'),'Economic API must not attempt schema-changing DDL');
 await governor.upsertCost({tenantId:1,...sample('SBC_WEB_SETUP',20)});
 await governor.upsertCost({tenantId:2,...sample('SBC_WEB_SETUP',80)});
 assert.equal(db.costRows.size,2,'shared SKU must not share vendor cost across tenants');
 const keys=[...db.costRows.keys()];
 assert.notEqual(keys[0],keys[1]);
 assert.ok(keys[0].startsWith('sbc:1:')&&keys[1].startsWith('sbc:2:'));
 assert.equal((await governor.status(1)).costRows,1);
 assert.equal((await governor.status(2)).costRows,1);
 assert.equal((await governor.status(3)).costRows,0);
 const item={id:'SBC_WEB_SETUP',name:'Verified Service',qty:1,unitPrice:100};
 const ok=await governor.evaluate({tenantId:1,action:'quote_send',items:[item],price:100,idempotencyKey:'tenant-1-quote-1'});
 assert.equal(ok.status,'ALLOWED');
 assert.ok(ok.marginPct>=MIN_MARGIN_PCT);
 assert.equal(governor.MIN_MARGIN_PCT,0.20);
 assert.equal((await governor.status(1)).minMarginPct,0.20);
 const expensive=await governor.evaluate({tenantId:2,action:'quote_send',items:[item],price:100,idempotencyKey:'tenant-2-quote-1'});
 assert.equal(expensive.status,'FROZEN');
 assert.equal(expensive.reason,'MARGIN_TOO_LOW');
 await governor.upsertCost({tenantId:1,...sample('SBC_STARTER_199',150)});
 const starter=await governor.evaluate({tenantId:1,action:'quote_send',items:[{id:'SBC_STARTER_199',qty:1,unitPrice:199}],price:199,idempotencyKey:'starter-199-20pct'});
 assert.equal(starter.status,'ALLOWED','$199 bundle with $151 entered vendor+shipping cost should pass 20% after gateway fee');
 assert.ok(starter.marginPct>=0.20);
 await governor.upsertCost({tenantId:1,...sample('SBC_STARTER_TOO_EXPENSIVE',155)});
 const below=await governor.evaluate({tenantId:1,action:'quote_send',items:[{id:'SBC_STARTER_TOO_EXPENSIVE',qty:1,unitPrice:199}],price:199,idempotencyKey:'starter-199-below-20pct'});
 assert.equal(below.status,'FROZEN','Genuine sub-20% quote must remain blocked');
 assert.equal(below.requiredMarginPct,0.20);
 await assert.rejects(governor.evaluate({tenantId:3,action:'quote_send',items:[item],price:100,idempotencyKey:'tenant-3-quote-1'}),/ECONOMIC_COST_DATA_REQUIRED:SBC_WEB_SETUP/);
 await assert.rejects(governor.upsertCost({tenantId:1,...sample('B',0)}),/ZERO_VENDOR_COST_REQUIRES_OWNER_VERIFICATION/);
 await assert.rejects(governor.upsertCost({tenantId:1,...sample('B',-1)}),/VERIFIED_COST_INVALID/);
 await assert.rejects(governor.upsertCost({itemId:'B',...sample('B',10)}),/TENANT_CONTEXT_REQUIRED/);
 const margin=m=>governor.middleware(m);
 let nexts=0;
 const response={code:200,status(code){this.code=code;return this},json(body){this.body=body;return this}};
 await margin('quote_send')({tenantId:3,path:'/api/quotes',body:{items:[item],total:100},params:{},get(){return ''},user:{}},response,()=>{nexts++});
 assert.equal(response.code,422,'missing costs are a configuration error, not server downtime');
 assert.equal(response.body.error,'ECONOMIC_COST_DATA_REQUIRED');
 assert.equal(nexts,0);
 const sameName=[{id:'a',customerId:'customer-1',status:'Won',price:300},
                 {id:'b',customerId:'customer-1',status:'Fulfilled',price:40},
                 {id:'c',customerId:'customer-1',status:'Paid',price:900},
                 {id:'d',customerId:'customer-1',status:'Fulfilled',price:55,
                   squareOrderId:'so1',squarePaymentId:'sp1',squarePaymentStatus:'COMPLETED',
                   squarePaymentCompletedAt:'2026-10-29T20:00:00Z'}];
 const customer=RAILS.customer360({customers:[{id:'customer-1',businessName:'Test LLC'}],orders:sameName},'customer-1');
 assert.equal(customer.lifetimeValue,55,'only captured Square payment is recognized as collected revenue');
 assert.equal(customer.contractedOrderValue,1295);
 assert.equal(customer.paymentProof.providerVerificationPending,true);
 console.log('[SBC V66 REVENUE INTEGRITY] PASS: tenant prices isolated; cost/margin gate; 422 not 503; verified lifetime value.');
}
test().catch(e=>{console.error(e);process.exitCode=1});
