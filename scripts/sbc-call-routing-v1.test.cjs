'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const flow=require('../enterprise/sbc-call-routing-v1.cjs');
const at='2026-11-23T14:44:04.535Z';
const customer=()=>({id:'lead-1',tenantId:1,businessName:'Example Business',phone:'+13055550000',status:'Lead',verificationStatus:'Sales Ready'});
const call=(outcome='Pending',status='ended',id='call-1')=>({id,customerId:'lead-1',tenantId:1,status,outcome,endedAt:at});
test('completed pending call rotates away from English call queue',()=>{
 const c=customer(),l=call();assert.equal(flow.eligibleForEnglish(c,[],1,new Date(at)),true);
 const result=flow.routingUpdate(c,l,at);assert.equal(result.changed,true);assert.equal(c.salesQueueState,'contacted_review');
 assert.equal(flow.eligibleForEnglish(c,[l],1,new Date('2026-11-23T15:00Z')),false);
});
test('historical unclassified call is not re-dialed immediately',()=>{
 assert.equal(flow.eligibleForEnglish(customer(),[call()],1,new Date('2026-11-23T15:00Z')),false);
});
test('explicit Spanish handoff is unassigned and preserves valid number',()=>{
 const c=customer();flow.routingUpdate(c,call('Spanish callback needed'),at);
 assert.equal(c.phone,'+13055550000');assert.equal(c.preferredContactLanguage,'es');
 assert.equal(c.salesCallbackAssignedTo,'');assert.equal(c.salesQueueState,'spanish_callback');
 assert.equal(flow.eligibleForEnglish(c,[],1,new Date('2026-11-26')),false);
 assert.deepEqual(flow.spanishCallbacks([c,{...c,id:'foreign',tenantId:2}],1),[c]);
});
test('no automatic Spanish inference from an ordinary hangup',()=>{
 const c=customer();flow.routingUpdate(c,call(),at);assert.equal(c.preferredContactLanguage,undefined);
});
test('same call id and outcome do not double-route; a corrected outcome can re-route',()=>{
 const c=customer(),l=call();flow.routingUpdate(c,l,at);
 assert.equal(flow.routingUpdate(c,l,at).changed,false);l.outcome='Spanish callback needed';
 assert.equal(flow.routingUpdate(c,l,'2026-11-23T18:00Z').changed,true);
 assert.equal(c.salesQueueState,'spanish_callback');
});
test('DNC requests suppress future calling and cannot be undone by language tagging',()=>{
 const c=customer();flow.routingUpdate(c,call('Do Not Call'),at);
 assert.equal(c.doNotContact,true);assert.equal(c.salesQueueState,'retired');
 assert.equal(flow.routingUpdate(c,call('Spanish callback needed'),at).reason,'suppressed');
 assert.equal(flow.eligibleForEnglish(c,[],1,new Date('2026-12-01')),false);
});
test('bad number outcome preserves phone verification hold semantics',()=>{
 const c=customer();flow.routingUpdate(c,call('Bad number'),at);
 assert.equal(c.salesQueueState,'phone_hold');assert.equal(flow.eligibleForEnglish(c,[],1,new Date('2026-12-01')),false);
});
test('unanswered and voicemail calls can be retried after cooldown',()=>{
 for(const outcome of ['No answer','Left voicemail']){
  const c=customer(),l=call(outcome);flow.routingUpdate(c,l,at);
  assert.equal(flow.eligibleForEnglish(c,[l],1,new Date('2026-11-23T18:00Z')),false);
  assert.equal(flow.eligibleForEnglish(c,[l],1,new Date('2026-11-24T17:00Z')),true);
 }
});
test('explicit requested callback has no fabricated date and can become due',()=>{
 const c=customer(),l=call('Follow-up requested');
 flow.routingUpdate(c,l,at);assert.equal(c.salesQueueState,'followup_unscheduled');
 assert.equal(c.salesNextAttemptAt,'');
 assert.equal(flow.eligibleForEnglish(c,[l],1,new Date('2026-11-30T14:00Z')),false);
 c.salesQueueState='callback';c.salesNextAttemptAt='2026-11-25T14:00:00.000Z';
 assert.equal(flow.eligibleForEnglish(c,[l],1,new Date('2026-11-25T15:00Z')),true);
});
test('cross-tenant, suppression and uncertified account manager are blocked',()=>{
 const c=customer();
 assert.equal(flow.eligibleForEnglish(c,[],2,new Date(at)),false);
 c.salesSuppressed=true;assert.equal(flow.eligibleForEnglish(c,[],1,new Date(at)),false);
 assert.equal(flow.isSpanishApproved({role:'account_manager',active:true,spanishCallingApprovedByOwner:true}),true);
 assert.equal(flow.isSpanishApproved({role:'account_manager',active:true,spanishCallingApprovedByOwner:false}),false);
});
test('failed provider connection does not create false completed attempt',()=>{
 const c=customer(),l=call('Pending','failed');
 assert.equal(flow.routingUpdate(c,l,at).changed,false);
 assert.equal(flow.eligibleForEnglish(c,[l],1,new Date(at)),true);
});
test('durability failure restores in-memory customer exactly',()=>{
 const c=customer(),prior=structuredClone(c);flow.routingUpdate(c,call('Spanish callback needed'),at);
 flow.restoreSnapshot(c,prior);assert.deepEqual(c,prior);
});

const row=(patch={})=>({id:'test-1',tenantId:1,status:'Lead',salesQueueState:'spanish_callback',...patch});
test('legacy explicit doNotCall flag suppresses both queues and prevents language re-routing',()=>{
 const c=row({doNotCall:true,salesQueueState:''});
 assert.equal(flow.hasDnc(c),true);
 assert.equal(flow.eligibleForEnglish(c,[],1,new Date(at)),false);
 assert.equal(flow.routingUpdate(c,{id:'attempt',customerId:c.id,tenantId:1,status:'ended',outcome:'Spanish callback needed',endedAt:at},at).changed,false);
});
test('Spanish callback selection excludes suppressed and closed accounts even with stale assigned state',()=>{
 const ready=row({id:'ready'}), assigned=row({id:'assigned',salesQueueState:'callback_assigned'});
 const blocked=[row({doNotContact:true}),row({doNotCall:true}),row({salesSuppressed:true}),row({isSuppressed:true}),row({status:'Do Not Call'}),row({status:'Lost'}),row({status:' closed '}),row({status:'Duplicate'}),row({tenantId:2})];
 assert.deepEqual(flow.spanishCallbacks([ready,...blocked,assigned],1),[ready,assigned]);
});
test('invalid tenant or evaluation clock never makes a record callable',()=>{
 assert.equal(flow.eligibleForEnglish(row({salesQueueState:'',tenantId:0}),[],0,new Date(at)),false);
 assert.equal(flow.eligibleForEnglish(row({salesQueueState:''}),[],1,new Date('bad')),false);
 assert.deepEqual(flow.spanishCallbacks([row({tenantId:0})],0),[]);
});
