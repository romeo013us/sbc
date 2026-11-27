'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const POLICY=require('../enterprise/sbc-sales-compensation-v1.cjs');
const paid=(orderId,managerId='mgr1',grossCents=40000,costCents=16000,capturedAt='2026-11-13T15:00:00Z')=>({
 tenantId:1,orderId,managerId,grossCents,directCostCents:costCents,capturedAt,
 proofVerified:true,ownerAttested:true,source:'NEW_CUSTOMER'
});
test('standard quota gates commission on the entire eligible monthly profit',()=>{
 const below=POLICY.statement({tenantId:1,managerId:'mgr1',month:'2026-11',tier:'standard',credits:[...Array.from({length:6},(_,i)=>paid('ord'+i))]});
 assert.equal(below.revenueCents,240000);
 assert.equal(below.commissionCents,0);
 assert.equal(below.quotaCents,260000);
 const hit=POLICY.statement({tenantId:1,managerId:'mgr1',month:'2026-11',tier:'standard',credits:[...Array.from({length:7},(_,i)=>paid('ord'+i))]});
 assert.equal(hit.revenueCents,280000);
 assert.equal(hit.profitCents,168000);
 assert.equal(hit.commissionCents,16800);
 assert.equal(hit.eligible,true);
});
test('senior earns 15 percent only after reaching the senior monthly quota',()=>{
 const credits=Array.from({length:11},(_,i)=>paid('s'+i));
 const r=POLICY.statement({tenantId:1,managerId:'mgr1',month:'2026-11',tier:'senior',credits});
 assert.equal(r.quotaCents,433300);
 assert.equal(r.revenueCents,440000);
 assert.equal(r.profitCents,264000);
 assert.equal(r.commissionCents,39600);
});
test('tenant boundaries, inactive proof, and duplicate order credit fail closed',()=>{
 assert.throws(()=>POLICY.statement({tenantId:1,managerId:'mgr1',month:'2026-11',tier:'standard',credits:[paid('x'),{...paid('x'),tenantId:2}]}),/CREDIT_TENANT_MISMATCH/);
 assert.throws(()=>POLICY.statement({tenantId:1,managerId:'mgr1',month:'2026-11',tier:'standard',credits:[paid('x'),paid('x')]}),/DUPLICATE_SALES_CREDIT/);
 assert.throws(()=>POLICY.statement({tenantId:1,managerId:'mgr1',month:'2026-11',tier:'standard',credits:[{...paid('x'),proofVerified:false}]}),/CAPTURE_PROOF_REQUIRED/);
 assert.throws(()=>POLICY.statement({tenantId:1,managerId:'mgr1',month:'2026-11',tier:'standard',credits:[{...paid('x'),managerId:'other'}]}),/CREDIT_MANAGER_MISMATCH/);
});
test('refunds and cost overruns reduce profit and never yield negative commission',()=>{
 const r=POLICY.statement({tenantId:1,managerId:'mgr1',month:'2026-11',tier:'standard',credits:[
  {...paid('a', 'mgr1',200000,210000),refundCents:20000},
  paid('b','mgr1',100000,90000)
 ]});
 assert.equal(r.revenueCents,280000);
 assert.equal(r.profitCents,-20000);
 assert.equal(r.commissionCents,0);
});
test('month classification uses Miami date at UTC boundary',()=>{
 const credits=[paid('close','mgr1',300000,100000,'2026-12-01T03:30:00Z')];
 const november=POLICY.statement({tenantId:1,managerId:'mgr1',month:'2026-11',tier:'standard',credits});
 assert.equal(november.revenueCents,300000);
 const december=POLICY.statement({tenantId:1,managerId:'mgr1',month:'2026-12',tier:'standard',credits});
 assert.equal(december.revenueCents,0);
});
test('rejects an unrecognized tier, malformed month and bogus monetary values',()=>{
 assert.throws(()=>POLICY.statement({tenantId:1,managerId:'mgr1',month:'2026-11',tier:'director',credits:[]}),/INVALID_COMPENSATION_TIER/);
 assert.throws(()=>POLICY.statement({tenantId:1,managerId:'mgr1',month:'2026-13',tier:'standard',credits:[]}),/INVALID_SALES_MONTH/);
 assert.throws(()=>POLICY.statement({tenantId:1,managerId:'mgr1',month:'2026-11',tier:'standard',credits:[{...paid('x'),directCostCents:-1}]}),/INVALID_CREDIT_AMOUNT/);
});
test('daily sales objective remains a team target separate from individual quotas',()=>{
 assert.equal(POLICY.TEAM_DAILY_TARGET_CENTS,60000);
 assert.equal(POLICY.TEAM_MONTHLY_TARGET_CENTS,1300000);
 assert.equal(POLICY.TIERS.standard.hourlyCents,500);
 assert.equal(POLICY.TIERS.senior.hourlyCents,600);
});

test('explicit V2 terms use new rates while all legacy terms remain unchanged',()=>{
 const standard=POLICY.statement({tenantId:1,managerId:'mgr1',month:'2026-11',tier:'standard_v2',credits:[paid('v2','mgr1',216700,100000)]});
 assert.equal(standard.quotaCents,216700);assert.equal(standard.commissionBps,900);assert.equal(standard.commissionCents,10503);
 const senior=POLICY.statement({tenantId:1,managerId:'mgr1',month:'2026-11',tier:'senior_v2',credits:[paid('s2','mgr1',433300,200000)]});
 assert.equal(senior.commissionBps,1200);assert.equal(senior.commissionCents,27996);
 const below=POLICY.statement({tenantId:1,managerId:'mgr1',month:'2026-11',tier:'standard_v2',credits:[paid('below','mgr1',216699,0)]});
 assert.equal(below.eligible,false);assert.equal(below.commissionCents,0);
 assert.equal(POLICY.TIERS.standard.commissionBps,1000);assert.equal(POLICY.TIERS.senior.commissionBps,1500);
});
