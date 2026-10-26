'use strict';
// V66.52 executable compiled release proof. Uses only synthetic tenants and payments.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const E=require(path.join(root,'enterprise/v6640-payment-evidence.cjs'));
assert.match(server,/SBC_V6652_MANUAL_PAYMENT_PROOF/);
const manual={status:'Paid',paymentStatus:'Paid',price:349,notes:'{"manualPaymentEvidence":true}'};
assert.equal(E.confirmedPaid(manual),false);
assert.equal(E.unverifiedFulfillment(manual),true);
assert.equal(E.confirmedPaid({status:'Paid',paymentStatus:'Paid',notes:'{"manualPaymentConfirmation":true}'}),false);
assert.equal(E.confirmedPaid({...manual,notes:'{"manualPaymentEvidence":true,"squarePaymentStatus":"PAID","squarePaymentId":"captured-123"}'}),true);
assert.equal(E.confirmedPaid({paymentStatus:'Refunded'}),false);
assert.equal(E.confirmedPaid({paymentStatus:'Paid'}),true);
function between(a,b){const start=server.indexOf(a),end=server.indexOf(b,start+a.length);assert.ok(start>=0&&end>start,a);return server.slice(start,end)}
const routes=new Map(),state={customers:[{id:'c7',tenantId:7,status:'Lead'},{id:'c8',tenantId:8,status:'Lead'}],
 orders:[{...manual,id:'o7',tenantId:7,customerId:'c7'},{id:'o8',tenantId:8,customerId:'c8',paymentStatus:'Paid',price:199}],
 squarePayments:[{sbcOrderId:'o7',customerId:'c7',manualEvidence:true,status:'MANUALLY_RECONCILED'}]};
let mutations=0;
const ctx={app:{get:(k,...h)=>routes.set('GET '+k,h.at(-1)),post:(k,...h)=>routes.set('POST '+k,h.at(-1))},
 auth(){},ownerOnly(){},db:state,BUILD_VERSION:'66.0.0',Date,Number,String,Set,require:()=>E,
 requireRequestTenant:req=>{if(!req.tenantId)throw Error('TENANT_CONTEXT_REQUIRED');return req.tenantId;},
 saveData(){mutations++},addActivity(){mutations++},updateOrderParsed(){mutations++},sendBig3OfficeBoxHandoff(){mutations++},createFulfillmentJobsForOrder(){mutations++}};
const routeCode=between("app.get('/api/owner/revenue-integrity'","app.post('/api/payments/square/create-link/")+
between("app.post('/api/payments/square/owner-mark-paid/","function safeTimingEqualHex(");
vm.runInNewContext(routeCode,ctx,{timeout:2500});
function res(){return {statusCode:200,status(v){this.statusCode=v;return this},setHeader(){},json(v){this.data=v;return this}}}
(async()=>{
 const baseline=JSON.stringify(state);
 const cases=[
 ['POST /api/v32-2/payment-reconciliation',{tenantId:7,body:{amount:349,reference:'made-up'}},409],
 ['POST /api/payments/square/owner-mark-paid/:orderId',{tenantId:7,params:{orderId:'o7'}},409],
 ['POST /api/payments/square/owner-mark-paid/:orderId',{tenantId:7,params:{orderId:'o8'}},404],
 ['POST /api/payments/square/owner-mark-paid/:orderId',{params:{orderId:'o7'}},403]
 ];
 for(const [route,req,status] of cases){const r=res();await routes.get(route)(req,r);assert.equal(r.statusCode,status,route);assert.equal(r.data.ok,false)}
 const owner=res();await routes.get('GET /api/owner/revenue-integrity')({tenantId:7},owner);
 assert.equal(owner.statusCode,200);assert.equal(owner.data.counts.activeLeads,1);
 assert.equal(owner.data.counts.orders,1);assert.equal(owner.data.counts.markedPaid,1);
 assert.equal(owner.data.counts.evidenceClassifiedPaid,0);assert.equal(owner.data.counts.legacyManualUnverified,1);
 assert.ok(owner.data.exceptionOrderIds.includes('o7'));
 assert.ok(!JSON.stringify(owner.data).includes('o8'),'no cross tenant order leak');
 assert.equal(JSON.stringify(state),baseline);assert.equal(mutations,0);
 const ui=fs.readFileSync(path.join(root,'public/v32-2-upgrade.js'),'utf8'),
 mirror=fs.readFileSync(path.join(root,'browser_public/v32-2-upgrade.js'),'utf8');
 assert.equal(ui,mirror);assert.match(ui,/Check Square Settlement/);
 assert.doesNotMatch(ui,/Reconcile & Create\/Link Order/);
 const ma=ui.indexOf('  function metrics(){'),mb=ui.indexOf('  function exceptions(){',ma);
 const mock={customers:[],quotes:[{status:'Won',total:999}],orders:[manual,{status:'Fulfilled',paymentStatus:'Pending',price:100},{paymentStatus:'Paid',price:199}],tasks:[],renewals:[]};
 const metricsCtx={D:()=>mock,today2:()=>'2026-10-26',Date,Number,String};
 vm.runInNewContext(ui.slice(ma,mb)+'\nthis.compute=metrics;',metricsCtx);
 assert.equal(metricsCtx.compute().paidOrders,1);assert.equal(metricsCtx.compute().revenue,199);
 console.log('[SBC V6652] PASS no manual phantom paid, tenant-scoped diagnosis, no data writes, UI revenue excludes quotes and paid-only fulfillment');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});