'use strict';
/*
 * SBC_V6610_SHARED_MARGIN_POLICY — entirely mocked economic acceptance tests.
 * No GoDaddy, Square, production database, customer data or external calls.
 */
const assert=require('node:assert/strict');
const {MIN_MARGIN_PCT}=require('../enterprise/sbc-margin-policy.cjs');
const Handler=require('../enterprise/StorefrontCheckoutEventHandler');
const Worker=require('../workers/checkout-event-worker');

function checkoutFixture(vendorCost){
  const state={commits:0,rollbacks:0,queries:[]};
  const connection={
    async beginTransaction(){},async commit(){state.commits++},async rollback(){state.rollbacks++},release(){},
    async query(sql,params=[]){
      state.queries.push({sql,params});
      if(sql.includes('FROM sbc_global_settings'))return [[]];
      if(sql.includes('FROM sbc_product_catalog'))return [[{sku:'STARTER',product_name:'SBC Starter',vendor_cost:vendorCost,retail_price:199,active:1,economic_status:'ACTIVE'}]];
      if(sql.includes('FROM sbc_checkout_event_ledger')&&sql.includes('SELECT id, status'))return [[]];
      if(sql.includes('INSERT INTO sbc_checkout_event_ledger'))return [{insertId:101}];
      if(sql.includes('INSERT INTO sbc_revenue_event_ledger'))return [{insertId:102}];
      if(sql.includes('INSERT INTO sbc_agent_event_bus'))return [{insertId:103}];
      if(sql.includes('UPDATE sbc_checkout_event_ledger'))return [{affectedRows:1}];
      throw Error('Unexpected checkout SQL: '+sql.slice(0,120));
    }
  };
  return {state,pool:{async getConnection(){return connection}}};
}
function fulfillmentFixture(marginPct){
  const state={commits:0,rollbacks:0,queries:[]};
  const checkout={id:101,tenant_id:'1',sku:'STARTER',vendor_cost:80,margin_pct:marginPct,
    amount:100,contribution_margin:20,order_id:'sbc-order-1',customer_id:'customer-1',
    lead_id:null,currency:'USD',payload_json:'{}'};
  const connection={
    async beginTransaction(){},async commit(){state.commits++},async rollback(){state.rollbacks++},release(){},
    async query(sql,params=[]){
      state.queries.push({sql,params});
      if(sql.includes('FROM sbc_checkout_event_ledger'))return [[checkout]];
      if(sql.includes('FROM sbc_product_catalog'))return [[{
        sku:'STARTER',product_name:'SBC Starter',product_type:'service',
        vendor_cost:80,metadata:JSON.stringify({fulfillmentVendor:'internal'})
      }]];
      if(sql.includes('FROM sbc_fulfillment_tasks'))return [[]];
      if(sql.includes('FROM sbc_tenants'))return [[{id:1}]];
      if(sql.includes('INSERT INTO sbc_fulfillment_tasks'))return [{insertId:202}];
      if(sql.includes('INSERT INTO sbc_fulfillment_jobs'))return [{affectedRows:1}];
      if(sql.includes('UPDATE sbc_checkout_event_ledger'))return [{affectedRows:1}];
      throw Error('Unexpected fulfillment SQL: '+sql.slice(0,120));
    }
  };
  return {state,pool:{async getConnection(){return connection}}};
}
async function run(){
  assert.equal(MIN_MARGIN_PCT,0.20,'Owner policy must be 20%, not the former 30%');
  const oldEnv=process.env.SBC_MIN_MARGIN_PCT;
  process.env.SBC_MIN_MARGIN_PCT='0.30';
  try {
    // Even if GoDaddy still has a legacy 30% variable, the approved policy remains 20%.
    const actual=require('../enterprise/financial-governor-v56-25-3')
      .createFinancialGovernor({getPool:()=>({}),getAgentOS:()=>({})});
    assert.equal(actual.MIN_MARGIN_PCT,0.20);
  }finally{
    if(oldEnv===undefined)delete process.env.SBC_MIN_MARGIN_PCT;
    else process.env.SBC_MIN_MARGIN_PCT=oldEnv;
  }
  for(const [price,cost,accepted] of [[100,80,true],[100,80.01,false],[199,150,true]]){
    const fixture=checkoutFixture(cost);
    const handler=new Handler({pool:fixture.pool});
    assert.equal(handler.minimumMargin,MIN_MARGIN_PCT);
    const result=await handler.handle({
      tenant_id:'1',sku:'STARTER',amount:price,currency:'USD',provider:'square',
      provider_event_id:'test-only-event-'+price+'-'+cost,order_id:'test-order',customer_id:'customer-1'
    });
    assert.equal(result.accepted,accepted,'checkout threshold should match 20% (amount='+price+', cost='+cost+')');
    assert.equal(result.status,accepted?'QUEUED':'REJECTED_MARGIN');
    assert.equal(fixture.state.commits,accepted?1:0,'below-floor checkout must never commit a paid revenue event');
    assert.equal(fixture.state.rollbacks,accepted?0:1);
  }
  for(const [marginPct,expected] of [[0.20,'FULFILLMENT_QUEUED'],[0.1999,'FROZEN_ECONOMIC_GUARD']]){
    const fixture=fulfillmentFixture(marginPct);
    const worker=new Worker({pool:fixture.pool});
    const out=await worker.process({payload:{tenant_id:'1',checkout_ledger_id:101}});
    assert.equal(out.status,expected,'fulfillment policy must match checkout floor');
    assert.equal(fixture.state.commits,1);
    assert.equal(fixture.state.queries.some(x=>x.sql.includes('INSERT INTO sbc_fulfillment_jobs')),
      expected==='FULFILLMENT_QUEUED','below-floor worker may not create fulfillment jobs');
  }
  const check=checkoutFixture(150);
  const unsigned=new Handler({pool:check.pool,signatureVerifier:async()=>false});
  const rejected=await unsigned.handle({tenant_id:'1',sku:'STARTER',amount:199,provider_event_id:'test-signature'},{
    rawBody:'{}',signature:'invalid'
  });
  assert.equal(rejected.status,'REJECTED_SIGNATURE','20% policy may not bypass provider signature checks');
  assert.equal(check.state.queries.length,0);
  console.log('[SBC V6610 MARGIN POLICY] PASS: 20% floor across financial governor, storefront, worker; sub-20% blocked; signature enforced');
}
run().catch(error=>{console.error(error);process.exitCode=1});
