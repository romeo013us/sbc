'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {POLICY,review}=require('../enterprise/sbc-workforce-performance-v2.cjs');
const sale=(id,customerId,day,grossCents,refundCents=0)=>({orderId:id,customerId,capturedAt:day+'T16:00:00Z',grossCents,refundCents,source:'NEW_CUSTOMER'});
test('policy preserves tier distinctions and separates payroll from reviews',()=>{
 assert.equal(POLICY.standard.commissionBps,900);assert.equal(POLICY.senior.commissionBps,1200);
 assert.equal(POLICY.standard.spanish,'preferred');assert.equal(POLICY.senior.spanish,'required');
 assert.equal(POLICY.standard.weeklyQuotaCents,50000);assert.equal(POLICY.senior.weeklyQuotaCents,100000);
 assert.equal(POLICY.payroll.intervalDays,14);assert.equal(POLICY.payroll.lagDays,null);
});
test('two weeks count unique net-paying new customers and refunds',()=>{
 const r=review({tier:'standard',startDate:'2026-11-30',throughDate:'2026-12-11',credits:[sale('1','a','2026-12-01',50000),sale('2','a','2026-12-02',10000),sale('3','b','2026-12-09',50000,10000),sale('4','c','2026-12-10',5000,5000)]});
 assert.equal(r.workdays,10);assert.equal(r.revenueCents,100000);assert.equal(r.newPayingCustomers,2);assert.equal(r.grade,'A');assert.equal(r.twoCustomerMilestone,'met');assert.equal(r.automaticPersonnelAction,false);
});
test('three-week senior target, dates, empty evidence and duplicate orders',()=>{
 const r=review({tier:'senior',startDate:'2026-11-30',throughDate:'2026-12-18',credits:[]});
 assert.equal(r.targetCents,300000);assert.equal(r.grade,'F');assert.equal(r.ownerReviewRequired,true);
 assert.throws(()=>review({tier:'standard',startDate:'2026-02-30',throughDate:'2026-03-04'}),/INVALID_DATE/);
 assert.throws(()=>review({tier:'standard',startDate:'2026-11-30',throughDate:'2026-12-18',credits:[sale('1','a','2026-12-01',10),sale('1','b','2026-12-02',20)]}),/DUPLICATE_ORDER/);
});

test('paid competitive trial budget covers all scheduled weekdays in the full 30 calendar days',()=>{
 const {trialPlan}=require('../enterprise/sbc-workforce-performance-v2.cjs');
 const p=trialPlan({startDate:'2026-11-30',tiers:['standard','senior'],reserveCents:145200});
 assert.equal(p.endDate,'2026-12-29');assert.equal(p.workdays,22);
 assert.equal(p.plannedBaseCents,145200);assert.equal(p.reserveShortfallCents,0);
 assert.equal(p.checkpoints.day5,'2026-12-04');assert.equal(p.checkpoints.day10,'2026-12-11');assert.equal(p.checkpoints.day15,'2026-12-18');
 assert.equal(p.enrollmentAuthorized,false);assert.equal(p.payrollInitiated,false);
 assert.equal(p.currentLongTermOpenings,2);
 assert.deepEqual(p.launchTiers,['standard','standard']);
 assert.equal(p.seniorRequiresProvenPerformance,true);
 const insufficient=trialPlan({startDate:'2026-11-30',tiers:['standard','standard'],reserveCents:120000});
 assert.equal(insufficient.reserveShortfallCents,12000);assert.equal(insufficient.reserveCoversPlannedBase,false);
});
test('trial plan never invents a payday or accepts invalid dates, tiers or reserve amounts',()=>{
 const {trialPlan}=require('../enterprise/sbc-workforce-performance-v2.cjs');
 assert.throws(()=>trialPlan({startDate:'2026-02-30',tiers:['standard']}),/INVALID_DATE/);
 assert.throws(()=>trialPlan({startDate:'2026-11-30',tiers:['standard','senior','senior']}),/INVALID_TRIAL_TIERS/);
 assert.throws(()=>trialPlan({startDate:'2026-11-30',tiers:['standard'],reserveCents:-1}),/INVALID_CREDIT_AMOUNT/);
 const p=trialPlan({startDate:'2026-11-30',tiers:['standard']});
 assert.equal(p.firstPayday,null);assert.equal(p.reserveCoversPlannedBase,null);
});

test('enrollment validates the signed paid trial, unique members and funded base-pay commitment',()=>{
 const {enrollmentPlan}=require('../enterprise/sbc-workforce-performance-v2.cjs');
 const input={startDate:'2026-11-30',members:[{managerId:'a',tier:'standard',agreementReference:'signed-agreement-a'},{managerId:'b',tier:'senior',agreementReference:'signed-agreement-b'}],reserveCents:145200,confirm:'OWNER_CONFIRMED_PAID_TRIAL',signedTermsConfirmed:true,payScheduleReviewed:true,fairOpportunityConfirmed:true};
 const p=enrollmentPlan(input);
 assert.equal(p.plan.plannedBaseCents,145200);assert.equal(p.members.length,2);
 assert.throws(()=>enrollmentPlan({...input,reserveCents:145199}),/TRIAL_RESERVE_INSUFFICIENT/);
 assert.throws(()=>enrollmentPlan({...input,payScheduleReviewed:false}),/TRIAL_CONFIRMATION_REQUIRED/);
 assert.throws(()=>enrollmentPlan({...input,members:[input.members[0],input.members[0]]}),/DUPLICATE_TRIAL_MANAGER/);
 assert.throws(()=>enrollmentPlan({...input,members:[{...input.members[0],agreementReference:'x'}]}),/SIGNED_TRIAL_AGREEMENT_REQUIRED/);
});

test('biweekly schedule requires explicit reviewed payday and never gates earned pay on sales',()=>{
 const {paySchedule}=require('../enterprise/sbc-workforce-performance-v2.cjs');
 const input={startDate:'2026-11-30',firstPayday:'2026-12-18',scheduleReviewed:true,agreementReference:'signed-pay-schedule-01'};
 const p=paySchedule(input);
 assert.equal(p.intervalDays,14);assert.equal(p.periods[0].startDate,'2026-11-30');
 assert.equal(p.periods[0].endDate,'2026-12-13');assert.equal(p.periods[1].payday,'2027-01-01');
 assert.equal(p.periods[2].endDate,'2026-12-29');assert.equal(p.earnedPayNeverPerformanceGated,true);
 assert.equal(p.paymentInitiated,false);assert.equal(p.complianceCertified,false);
 assert.throws(()=>paySchedule({...input,scheduleReviewed:false}),/PAY_SCHEDULE_REVIEW_REQUIRED/);
 assert.throws(()=>paySchedule({...input,firstPayday:'2026-11-29'}),/INVALID_FIRST_PAYDAY/);
});
test('recognition is provisional on incomplete ledger and does not grant pay or promotion',()=>{
 const {recognition}=require('../enterprise/sbc-workforce-performance-v2.cjs');
 const input={tier:'standard',newPayingCustomers:1,weeklyRevenueCents:75000,monthlyRevenueCents:433400,monthlyQuotaCents:216700,ledgerComplete:true,qualityReviewed:true,qualityPassed:true};
 const r=recognition(input);
 assert.deepEqual(r.eligibleForOwnerReview,['RISING_STAR','CERTIFIED_CLOSER','REVENUE_CHAMPION','ELITE','PRESIDENTS_CLUB']);
 assert.equal(r.automaticAward,false);assert.equal(r.compensationChanged,false);
 assert.deepEqual(recognition({...input,ledgerComplete:false}).eligibleForOwnerReview,[]);
 assert.deepEqual(recognition({...input,qualityPassed:false}).eligibleForOwnerReview,[]);
 assert.throws(()=>recognition({...input,monthlyQuotaCents:1}),/INVALID_MONTHLY_QUOTA/);
});

test('Senior advancement needs four completed weeks, demonstrated Senior capacity, certification and explicit quality review',()=>{
 const {seniorReview}=require('../enterprise/sbc-workforce-performance-v2.cjs');
 const base={trialCompleted:true,academyCertified:true,ledgerReviewed:true,trialAccepted:true,bilingualVerified:true,qualityPassed:true,reliabilityPassed:true,weeklyRevenueCents:[50000,100000,50000,100000]};
 const result=seniorReview(base);
 assert.equal(result.eligible,true);assert.equal(result.automaticPromotion,false);assert.equal(result.compensationChanged,false);
 for(const key of ['trialCompleted','academyCertified','ledgerReviewed','trialAccepted','bilingualVerified','qualityPassed','reliabilityPassed'])assert.equal(seniorReview({...base,[key]:false}).eligible,false,key);
 assert.equal(seniorReview({...base,weeklyRevenueCents:[49999,150000,50000,100000]}).eligible,false);
 assert.equal(seniorReview({...base,weeklyRevenueCents:[50000,50000,50000,100000]}).eligible,false);
 assert.throws(()=>seniorReview({...base,weeklyRevenueCents:[50000]}),/INVALID_PROMOTION_WEEKS/);
});
