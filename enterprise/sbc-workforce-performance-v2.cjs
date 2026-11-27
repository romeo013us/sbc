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
// A budget and calendar only; no worker enrollment, actual payroll, or hiring decision.
function trialPlan({startDate,tiers,reserveCents}={}){
 const start=day(startDate);
 if(!Array.isArray(tiers)||tiers.length<1||tiers.length>2||tiers.some(t=>!['standard','senior'].includes(t)))throw Error('INVALID_TRIAL_TIERS');
 const reserve=reserveCents===undefined?null:money(reserveCents);
 const workDates=[];
 for(let i=0;i<30;i++){const d=new Date(+start+i*86400000);if(d.getUTCDay()!==0&&d.getUTCDay()!==6)workDates.push(d.toISOString().slice(0,10));}
 const endDate=new Date(+start+29*86400000).toISOString().slice(0,10);
 const members=tiers.map(tier=>({tier,plannedHours:workDates.length*6,plannedBaseCents:workDates.length*6*POLICY[tier].hourlyCents,plannedRevenueTargetCents:workDates.length*POLICY[tier].weeklyQuotaCents/5}));
 const plannedBaseCents=members.reduce((a,m)=>a+m.plannedBaseCents,0);
 return {startDate,endDate,workdays:workDates.length,members,plannedBaseCents,reserveCents:reserve,
  reserveShortfallCents:reserve===null?null:Math.max(0,plannedBaseCents-reserve),reserveCoversPlannedBase:reserve===null?null:reserve>=plannedBaseCents,
  checkpoints:{day5:workDates[4],day10:workDates[9],day15:workDates[14],day30:endDate},
  currentLongTermOpenings:1,possibleLongTermOpenings:2,firstPayday:null,payrollIntervalDays:14,
  enrollmentAuthorized:false,payrollInitiated:false,ownerReviewRequired:true,
  limitations:'Planned six-hour weekdays only; actual earned hours and applicable pay rules govern. Reserve excludes commissions, fees and other liabilities. No payday inferred until signed schedule is reviewed.'};
}
function enrollmentPlan(input={}){
 if(input.confirm!=='OWNER_CONFIRMED_PAID_TRIAL'||input.signedTermsConfirmed!==true||input.payScheduleReviewed!==true||input.fairOpportunityConfirmed!==true)throw Error('TRIAL_CONFIRMATION_REQUIRED');
 if(!Array.isArray(input.members)||input.members.length<1||input.members.length>2)throw Error('INVALID_TRIAL_TIERS');
 const seen=new Set();
 const members=input.members.map(m=>{
  if(!m||typeof m.managerId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/.test(m.managerId))throw Error('INVALID_SALES_IDENTIFIER');
  if(seen.has(m.managerId))throw Error('DUPLICATE_TRIAL_MANAGER');seen.add(m.managerId);
  if(typeof m.agreementReference!=='string'||m.agreementReference.trim().length<12||m.agreementReference.length>180)throw Error('SIGNED_TRIAL_AGREEMENT_REQUIRED');
  return {managerId:m.managerId,tier:m.tier,agreementReference:m.agreementReference.trim()};
 });
 const plan=trialPlan({startDate:input.startDate,tiers:members.map(m=>m.tier),reserveCents:input.reserveCents});
 if(plan.reserveCoversPlannedBase!==true)throw Error('TRIAL_RESERVE_INSUFFICIENT');
 return {plan,members};
}
module.exports={POLICY,review,miamiDay,trialPlan,enrollmentPlan};
