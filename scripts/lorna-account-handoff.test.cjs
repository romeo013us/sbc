'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createHandoffService,createMemoryHandoffRepository}=require('../enterprise/sbc-lorna-handoff-v1.cjs');
const fixed=()=>new Date('2026-11-13T15:00:00Z');
const owner={tenantId:1,id:'owner',role:'owner'};
const lorna={tenantId:1,id:'lorna',role:'lead_researcher'};
const alice={tenantId:1,id:'alice',role:'account_manager'};
const bob={tenantId:1,id:'bob',role:'account_manager'};
const tenant2={tenantId:2,id:'lorna',role:'lead_researcher'};
function fixture(){
 const customers=[
 {id:'c1',tenantId:1,businessName:'119th Barber Shop',assignedTo:'lorna',status:'Lead',leadAssistStatus:'AUTO_VERIFIED',verificationStatus:'Verified',source:'Lorna Research',phone:'+13055550100'},
 {id:'c2',tenantId:1,businessName:'Incomplete Business',assignedTo:'lorna',status:'Lead',verificationStatus:'Needs Verification',leadAssistStatus:'NEEDS_HUMAN_REVIEW'},
 {id:'c3',tenantId:1,businessName:'Suppressed Business',assignedTo:'lorna',status:'DNC',leadAssistStatus:'AUTO_VERIFIED',doNotContact:true},
 {id:'c4',tenantId:1,businessName:'Other Researcher Business',assignedTo:'researcher2',status:'Lead',leadAssistStatus:'AUTO_VERIFIED'},
 {id:'c1',tenantId:2,businessName:'Foreign Business',assignedTo:'lorna',status:'Lead',leadAssistStatus:'AUTO_VERIFIED'}
 ];
 const workers=[{id:'lorna',tenantId:1,role:'lead_researcher',active:true,username:'lorna'},{id:'researcher2',tenantId:1,role:'lead_researcher',active:true},{id:'alice',tenantId:1,role:'account_manager',active:true},{id:'bob',tenantId:1,role:'account_manager',active:true},{id:'lorna',tenantId:2,role:'lead_researcher',active:true},{id:'owner',tenantId:1,role:'owner',active:true}];
 const repo=createMemoryHandoffRepository({customers,workers});
 const service=createHandoffService({repository:repo,clock:fixed});
 return {repo,service,customers};
}
test('Lorna submits a verified existing CRM lead once without creating or changing a customer',async()=>{
 const f=fixture(),before=JSON.stringify(f.customers);
 const row=await f.service.submit(lorna,{customerId:'c1',summary:'Website checked and verified from original research.'});
 assert.equal(row.status,'READY_FOR_REVIEW');assert.equal(row.researcherId,'lorna');assert.equal(row.customerId,'c1');
 assert.equal((await f.service.submit(lorna,{customerId:'c1',summary:'Same lead'})).id,row.id,'duplicate handoffs are idempotent');
 assert.equal(JSON.stringify(f.customers),before,'does not mutate the CRM');
 assert.equal((await f.service.queue(owner)).length,1);
});
test('unverified and suppressed businesses cannot enter manager queue',async()=>{
 const f=fixture();
 await assert.rejects(f.service.submit(lorna,{customerId:'c2',summary:'unknown'}),/RESEARCH_NOT_READY/);
 await assert.rejects(f.service.submit(lorna,{customerId:'c3',summary:'Do not contact lead'}),/SUPPRESSED_ACCOUNT/);
 await assert.rejects(f.service.submit(lorna,{customerId:'c4',summary:'Not mine'}),/RESEARCHER_NOT_ASSIGNED/);
});
test('different tenant, unauthorized roles and inactive workers cannot submit or browse',async()=>{
 const f=fixture();
 await assert.rejects(f.service.submit(tenant2,{customerId:'c2',summary:'wrong tenant'}),/CUSTOMER_NOT_FOUND/);
 await assert.rejects(f.service.submit(alice,{customerId:'c1',summary:'not researcher'}),/RESEARCH_ROLE_REQUIRED/);
 await assert.rejects(f.service.queue(lorna),/ACCOUNT_ACCESS_DENIED/);
 f.repo.disableWorker(1,'lorna');
 await assert.rejects(f.service.submit(lorna,{customerId:'c1',summary:'inactive'}),/RESEARCHER_INACTIVE/);
});
test('only owner can approve assigning to an active manager in the same tenant',async()=>{
 const f=fixture();let row=await f.service.submit(lorna,{customerId:'c1',summary:'Verified lead'});
 await assert.rejects(f.service.assign(alice,{handoffId:row.id,managerId:'alice'}),/OWNER_REQUIRED/);
 await assert.rejects(f.service.assign(owner,{handoffId:row.id,managerId:'nobody'}),/MANAGER_INVALID/);
 row=await f.service.assign(owner,{handoffId:row.id,managerId:'alice'});
 assert.equal(row.status,'ASSIGNED');assert.equal(row.managerId,'alice');
 assert.equal((await f.service.queue(alice)).length,1);
 assert.equal((await f.service.queue(bob)).length,0);
 await assert.rejects(f.service.assign(owner,{handoffId:row.id,managerId:'bob'}),/HANDOFF_ALREADY_ASSIGNED/);
});
test('manager return creates one actionable feedback task for Lorna and preserves the CRM record',async()=>{
 const f=fixture();const row=await f.service.submit(lorna,{customerId:'c1',summary:'Research complete'});
 await f.service.assign(owner,{handoffId:row.id,managerId:'alice'});
 await assert.rejects(f.service.returnForResearch(bob,{handoffId:row.id,issue:'BAD_NUMBER',reason:'Could not connect'}),/ACCOUNT_ACCESS_DENIED/);
 const feedback=await f.service.returnForResearch(alice,{handoffId:row.id,issue:'BAD_NUMBER',reason:'Number disconnected, please verify alternate'});
 assert.equal(feedback.status,'OPEN');assert.equal(feedback.researcherId,'lorna');
 assert.equal(feedback.issue,'BAD_NUMBER');
 assert.equal(feedback.retryNotBefore,'2026-11-28T15:00:00.000Z');
 assert.equal((await f.service.researchQueue(lorna)).length,1);
 assert.equal(f.customers[0].status,'Lead');
 await assert.rejects(f.service.returnForResearch(alice,{handoffId:row.id,issue:'BAD_NUMBER',reason:'again'}),/RESEARCH_ALREADY_RETURNED/);
});
test('Lorna cannot resolve feedback without evidence and can escalate when no better number exists',async()=>{
 const f=fixture(),row=await f.service.submit(lorna,{customerId:'c1',summary:'Verified'});
 await f.service.assign(owner,{handoffId:row.id,managerId:'alice'});
 const feedback=await f.service.returnForResearch(alice,{handoffId:row.id,issue:'BAD_NUMBER',reason:'No answer, disconnected'});
 await assert.rejects(f.service.resolve(lorna,{feedbackId:feedback.id,action:'RESOLVED',note:'done'}),/RESEARCH_EVIDENCE_REQUIRED/);
 await assert.rejects(f.service.resolve(bob,{feedbackId:feedback.id,action:'ESCALATED',note:'n/a'}),/RESEARCH_ROLE_REQUIRED/);
 const resolved=await f.service.resolve(lorna,{feedbackId:feedback.id,action:'ESCALATED',note:'The original number remains published, no verified alternative found.'});
 assert.equal(resolved.status,'ESCALATED');assert.equal((await f.service.researchQueue(lorna)).length,0);
 assert.equal((await f.service.queue(alice))[0].status,'NEEDS_OWNER_REVIEW');
});
test('manager cannot send Lorna a loop of repeated research requests after no-new-info escalation',async()=>{
 const f=fixture(),row=await f.service.submit(lorna,{customerId:'c1',summary:'verified'});
 await f.service.assign(owner,{handoffId:row.id,managerId:'alice'});
 const fb=await f.service.returnForResearch(alice,{handoffId:row.id,issue:'BAD_NUMBER',reason:'disconnected'});
 await f.service.resolve(lorna,{feedbackId:fb.id,action:'ESCALATED',note:'No alternative verified'});
 await assert.rejects(f.service.returnForResearch(alice,{handoffId:row.id,issue:'BAD_NUMBER',reason:'retry research'}),/OWNER_REVIEW_REQUIRED/);
});
test('owner summary is based on real handoff states, not invented sales/revenue',async()=>{
 const f=fixture();const row=await f.service.submit(lorna,{customerId:'c1',summary:'verified'});
 await f.service.assign(owner,{handoffId:row.id,managerId:'alice'});
 const summary=await f.service.summary(owner);
 assert.deepEqual(summary.counts,{ready:0,assigned:1,returned:0,ownerReview:0});
 assert.equal(summary.paidSalesVerified,false);assert.equal(summary.revenueAttributed,null);
});

test('reassigning an account immediately revokes the former manager handoff queue and research return permissions',async()=>{
 const f=fixture();const original=await f.service.submit(lorna,{customerId:'c1',summary:'Verified original lead'});
 await f.service.assign(owner,{handoffId:original.id,managerId:'alice'});
 assert.equal((await f.service.queue(alice)).length,1);
 // Simulate owner reassignment via the Account Manager portfolio endpoint.
 f.repo.setAccountManager(1,'c1','bob');
 assert.equal((await f.service.queue(alice)).length,0,'former manager loses pending handoff');
 assert.equal((await f.service.queue(bob)).length,1,'current account owner receives handoff');
 await assert.rejects(f.service.returnForResearch(alice,{handoffId:original.id,issue:'BAD_NUMBER',reason:'Old manager must not create followup'}),/ACCOUNT_ACCESS_DENIED/);
 const feedback=await f.service.returnForResearch(bob,{handoffId:original.id,issue:'BAD_NUMBER',reason:'Current manager confirmed bad number'});
 assert.equal(feedback.managerId,'bob');
});
