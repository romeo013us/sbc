'use strict';
const assert=require('node:assert/strict');
const {sbcAdvisoryScreen}=require('../hotfix-assets/apply-v6624-existing-schema-tenant-operations.js');
const customers=[
  {tenantId:1,id:1,verified:true,recent:false},
  {tenantId:1,id:2,verified:true,recent:true},
  {tenantId:1,id:3,verified:false,recent:false},
  {tenantId:2,id:4,verified:true,recent:false}
];
customers.forEach(Object.freeze); Object.freeze(customers);
const db=Object.freeze({customers});
let eligibleCalls=0;
const eligible=c=>{eligibleCalls++; return c.verified===true};
const recent=c=>c.recent===true;
const before=JSON.stringify(db);
const r=sbcAdvisoryScreen(db,1,20,eligible,recent);
assert.equal(r.ok,true);
assert.equal(r.advisoryOnly,true);
assert.equal(r.tenantCustomers,3);
assert.equal(r.qualifiedWarmHot,2);
assert.equal(r.notQualified,1);
assert.equal(r.prospects,1);
assert.equal(r.missions,0);
assert.equal(r.writeAttempts,0);
assert.equal(r.externalActions,0);
assert.equal(JSON.stringify(db),before);
assert.equal(eligibleCalls,3);
assert.equal(sbcAdvisoryScreen(db,2,20,eligible,recent).tenantCustomers,1);
assert.throws(()=>sbcAdvisoryScreen(db,null,20,eligible,recent),/TENANT_CONTEXT_REQUIRED/);
assert.throws(()=>sbcAdvisoryScreen(db,0,20,eligible,recent),/TENANT_CONTEXT_REQUIRED/);
console.log('V6624 pure Kim advisory: tenant isolation and no mutations PASS');
