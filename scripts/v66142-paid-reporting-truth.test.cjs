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

test('shared revenue model quarantines duplicate payment identities and isolates tenant customers',()=>{
 const c=customer('same',1,'Direct'),foreign=customer('same',2,'Owner Launch QA');
 const good=paid('good','same',1,199.01),dup=paid('dup','same',1,499),conflict={...paid('conflict','same',1,799),squarePaymentId:dup.squarePaymentId};
 const rows=[good,dup,conflict,paid('other','same',2,999)];
 const result=TRUTH.paidSummary(rows,[c,foreign],{tenantId:1});
 assert.equal(result.orderCount,1);assert.equal(result.revenueCents,19901);assert.equal(result.revenue,199.01);
 assert.equal(result.reconciliation.ambiguousOrders,2);assert.equal(result.reconciliation.paymentIdentityConflicts,1);
 assert.deepEqual(result.orders.map(o=>o.id),['good']);
 assert.equal(TRUTH.paidSummary(rows,[c,foreign],{tenantId:2}).orderCount,0);
});
test('conflicting or refunded copies of a payment cannot be counted by capture date filtering',()=>{
 const c=customer('real'),a=paid('a','real'),b={...a,id:'b',paymentStatus:'Refunded',squarePaymentCompletedAt:'2020-01-01T12:00:00Z'};
 const r=TRUTH.paidSummary([a,b],[c],{tenantId:1,start:new Date(Date.now()-86400000),end:new Date(Date.now()+86400000)});
 assert.equal(r.orderCount,0);assert.equal(r.reconciliation.ambiguousOrders,2);
});
test('growth and control tower share tenant-scoped receipt reconciliation and safe source grouping',async()=>{
 const c=customer('real',1,'__proto__'),other=customer('other',2,'Direct');
 const good=paid('g','real',1,199.01),a=paid('a','real',1,499),b={...a,id:'b'};
 const db={customers:[c,other],orders:[good,a,b,paid('foreign','other',2,999)]};
 const growth=await GROWTH.live({db,pool:null,tenantId:1,days:30});
 AUTOPILOT.configure({db,mysqlPool:null,config:{autoDemo:false,autoOutbound:false}});
 const tower=await AUTOPILOT.controlTower();
 assert.equal(growth.revenue,199.01);assert.equal(growth.orders,1);
 assert.equal(growth.sourceBreakdown[0].source,'__proto__');
 assert.equal(growth.revenueReconciliation.ambiguousOrders,2);
 assert.equal(tower.funnel.paidRevenue,growth.revenue);assert.equal(tower.funnel.paidOrders,growth.orders);
 assert.equal(tower.funnel.leads,1);assert.equal(tower.funnel.revenueReconciliation.ambiguousOrders,2);
});
test('canonical read model is deterministic under input reordering and preserves exact cent totals',()=>{
 const c=customer('real');const rows=Array.from({length:10000},(_,i)=>paid('p'+i,'real',1,.01));
 const r=TRUTH.paidSummary(rows,[c],{tenantId:1});
 assert.equal(r.revenueCents,10000);assert.equal(r.revenue,100);
 assert.equal(TRUTH.paidSummary(rows.slice().reverse(),[c],{tenantId:1}).revenueCents,r.revenueCents);
 assert.throws(()=>TRUTH.paidSummary(rows,[c],{tenantId:0}),/TENANT_CONTEXT_REQUIRED/);
});

test('reconciled revenue trends compare equal completed UTC windows and separate current partial day',()=>{
 const captured=(id,price,time,extra={})=>({...paid(id,'real',1,price),squarePaymentCompletedAt:time,...extra});
 const asOf=Date.parse('2026-11-28T14:00:00Z');
 const orders=[captured('today',199,'2026-11-28T12:00:00Z'),captured('current',299,'2026-11-25T12:00:00Z'),captured('current2',100,'2026-11-21T00:00:00Z'),captured('prior',499,'2026-11-20T23:59:59Z'),captured('old',200,'2026-10-31T12:00:00Z'),captured('previousmonth',400,'2026-10-10T12:00:00Z'),captured('future',999,'2026-11-28T16:00:00Z'),captured('dup',500,'2026-11-22T12:00:00Z'),captured('dup_copy',500,'2026-09-01T12:00:00Z',{squarePaymentId:'spayment-dup'}),captured('foreign',999,'2026-11-25T12:00:00Z',{tenantId:2})];
 const summary=TRUTH.paidSummary(orders,[customer('real')],{tenantId:1});
 const trend=TRUTH.revenueWindows(summary,asOf);
 assert.equal(trend.status,'available');assert.equal(trend.timezone,'UTC');assert.equal(trend.today.capturedCents,19900);assert.equal(trend.today.orders,1);
 assert.equal(trend.windows[0].days,7);assert.equal(trend.windows[0].current.capturedCents,39900);assert.equal(trend.windows[0].previous.capturedCents,49900);assert.equal(trend.windows[0].changeCents,-10000);
 assert.equal(trend.windows[1].days,30);assert.equal(trend.windows[1].current.capturedCents,109800);assert.equal(trend.windows[1].previous.capturedCents,40000);
 assert.equal(trend.futureDatedCaptures,1);assert.equal(trend.profit.status,'unavailable');assert.equal(trend.profit.netProfitCents,null);assert.equal(trend.executionAllowed,false);
 assert.equal(TRUTH.revenueWindows(null,asOf).status,'unavailable');
 const empty=TRUTH.revenueWindows(TRUTH.paidSummary([],[],{tenantId:1}),asOf);
 assert.equal(empty.windows[0].current.capturedCents,0);assert.equal(empty.windows[0].changePct,null);
 assert.equal(TRUTH.revenueWindows({...summary,revenueCents:1},asOf).status,'unavailable');
});
