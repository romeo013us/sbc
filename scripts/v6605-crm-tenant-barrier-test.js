'use strict';
const assert=require('node:assert/strict');
const { runWithTenantContext }=require('../enterprise/tenant-context.cjs');
const register=require('../routes/crm');
const app={routes:[],get(p,...h){this.routes.push({p,h:h.at(-1)})},post(){}};
const res=()=>({code:200,status(n){this.code=n;return this},json(x){this.body=x;return this}});
const mixed={customers:[{id:'a',tenantId:1,businessName:'A'},{id:'b',tenantId:2,businessName:'B'},{id:'orphan',businessName:'Unknown'}],quotes:[{id:'q1',customerId:'a',tenantId:2},{id:'q2',customerId:'a',tenantId:1}],orders:[{id:'o1',customerId:'a',tenantId:2,price:1000,status:'Paid'},{id:'o2',customerId:'a',tenantId:1,price:10,status:'Paid'}]};
let seen=[];
const pool={query:async(sql,params)=>{seen.push({sql,params});if(/FROM sbc_customers/.test(sql))return [[{id:'a',tenant_id:1}],[]];return [[],[]]}};
register(app,{auth:()=>{},getContext:()=>({db:mixed,mysqlPool:pool})});
const get=(p)=>app.routes.find(x=>x.p===p).h;
async function test(){
 const basic=get('/api/v566/crm/customer-360/:id');
 const rel=get('/api/v566/crm/customer-360-relational/:id');
 let r=res();await basic({user:{tenantId:1},tenantId:1,params:{id:'a'}},r);
 assert.equal(r.code,403,'No ALS tenant must be rejected');
 await runWithTenantContext({tenantId:1,actorId:'owner'},async()=>{
  r=res();await basic({user:{tenantId:1},tenantId:1,params:{id:'a'}},r);
  assert.equal(r.code,200);assert.equal(r.body.data.customer.businessName,'A');
  assert.deepEqual(r.body.data.quotes.map(x=>x.id),['q2']);
  assert.equal(r.body.data.lifetimeValue,0,'status-only Paid must not count as captured revenue');
  assert.equal(r.body.data.contractedOrderValue,10,'non-Square order value is kept separately');
  r=res();await basic({user:{tenantId:1},tenantId:1,params:{id:'b'}},r);assert.equal(r.code,404);
  r=res();await basic({user:{tenantId:1},tenantId:1,params:{id:'orphan'}},r);assert.equal(r.code,404);
  r=res();await basic({user:{tenantId:2},tenantId:2,params:{id:'a'}},r);assert.equal(r.code,403);
  r=res();await rel({user:{tenantId:1},tenantId:1,params:{id:'a'}},r);assert.equal(r.code,200);
  assert.equal(seen.length,4);for(const item of seen){assert.ok(/tenant_id\s*=\s*\?/i.test(item.sql));assert.ok(item.params.includes(1));}
 });
 await runWithTenantContext({tenantId:1,actorId:'owner'},async()=>{
  const fallback={routes:[],get(p,...h){this.routes.push({p,h:h.at(-1)})},post(){}};
  register(fallback,{auth:()=>{},getContext:()=>({db:mixed,mysqlPool:null})});
  r=res();await fallback.routes.find(x=>x.p==='/api/v566/crm/customer-360-relational/:id').h({user:{tenantId:1},tenantId:1,params:{id:'b'}},r);
  assert.equal(r.body.data,null,'relational fallback must not expose other tenants');
 });
 console.log('PASS v6605 tenant barrier: missing context, tenant scope, orphan, mismatched identity, related data, SQL tenant parameters, fallback');
}
test().catch(e=>{console.error(e);process.exitCode=1});
