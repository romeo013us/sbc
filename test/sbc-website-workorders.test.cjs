'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const POLICY=require('../enterprise/sbc-website-workorders.cjs');
const owner={id:'u-owner',role:'owner',tenantId:1};
const designer={id:'u-design',role:'fulfillment',tenantId:1,active:true};
const other={...designer,tenantId:2};
const order={id:'paid-1',customerId:'c1',tenantId:1,product:'Business Basic',price:349};
const site={id:'site-1',customerId:'c1',tenantId:1,status:'Approved',offerTier:'essentials'};
function fresh(){return POLICY.start({order,site,actor:owner,clock:'2026-11-12T19:00:00.000Z'});}
test('paid project must match same tenant, linked buyer, approved website and owner',()=>{
 assert.throws(()=>POLICY.start({order:{...order,tenantId:2},site,actor:owner}),/TENANT_CONTEXT/);
 assert.throws(()=>POLICY.start({order,site:{...site,customerId:'c2'},actor:owner}),/CUSTOMER_MISMATCH/);
 assert.throws(()=>POLICY.start({order,site:{...site,status:'Draft'},actor:owner}),/WEBSITE_NOT_APPROVED/);
 assert.throws(()=>POLICY.start({order,site,actor:designer}),/OWNER_REQUIRED/);
 const x=fresh();assert.equal(x.orderId,'paid-1');assert.equal(x.status,'IN_PRODUCTION');
 assert.deepEqual(x.tasks.map(s=>s.key),['intake','content','build','qa','publish']);
 assert.deepEqual(x.tasks.map(s=>s.status),['READY','BLOCKED','BLOCKED','BLOCKED','BLOCKED']);
});
test('owner can assign active same-tenant fulfillment users but not arbitrary users',()=>{
 const x=fresh();
 assert.throws(()=>POLICY.assign(x,'content',other,owner),/ASSIGNEE_INVALID/);
 assert.throws(()=>POLICY.assign(x,'content',{...designer,role:'caller'},owner),/ASSIGNEE_INVALID/);
 assert.throws(()=>POLICY.assign(x,'content',designer,designer),/OWNER_REQUIRED/);
 const changed=POLICY.assign(x,'content',designer,owner);assert.equal(changed.tasks[1].assignedTo,'u-design');
 assert.equal(x.tasks[1].assignedTo,'');
});
test('sequential completion, assigned worker permissions and owner-only launch',()=>{
 let x=fresh();
 assert.throws(()=>POLICY.complete(x,'content',owner),/PREREQUISITES/);
 assert.throws(()=>POLICY.complete(x,'intake',designer),/NOT_ASSIGNED/);
 x=POLICY.complete(x,'intake',owner);
 assert.equal(x.tasks[1].status,'READY');
 x=POLICY.assign(x,'content',designer,owner);
 x=POLICY.complete(x,'content',designer);
 assert.equal(x.tasks[2].status,'READY');
 x=POLICY.complete(x,'build',owner);
 x=POLICY.complete(x,'qa',owner);
 assert.equal(x.status,'READY_FOR_OWNER_LAUNCH');
 assert.throws(()=>POLICY.complete(x,'publish',designer,{url:'https://example.com'}),/OWNER_REQUIRED/);
 assert.throws(()=>POLICY.complete(x,'publish',owner,{}),/PUBLISHED_URL_REQUIRED/);
 x=POLICY.complete(x,'publish',owner,{url:'https://example.com'});
 assert.equal(x.status,'PUBLISHED');
 assert.equal(x.publicUrl,'https://example.com/');
});
test('Contra contractor reference is a budget request, never an automatic hire or transfer',()=>{
 const x=fresh();
 assert.throws(()=>POLICY.proposeContractor(x,{source:'contra',profileUrl:'http://contra.com/p/bad',estimatedCents:2000},owner),/CONTRACTOR_URL_INVALID/);
 assert.throws(()=>POLICY.proposeContractor(x,{source:'contra',profileUrl:'https://evil.example',estimatedCents:2000},owner),/CONTRACTOR_URL_INVALID/);
 assert.throws(()=>POLICY.proposeContractor(x,{source:'contra',profileUrl:'https://contra.com/x',estimatedCents:2000},designer),/OWNER_REQUIRED/);
 const y=POLICY.proposeContractor(x,{source:'contra',profileUrl:'https://contra.com/some-pro',estimatedCents:4500,task:'build'},owner);
 assert.equal(y.contractorRequests[0].status,'OWNER_REVIEW_REQUIRED');
 assert.equal(y.contractorRequests[0].estimatedCents,4500);
 assert.equal(y.contractorRequests[0].paid,false);
});
