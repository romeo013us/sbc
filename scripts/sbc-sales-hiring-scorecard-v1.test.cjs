'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const H=require('../enterprise/sbc-sales-hiring-scorecard-v1.cjs');
const full={verifiedClosingHistory:20,englishRoleplay:15,spanishRoleplay:20,objectionClosing:20,crmFluency:10,accountOwnership:10,reliability:5};
test('strict hiring requires 85/100 plus verified bilingual closing and references',()=>{
 const p=H.evaluate({...full,verifiedClosingHistory:15},{referenceVerified:true,salesEvidenceVerified:true,englishLive:true,spanishLive:true,closingSimulationPassed:true});
 assert.equal(p.score,95);assert.equal(p.decision,'SHORTLIST');
 const low=H.evaluate({...full,spanishRoleplay:10},{referenceVerified:true,salesEvidenceVerified:true,englishLive:true,spanishLive:true,closingSimulationPassed:true});
 assert.equal(low.decision,'DO_NOT_ADVANCE');
});
test('strong paper score cannot bypass live bilingual demonstrations or evidence',()=>{
 const p=H.evaluate(full,{referenceVerified:false,salesEvidenceVerified:false,englishLive:true,spanishLive:false,closingSimulationPassed:true});
 assert.equal(p.score,100);assert.equal(p.decision,'HOLD_FOR_VERIFICATION');
 assert(p.missing.includes('LIVE_SPANISH_REQUIRED'));
});
test('do not use sex, age, race, national origin or other protected traits',()=>{
 const p=H.evaluate({...full,gender:'female',age:28,race:'any'},{
 referenceVerified:true,salesEvidenceVerified:true,englishLive:true,spanishLive:true,closingSimulationPassed:true
 });
 assert.equal(p.decision,'SHORTLIST');
 assert(!JSON.stringify(p).includes('female'));
});
test('reject invalid, inflated, negative and missing rubric scores',()=>{
 for(const bad of [{...full,englishRoleplay:99},{...full,reliability:-1},{...full,crmFluency:NaN},{...full,englishRoleplay:undefined}])
 assert.throws(()=>H.evaluate(bad,{}),/INVALID_SCORE/);
});
test('30-day trial checkpoints and two-of-four minimum with final review',()=>{
 const p=H.probation({weeklyCollectedCents:[70000,62000,45000,68000],weeklyQuotaCents:60000,
 verifiedSales:true,attendanceReviewed:true,ownerApproval:false});
 assert.equal(p.metWeeks,3);assert.equal(p.recommendation,'OWNER_DECISION_REQUIRED');
 const fail=H.probation({weeklyCollectedCents:[10000,10000,20000,30000],weeklyQuotaCents:60000,
 verifiedSales:true,attendanceReviewed:true,ownerApproval:false});
 assert.equal(fail.recommendation,'BELOW_PERFORMANCE_GATE');
});
test('profit forecast includes base payroll, commissions and fixed costs, not just sales',()=>{
 const p=H.forecast({monthlyRevenueCents:1300000,productGrossMarginBps:4000,
 standardManagers:1,seniorManagers:1,hoursPerWeek:30,weeksPerMonth:52/12,
 fixedOverheadCents:100000});
 assert.equal(p.monthlyRevenueCents,1300000);
 assert(p.monthlyBasePayCents>140000);
 assert(p.monthlyCommissionCents>0);
 assert(p.estimatedOperatingContributionCents<300000);
 assert.equal(p.isForecast,true);
});
