'use strict';
/* V66.142: provider-backed, QA-free growth reporting is a read-only operation. */
const assert=require('node:assert/strict');
const {test}=require('node:test');
const TRUTH=require('../enterprise/sbc-revenue-reporting-truth-v66142.cjs');
const GROWTH=require('../enterprise/v56140-growth-ops.js');
const AUTOPILOT=require('../enterprise/v56150-revenue-autopilot.js');

const now=new Date().toISOString();
const customer=(id,tenant=1,source='Lead Research')=>({
 id,tenantId:tenant,source,businessName:'Real Neighborhood Shop',
 createdAt:now,status:'Customer',leadTemperature:'Warm'
});
const paid=(id,customerId,tenant=1,price=299)=>({
 id,customerId,tenantId:tenant,customerName:'Real Neighborhood Shop',
 price,status:'New',paymentStatus:'Paid',createdAt:now,
 squareOrderId:'sorder-'+id,squarePaymentId:'spayment-'+id,
 squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:now
});
test('recognizes only captured Square payment metadata, never a fulfillment label or status-only claim',()=>{
 const real=paid('real','real');
 assert.equal(TRUTH.providerPaid(real,customer('real')),true);
 assert.equal(TRUTH.providerPaid({...real,squarePaymentId:''},customer('real')),false);
 assert.equal(TRUTH.providerPaid({...real,paymentStatus:'Refunded'},customer('real')),false);
 assert.equal(TRUTH.providerPaid({id:'status',paymentStatus:'Paid',price:900},null),false);
 assert.equal(TRUTH.providerPaid({id:'shipping',status:'Delivered',price:900},null),false);
});
test('filters $0 owner checkout, $1 signed launch QA and historical synthetic account even if provider captured',()=>{
 const zero={...paid('qaorder_123','real'),notes:JSON.stringify({ownerCheckoutLab:{kind:'SBC_OWNER_ZERO_DOLLAR_CHECKOUT_QA_V1'}})};
 const one={...paid('one','real',1,1),notes:JSON.stringify({sbcLaunchQa:{kind:'OWNER_ONLY_ONE_DOLLAR_CHECKOUT'}})};
 const synthetic=customer('synthetic',1,'SBC V47 Full-Cycle Test');
 assert.equal(TRUTH.providerPaid(zero,customer('real')),false);
 assert.equal(TRUTH.providerPaid(one,customer('real')),false);
 assert.equal(TRUTH.providerPaid(paid('sim','synthetic',1,2),synthetic),false);
 assert.equal(TRUTH.providerPaid(paid('legit','real'),customer('real')),true);
});
test('growth dashboard keeps QA and other tenants out of conversions, capture revenue and source attribution',async()=>{
 const c1=customer('real'),c2=customer('synthetic',1,'SBC V47 Full-Cycle Test'),c3=customer('elsewhere',9);
 const db={customers:[c1,c2,c3],orders:[
  paid('realpay','real',1,299),
  {...paid('status','real',1,700),squarePaymentId:''},
  {...paid('qaorder_abc','real',1,0),notes:JSON.stringify({ownerCheckoutLab:{kind:'SBC_OWNER_ZERO_DOLLAR_CHECKOUT_QA_V1'}})},
  {...paid('one','real',1,1),notes:JSON.stringify({sbcLaunchQa:{kind:'OWNER_ONLY_ONE_DOLLAR_CHECKOUT'}})},
  paid('sim','synthetic',1,2),paid('foreign','elsewhere',9,888),
  {id:'ship',tenantId:1,customerId:'real',status:'FULFILLED',price:400,createdAt:now}
 ]};
 const result=await GROWTH.live({db,pool:null,tenantId:1,days:30});
 assert.equal(result.leads,1);
 assert.equal(result.qualified,1);
 assert.equal(result.customers,1);
 assert.equal(result.orders,1);
 assert.equal(result.revenue,299);
 assert.equal(result.sourceBreakdown.length,1);
 assert.equal(result.sourceBreakdown[0].revenue,299);
 assert.equal(result.sourceBreakdown[0].customers,1);
 assert.match(result.revenuePolicy,/Square/);
 const snapshot=await GROWTH.buildSnapshot({db,pool:null,tenantId:1,date:new Date()});
 assert.equal(snapshot.metrics.orders,1);
 assert.equal(snapshot.metrics.revenue,299);
});
test('control tower paid counter matches canonical Square proof and ignores protected QA',async()=>{
 const customers=[customer('real'),customer('synthetic',1,'Owner Launch QA')];
 const orders=[
  paid('realpay','real',1,299),
  paid('syntheticpay','synthetic',1,1),
  {...paid('status','real',1,1200),squarePaymentId:''},
  {...paid('ownerlab','real',1,0),notes:JSON.stringify({ownerCheckoutLab:{kind:'SBC_OWNER_ZERO_DOLLAR_CHECKOUT_QA_V1'}})},
  paid('foreign','real',8,999)
 ];
 AUTOPILOT.configure({db:{customers,orders},mysqlPool:null,config:{autoDemo:false,autoOutbound:false}});
 const tower=await AUTOPILOT.controlTower();
 assert.equal(tower.funnel.paidOrders,1);
 assert.equal(tower.funnel.paidRevenue,299);
 assert.equal(tower.funnel.qualifiedEstimateOnly,true);
});
