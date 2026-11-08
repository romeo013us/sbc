'use strict';
// Full customer journey order-guard contract using synthetic in-memory records.
// Never contacts Square, GoDaddy, real MySQL, customers or live application.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {patchServer,MARK}=require('./v6630-customer-journey-hardening.cjs');
const src=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const patched=patchServer(src).source;
assert.ok(patched.includes(MARK));
assert.equal(patchServer(patched).source,patched);
function fixture(){
 const handlers={},db={customers:[{id:'c1',tenantId:1},{id:'c2',tenantId:2}],orders:[
  {id:'o2',tenantId:2,customerId:'c2',customerName:'Other',product:'Hosting',status:'New',price:199,notes:''},
  {id:'o1',tenantId:1,customerId:'c1',customerName:'Test',product:'Cards',status:'New',price:40,notes:''},
  {id:'qa1',tenantId:1,customerId:'c1',customerName:'Test',product:'SBC Launch QA - $1 Test Service',status:'Paid',
   price:1,notes:JSON.stringify({sbcLaunchQa:{kind:'OWNER_ONLY_ONE_DOLLAR_CHECKOUT'},squarePaymentId:'abc'}),fulfillmentStatus:'QA VERIFIED - NO FULFILLMENT'},
 ],quotes:[]},events=[];
 const app={post:(path,auth,owner,handler)=>{assert.equal(auth,'AUTH');assert.equal(owner,'OWNER');handlers['POST '+path]=handler;},
  put:(path,auth,owner,handler)=>{handlers['PUT '+path]=handler;},
  delete:(path,auth,owner,handler)=>{handlers['DELETE '+path]=handler;}};
 const ctx={app,auth:'AUTH',ownerOnly:'OWNER',db,Number,String,Object,Array,JSON,Set,
  SBC_V66120_OB_COMMERCE:require('../enterprise/v66120-officebox-commerce-boundary.cjs'),
  sbcV6606QuoteWriterReady:()=>true,requireRequestTenant:req=>req.tenantId,
  orderParsed:o=>{try{return JSON.parse(o.notes||'{}')}catch{return {}}},
  addActivity:()=>{},now:()=>new Date().toISOString(),id:()=> 'synthetic_new_order',saveData:async()=>{events.push('save')}};
 const start=patched.indexOf('/* '+MARK),end=patched.indexOf("\napp.post('/api/renewals'",start);
 assert.ok(start>=0&&end>start,'compiled master order routes must be found');
 vm.runInNewContext(patched.slice(start,end),ctx,{timeout:3000});
 const invoke=async(method,path,tenantId,body={},id=null)=>{
  const res={code:200,payload:null,status(n){this.code=n;return this},json(x){this.payload=x;return this}};
  const handler=handlers[method+' '+path];assert.ok(handler,'handler exists '+method+' '+path);
  await handler({tenantId,body,params:{id}},res);
  return res;
 };
 return{db,events,handlers,ctx,invoke};
}
(async()=>{
 const x=fixture();
 assert.equal((await x.invoke('POST','/api/orders',1,{customerName:'A',product:'Cards',status:'Paid'})).code,409);
 assert.equal((await x.invoke('POST','/api/orders',1,{customerName:'A',product:'Cards',customerId:'c2'})).code,404);
 assert.equal((await x.invoke('POST','/api/orders',1,{customerName:'A',product:'Cards',notes:JSON.stringify({squarePaymentStatus:'PAID'})})).code,409);
 assert.equal((await x.invoke('POST','/api/orders',1,{customerName:'A',product:'Cards',notes:JSON.stringify({officeBoxSku:'OFFICE_BOX_BUSINESS'})})).code,409);
 assert.equal((await x.invoke('POST','/api/orders',1,{customerName:'A',product:'Cards',notes:JSON.stringify({items:[{id:'office_box_team',name:'Office Box Team'}]})})).code,409);
 assert.equal((await x.invoke('POST','/api/orders',1,{customerName:'A',product:'Cards',price:12,customerId:'c1'})).code,201);
 assert.equal((await x.invoke('PUT','/api/orders/:id',1,{product:'Intercepted'},'o2')).code,404);
 assert.equal(x.db.orders.find(o=>o.id==='o2').product,'Hosting');
 assert.equal((await x.invoke('PUT','/api/orders/:id',1,{paymentStatus:'PAID'},'o1')).code,422);
 assert.equal((await x.invoke('PUT','/api/orders/:id',1,{tenantId:2},'o1')).code,422);
 assert.equal((await x.invoke('PUT','/api/orders/:id',1,{status:'Paid'},'o1')).code,409);
 assert.equal((await x.invoke('PUT','/api/orders/:id',1,{notes:'{"squarePaymentId":"forged"}'},'o1')).code,409);
 assert.equal((await x.invoke('PUT','/api/orders/:id',1,{price:999},'qa1')).code,409);
 assert.equal((await x.invoke('DELETE','/api/orders/:id',1,{},'o2')).code,404);
 assert.equal((await x.invoke('DELETE','/api/orders/:id',1,{},'qa1')).code,409);
 assert.equal((await x.invoke('PUT','/api/orders/:id',1,{product:'Cards 100'},'o1')).code,200);
 assert.equal(x.db.orders.find(o=>o.id==='o1').product,'Cards 100');
 x.db.orders.find(o=>o.id==='o1').notes=JSON.stringify({squareOrderId:'sq1'});
 assert.equal((await x.invoke('PUT','/api/orders/:id',1,{price:10},'o1')).code,409);
 assert.equal((await x.invoke('DELETE','/api/orders/:id',1,{},'o1')).code,409);
 // Confirm quote identity and delete guards against a customer in a different tenant.
 const start=patched.indexOf("app.post('/api/quotes',auth,ownerOnly,"),end=patched.indexOf("// V25 Sales Order Builder",start);
 assert.ok(start>0&&end>start);
 const qRoutes=patched.slice(start,end);
 assert.match(qRoutes,/CUSTOMER_NOT_FOUND_IN_TENANT/);
 assert.match(qRoutes,/c\.tenantId\)===requireRequestTenant\(req\)/);
 assert.match(qRoutes,/SETTLED_OR_LINKED_QUOTE_IMMUTABLE/);
 assert.match(qRoutes,/db\.quotes\.findIndex\(x=>x.id===req.params.id&&Number\(x.tenantId\)===tenantId\)/);
 assert.ok(x.events.length>=2,'authorized owner edits still persist changes');
 console.log('[SBC V6630 CUSTOMER JOURNEY] PASS: tenant-bound orders/quotes, payment evidence immutable, QA preserved, no false Paid, safe owner edits');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});