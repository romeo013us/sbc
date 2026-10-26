'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(path.join(path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime'),'server.js'),'utf8');
const start=s.indexOf('// SBC_V6662_GODKIM_TENANT_ORDER_GATE');
const end=s.indexOf("\napp.post('/api/kim/voice/session'",start);
assert.ok(start>=0&&end>start,'GodKim source-matched endpoint present');
const captures={},metrics={orchestrations:0,notifications:0,fulfillment:0};
const db={
 orders:[{id:'scoped-1',tenantId:1,customerId:'cust-1'},{id:'scoped-2',tenantId:2,customerId:'cust-2'}],
 customers:[{id:'cust-1',tenantId:1,email:'one@example.test'},{id:'cust-2',tenantId:2,email:'two@example.test'}]
};
const ctx={
 app:{post:(route,auth,handler)=>captures[route]=handler},auth:()=>{},db,
 GOD_KIM:{orchestrate:async params=>{metrics.orchestrations++;if(params.sendCustomerStatus)await params.sendCustomerStatus(params.order,{subject:'test',body:'synthetic'});return {ok:true,orderId:params.order.id}}},
 requireRequestTenant:req=>{if(!Number.isInteger(req.tenantId)||req.tenantId<=0)throw Error('TENANT_CONTEXT_REQUIRED');return req.tenantId},
 createFulfillmentJobsForOrder:()=>{metrics.fulfillment++},processReadyFulfillmentJobs:()=>{},vendorCapabilities:()=>({}),
 addActivity:()=>{},audit:()=>{},saveData:async()=>{},CATALOG:{},
 sendEmail:async()=>{metrics.notifications++;return {sent:true}},
 String,Number,Object
};
vm.runInNewContext(s.slice(start,end),ctx,{timeout:2500});
const handler=captures['/api/kim/god/orchestrate/:orderId'];assert.equal(typeof handler,'function');
const response=()=>({code:200,status(n){this.code=n;return this},json(value){this.body=value;return this}});
async function hit(user,tenantId,orderId){
 const r=response();await handler({user:{role:user,id:'mock-owner'},tenantId,params:{orderId},body:{}},r);return r;
}
(async()=>{
 let r=await hit('caller',1,'scoped-1');assert.equal(r.code,403);
 r=await hit('owner',null,'scoped-1');assert.equal(r.code,403);assert.equal(r.body.code,'TENANT_CONTEXT_REQUIRED');
 r=await hit('owner',1,'scoped-2');assert.equal(r.code,404);
 assert.equal(metrics.orchestrations,0,'foreign tenant ID never reaches GodKim');
 assert.equal(metrics.notifications,0,'foreign tenant customer receives no email');
 r=await hit('owner',1,'scoped-1');assert.equal(r.code,200);assert.equal(r.body.orderId,'scoped-1');
 assert.equal(metrics.orchestrations,1);assert.equal(metrics.notifications,1);
 assert.equal(metrics.fulfillment,0,'test harness does not initiate vendor fulfillment');
 console.log('[SBC V6662 GODKIM] PASS '+String(process.env.SBC_AUDIT_PASS||'1')+': owner privilege, selected-tenant order and recipient isolation, no foreign provider calls');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
