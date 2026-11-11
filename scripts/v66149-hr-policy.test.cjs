'use strict';
const assert=require('node:assert/strict');
const p=require('../enterprise/v66149-hr-workstation-policy.cjs');
const users=[
 {id:'lorna',name:'Lorna',role:'lead_researcher',tenantId:1,active:true,email:'private@example.invalid',passwordHash:'NEVER_EXPOSE'},
 {id:'caller',name:'Sales Caller',role:'caller',tenantId:1,active:true},
 {id:'hr',name:'HR Manager',role:'hr_manager',tenantId:1,active:true},
 {id:'other',name:'Other Tenant Staff',role:'caller',tenantId:2,active:true}
];
const v9={
 onboarding:{lorna:{status:'Submitted',country:'Philippines',paymentAccountLast4:'1234',legalName:'CONFIDENTIAL'}},
 compensation:{lorna:{payRate:4,currency:'USD',payPeriod:'Monthly'}},
 timeEntries:[{id:'t1',userId:'lorna',clockIn:'2026-11-10T10:00:00Z',
  clockOut:'2026-11-10T16:00:00Z',breaks:[{start:'2026-11-10T12:00:00Z',end:'2026-11-10T12:30:00Z'}]},
 {id:'t2',userId:'lorna',clockIn:'2026-11-10T18:00:00Z',clockOut:null}],
 hrOps:{drafts:[{id:'owner-review',tenantId:1,status:'Pending Owner Review'},
  {id:'other-review',tenantId:2,status:'Pending Owner Review'}],
  preferences:{lorna:{provider:'Remitly Business',status:'Awaiting Owner Review'}}}
};
const owner={id:'own',tenantId:1,role:'owner',name:'SBC Owner'},
 hr={id:'hr',tenantId:1,role:'hr_manager',name:'HR Manager'};
const m=p.overview({tenantId:1,users,v9,actor:hr});
assert.equal(m.workspace,'SBC HR Department');assert.equal(m.people.length,3);
assert.equal(m.counts.pendingDrafts,1);
assert.equal(m.people.find(x=>x.id==='lorna').completedTimeHours,5.5);
assert.equal(m.people.find(x=>x.id==='lorna').openShifts,1);
assert.equal(m.people.find(x=>x.id==='lorna').country,'Philippines');
assert.equal(m.people.find(x=>x.id==='lorna').classification,'NOT_VERIFIED');
assert(!JSON.stringify(m).includes('CONFIDENTIAL'));
assert(!JSON.stringify(m).includes('1234'),'no payment account identifiers');
assert(!JSON.stringify(m).includes('private@example.invalid'),'no staff email');
assert(!JSON.stringify(m).includes('NEVER_EXPOSE'),'no password hashes');
assert(!JSON.stringify(m).includes('Other Tenant Staff'));
assert.equal(p.allowed('GET','/api/hr/overview'),true);
assert.equal(p.allowed('POST','/api/hr/drafts'),true);
for(const [method,url] of [
 ['GET','/api/users'],['POST','/api/users'],['GET','/api/bootstrap'],
 ['GET','/api/owner/crm/reconcile-ids'],['POST','/api/v9/payroll/run'],
 ['POST','/api/v9/payroll/run/test/status'],['POST','/api/hr/drafts/any/decision'],
 ['POST','/api/hr/payout-preferences/lorna/decision'],['GET','/api/crm/customers'],
 ['POST','/api/payments/square/refund'],['POST','/api/hr/drafts/lorna/decision']
])assert.equal(p.allowed(method,url),false,'hr denied '+method+' '+url);
assert.equal(p.method('Wise'),null,'unsupported Wise must not be in payroll options');
assert.equal(p.method('Remitly Business'),'Remitly Business');
assert.equal(p.method('Payoneer'),'Payoneer');
const input={workerId:'lorna',periodStart:'2026-11-01',periodEnd:'2026-11-10',
 hours:20,proposedUsd:80,provider:'Remitly Business',note:'Invoice checked'};
const draft=p.makeDraft({input,worker:users[0],actor:hr,tenantId:1});
assert.equal(draft.status,'Pending Owner Review');assert.equal(draft.externalPaymentInitiated,false);
assert.equal(draft.paymentVerified,false);assert.equal(draft.proposedUsd,80);
assert(!JSON.stringify(draft).includes('1234'));
assert.throws(()=>p.makeDraft({input,worker:users[3],actor:hr,tenantId:1}),/HR_WORKER_NOT_FOUND/);
assert.throws(()=>p.makeDraft({input:{...input,provider:'Wise'},worker:users[0],actor:hr,tenantId:1}),/HR_INVALID_PAYOUT_PROVIDER/);
assert.throws(()=>p.makeDraft({input:{...input,proposedUsd:20000},worker:users[0],actor:hr,tenantId:1}),/HR_INVALID_DRAFT_AMOUNT/);
assert.throws(()=>p.makeDraft({input:{...input,periodEnd:'2026-04-01'},worker:users[0],actor:hr,tenantId:1}),/HR_INVALID_PAY_PERIOD/);
assert.throws(()=>p.makeDraft({input,worker:users[0],actor:{...hr,tenantId:2},tenantId:1}),/HR_ACCESS_DENIED/);
assert.throws(()=>p.overview({tenantId:0,users,v9,actor:owner}),/HR_TENANT_REQUIRED/);
console.log('PASS V66.149: HR tenant isolation, contractor payroll drafts, owner-only actions denied, no Wise/bank data, no money transfer');
