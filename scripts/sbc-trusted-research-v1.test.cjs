'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const TRUST=require('../enterprise/sbc-trusted-research-v1.cjs');
const sample=(id='a',overrides={})=>({id,tenantId:1,status:'Lead',businessName:'Auto Service '+id,phone:'3055551122',email:'',leadTemperature:'Warm',verificationStatus:'Needs Verification',...overrides});
test('Lorna submitted lead is owner-trusted without asserting independent provider verification or outreach consent',()=>{
 const c=sample();
 const user={id:'lorna-id',username:'lorna',role:'lead_researcher',active:true};
 assert(TRUST.isLorna(user));assert(!TRUST.isLorna({...user,role:'caller'}));
 const out=TRUST.trust(c,{actorId:user.id,basis:'LORNA_RESEARCH_SUBMISSION',at:'2026-11-22T15:00:00Z'});
 assert.equal(out.applied,true);
 assert.equal(c.verificationStatus,'Sales Ready');
 assert.equal(c.leadIntelligence.verificationStatus,'Sales Ready');
 assert.equal(c.leadIntelligence.ownerTrust.independentVerified,false);
 assert.equal(c.leadIntelligence.ownerTrust.outboundConsentGranted,false);
 assert.equal(c.leadAssist.status,'OWNER_TRUSTED_RESEARCH');
 assert.equal(TRUST.isTrusted(c),true);
});
test('suppression, test leads and terminal customer statuses are never approved',()=>{
 for(const input of [{doNotContact:true},{doNotCall:true},{salesSuppressed:true},{optedOut:true},{status:'duplicate'},{status:'Customer'},{status:'Lost'},{sbcTest:true},{notes:'Do not contact this business'}]){
  const c=sample('blocked',input);
  assert.equal(TRUST.trust(c,{actorId:'owner',basis:'OWNER_EXISTING_BATCH'}).applied,false);
  assert.equal(c.verificationStatus,'Needs Verification');
 }
});
test('bulk preview covers all owner tenant leads while excluding duplicate contact identities',()=>{
 const rows=[sample('a'),sample('b',{phone:'7865559933'}),sample('dupe',{phone:'3055551122'}),sample('missing',{phone:'',email:''}),sample('foreign',{tenantId:2}),sample('blocked',{salesSuppressed:true})];
 const p=TRUST.plan(rows,1);
 assert.equal(p.totalTenant,5);assert.equal(p.approvable,1);
 assert.equal(p.skipped.DUPLICATE_IDENTITY,2);assert.equal(p.skipped.MISSING_CONTACT,1);
 assert.equal(p.skipped.SUPPRESSED,1);
 assert.deepEqual(p.ids,['b']);
});
test('unverified records are trusted as human-researched only, never fabricated as externally verified',()=>{
 const c=sample('nomail',{email:'',phone:'3055558888',leadTemperature:'Cold'});
 const r=TRUST.trust(c,{actorId:'owner',basis:'OWNER_EXISTING_BATCH'});
 assert.equal(r.applied,true);
 assert.equal(c.leadTemperature,'Cold');
 assert.equal(c.leadIntelligence.ownerTrust.basis,'OWNER_EXISTING_BATCH');
 assert.equal(c.leadIntelligence.ownerTrust.externalVerificationPerformed,false);
 assert.equal(c.leadIntelligence.ownerTrust.outboundConsentGranted,false);
});
test('idempotency preserves previously qualified independent-verification records',()=>{
 const c=sample('old',{verificationStatus:'Sales Ready',leadIntelligence:{verificationStatus:'Sales Ready',verifiedSignals:{source:'independent'}}});
 assert.equal(TRUST.trust(c,{actorId:'owner',basis:'OWNER_EXISTING_BATCH'}).applied,false);
 assert.equal(c.leadIntelligence.verifiedSignals.source,'independent');
});
