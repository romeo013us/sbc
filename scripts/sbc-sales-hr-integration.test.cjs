'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const OWNER=require('../enterprise/v66149-hr-owner-workstation.cjs');
const POLICY=require('../enterprise/v66149-hr-workstation-policy.cjs');
test('Philippine account-manager contractor is included in owner HR roster, tenant-scoped',()=>{
 const users=[
  {id:'m1',name:'Manager One',role:'account_manager',tenantId:1,active:true},
  {id:'foreign',name:'Foreign Tenant',role:'account_manager',tenantId:2,active:true}
 ];
 const v9={compensation:{m1:{payRate:5,currency:'USD'}},
    onboarding:{m1:{country:'Philippines',contractorAgreementAccepted:true}}};
 const summary=OWNER.visible({tenantId:1,users,v9});
 assert.equal(summary.totalPeople,1);
 assert.equal(summary.people[0].id,'m1');
 assert.equal(summary.people[0].rate,5);
 assert.equal(summary.people[0].classification,'NOT_DETERMINED_BY_THIS_SYSTEM');
 assert.equal(POLICY.staff(users,1).length,1);
 assert(POLICY.STAFF_ROLES.has('account_manager'));
 assert(!JSON.stringify(summary).includes('Foreign Tenant'));
});
test('HR cannot classify contractor or automatically initiate pay',()=>{
 const d=POLICY.overview({tenantId:1,
  users:[{id:'m',name:'Sales Contractor',tenantId:1,role:'account_manager',active:true}],
  v9:{},actor:{role:'owner',id:'owner'}});
 assert.equal(d.people.length,1);
 assert.equal(d.people[0].classification,'NOT_VERIFIED');
 assert(d.restrictions.neverAutomated.includes('External transfers'));
 assert(d.restrictions.ownerOnly.includes('Initiate external payment'));
});
