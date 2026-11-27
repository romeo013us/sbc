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
