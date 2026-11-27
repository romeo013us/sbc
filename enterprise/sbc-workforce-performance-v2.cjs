'use strict';
// Advisory policy only: signed terms, payroll transfers and personnel decisions remain separate.
const POLICY=Object.freeze({version:'2026-11-27-v2',
 standard:Object.freeze({hourlyCents:500,weeklyQuotaCents:50000,commissionBps:900,english:'required',spanish:'preferred',interviewMinimum:80}),
 senior:Object.freeze({hourlyCents:600,weeklyQuotaCents:100000,commissionBps:1200,english:'required',spanish:'required',interviewMinimum:90}),
 weeklyHours:30,academyMinimumPercent:90,academyMaxHours:8,trialCalendarDays:30,
 payroll:Object.freeze({intervalDays:14,lagDays:null,lagRequiresComplianceReview:true,earnedPayNeverPerformanceGated:true}),
 commissionCycle:'monthly',commissionBasis:'eligible gross profit',monthlyQuotaRequiresSignedTerms:true,
 checkpoints:Object.freeze({firstSaleWorkday:5,twoCustomerWorkday:10,majorReviewWorkday:15}),
 automaticPersonnelAction:false});
const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
function miamiDay(v){const d=new Date(v);if(!Number.isFinite(d.getTime()))throw Error('INVALID_CAPTURE_DATE');return formatter.format(d);}
function day(v){if(typeof v!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(v))throw Error('INVALID_DATE');const d=new Date(v+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v)throw Error('INVALID_DATE');return d;}
function money(v){if(!Number.isSafeInteger(v)||v<0||v>100000000000)throw Error('INVALID_CREDIT_AMOUNT');return v;}
function review({tier,startDate,throughDate,credits=[]}={}){
 if(!['standard','senior'].includes(tier))throw Error('INVALID_TIER');
 const start=day(startDate),end=day(throughDate);const days=(end-start)/86400000;
 if(days<0||days>=30)throw Error('INVALID_TRIAL_RANGE');
 if(!Array.isArray(credits)||credits.length>10000)throw Error('INVALID_CREDITS');
 let workdays=0,day10=null;for(let i=0;i<=days;i++){const d=new Date(+start+i*86400000);if(d.getUTCDay()!==0&&d.getUTCDay()!==6){workdays++;if(workdays===10)day10=d.toISOString().slice(0,10);}}
 const seen=new Set(),customers=new Set(),early=new Set();let revenueCents=0;
 for(const c of credits){if(!c||typeof c.orderId!=='string'||!c.orderId||typeof c.customerId!=='string'||!c.customerId||!['NEW_CUSTOMER','ACTIVE_UPSELL','MANUALLY_SOLD_RENEWAL'].includes(c.source))throw Error('INVALID_CREDIT');
  if(seen.has(c.orderId))throw Error('DUPLICATE_ORDER');seen.add(c.orderId);
  const date=miamiDay(c.capturedAt),gross=money(c.grossCents),refund=money(c.refundCents??0);if(refund>gross)throw Error('INVALID_CREDIT_AMOUNT');
  if(date<startDate||date>throughDate)continue;const net=gross-refund;revenueCents+=net;
  if(net>0&&c.source==='NEW_CUSTOMER'){customers.add(c.customerId);if(!day10||date<=day10)early.add(c.customerId);}
 }
 if(!Number.isSafeInteger(revenueCents))throw Error('INVALID_REVENUE_TOTAL');
 const targetCents=POLICY[tier].weeklyQuotaCents*workdays/5;
 const attainment=targetCents?revenueCents/targetCents*100:null;
 const grade=attainment===null?null:attainment>=125?'A+':attainment>=100?'A':attainment>=90?'B+':attainment>=80?'B':attainment>=60?'C':revenueCents>0?'D':'F';
 return {tier,startDate,throughDate,workdays,targetCents,revenueCents,attainmentPercent:attainment===null?null:Math.round(attainment*100)/100,grade,newPayingCustomers:customers.size,newPayingCustomersByDay10:early.size,twoCustomerMilestone:early.size>=2?'met':workdays>=10?'not_met':'pending',ownerReviewRequired:true,automaticPersonnelAction:false,earnedPayUnaffected:true,limitations:'Calendar weekdays only; owner must review training, holidays, outages, lead quality and ledger completeness. Not a payroll or retention decision.'};
}
module.exports={POLICY,review,miamiDay};
