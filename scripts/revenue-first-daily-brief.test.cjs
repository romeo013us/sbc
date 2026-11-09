'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {brief,isHumanCallCandidate,isQA,dayKey}=require('../enterprise/revenue-first-daily-brief.cjs');
const lead=(changes={})=>({id:'lead_a',tenantId:1,businessName:'Neighborhood Shop',phone:'3055550102',verificationStatus:'Verified',leadTemperature:'Hot',status:'Lead',...changes});
const square=(changes={})=>({id:'paid_a',tenantId:1,product:'SBC Service',customerName:'Real Customer',price:199,paymentStatus:'PAID',squareOrderId:'sqord_A',squarePaymentId:'sqpay_A',squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-11-09T20:00:00Z',...changes});
const scope=(customers=[],orders=[],revenueContactEvents=[])=>({customers,orders,revenueContactEvents});
test('prioritizes verified prospects without making calls',()=>{
 const db=scope([lead(),lead({id:'lead_b',leadTemperature:'Warm',followUp:'2026-11-09T13:00:00Z'})]);
 const r=brief(db,{tenantId:1,now:'2026-11-09T20:00:00Z'});assert.equal(r.calling.eligibleCount,2);
 assert.equal(r.calling.queue[0].id,'lead_b');
 assert.equal(r.calling.records.attempts,0);assert.equal(r.calling.queue.length,2);
});
test('no unverified leads or suppressed contacts',()=>{
 const r=brief(scope([lead({id:'bad',verificationStatus:'Research Complete'}),lead({id:'dnc',doNotContact:true}),lead({id:'lost',status:'Lost'}),lead({id:'ok'})]),{tenantId:1,now:'2026-11-09T20:00:00Z'});
 assert.equal(r.calling.eligibleCount,1);assert.equal(r.calling.queue[0].id,'ok');
});
test('tenant isolation in contacts and sales',()=>{
 const r=brief(scope([lead(),lead({id:'other',tenantId:2})],[square(),square({id:'sq2',tenantId:2})]),{tenantId:1,now:'2026-11-09T20:00:00Z'});
 assert.equal(r.calling.eligibleCount,1);assert.equal(r.commerce.squareEvidencedCustomerOrders,1);
});
test('only Square-evidenced payments count, not status labels',()=>{
 const r=brief(scope([], [square(),square({id:'status_only',squareOrderId:'',squarePaymentId:''})]),{tenantId:1,now:'2026-11-09T20:00:00Z'});
 assert.equal(r.commerce.squareEvidencedCustomerOrders,1);
 assert.equal(r.commerce.squareEvidencedRevenueToday,199);
});
test('internal owner QA payment is excluded',()=>{
 const r=brief(scope([],[square({id:'qa1',customerName:'SBC SYSTEM TEST — DO NOT SERVICE'}),square({id:'qa2',product:'Internal Test checkout'}),square()]),{tenantId:1,now:'2026-11-09T20:00:00Z'});
 assert.equal(r.commerce.squareEvidencedCustomerOrders,1);
});
test('costs are unknown until evidenced, no imaginary profit',()=>{
 const r=brief(scope([],[square()]),{tenantId:1,now:'2026-11-09T20:00:00Z'});
 assert.equal(r.commerce.contributionAfterObservedCost,null);
});
test('budget ceilings default $25 AI and $75 marketing, no spending',()=>{
 const r=brief(scope(),{tenantId:1,now:'2026-11-09T20:00:00Z'});
 assert.equal(r.budget.maximumIllustrativeOutlay,600);
 assert.equal(r.budget.marketingAutoSpendAuthorized,false);
 assert.equal(r.budget.openaiAutoSpendAuthorized,false);
});
test('daily calling records deduped and time bounded',()=>{
 const db=scope([],[],[{id:'c1',tenantId:1,eventType:'CALL_ATTEMPT',createdAt:'2026-11-09T20:00:00Z'},
 {id:'c1',tenantId:1,eventType:'CALL_ATTEMPT',createdAt:'2026-11-09T20:00:00Z'},
 {id:'c2',tenantId:1,eventType:'CALL_ATTEMPT',createdAt:'2026-11-08T20:00:00Z'}]);
 assert.equal(brief(db,{tenantId:1,now:'2026-11-09T20:00:00Z'}).calling.records.attempts,1);
});
test('Eastern local day boundary is used',()=>{
 assert.equal(dayKey('2026-11-10T02:30:00Z'),'2026-11-09');
});
test('foreign tenant context rejects',()=>assert.throws(()=>brief(scope(),{tenantId:0}),{code:'TENANT_CONTEXT_REQUIRED'}));
test('read-side report does not modify source CRM',()=>{
 const db=scope([lead()], [square()],[]);
 const before=JSON.stringify(db);brief(db,{tenantId:1,now:'2026-11-09T20:00:00Z'});
 assert.equal(JSON.stringify(db),before);
});
