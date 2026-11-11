'use strict';
/* SBC V66.149 -- independent HR workstation policy.
 * This is operations administration, NOT a regulated payroll engine.
 * No transfer credentials, bank details, money movement, tax withholding,
 * automated contractor classification, or elevated owner privileges.
 */
const HR_ROLE='hr_manager';
const STAFF_ROLES=new Set(['caller','lead_researcher','fulfillment','hr_manager']);
const METHODS=new Set(['Remitly Business','Payoneer','Business bank transfer','Other owner-approved provider']);
const API_RULES=new Set([
 'GET /api/me',
 'GET /api/hr/overview',
 'GET /api/hr/drafts',
 'POST /api/hr/drafts',
 'POST /api/hr/payout-preferences',
 'GET /api/v9/time/status',
 'POST /api/v9/time/clock'
]);
const text=v=>String(v??'').trim();
const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(text(v))&&Number.isFinite(Date.parse(text(v)+'T00:00:00Z'));
function tenant(n){const id=Number(n);if(!Number.isSafeInteger(id)||id<1)throw Object.assign(Error('HR_TENANT_REQUIRED'),{status:403});return id;}
function staff(users,tid){
 return (Array.isArray(users)?users:[]).filter(u=>u&&STAFF_ROLES.has(text(u.role))&&Number(u.tenantId??u.tenant_id)===tenant(tid));
}
function allowed(method,url){return API_RULES.has(text(method).toUpperCase()+' '+text(url).split('?')[0]);}
function method(v){return METHODS.has(text(v))?text(v):null;}
function makeDraft({input={},worker,actor,tenantId,estimatedGrossPay}={}){
 const tid=tenant(tenantId),body=input||{};
 if(!worker||Number(worker.tenantId??worker.tenant_id)!==tid||!STAFF_ROLES.has(text(worker.role)))throw Object.assign(Error('HR_WORKER_NOT_FOUND'),{status:404});
 if(!actor||!['owner',HR_ROLE].includes(text(actor.role))||Number(actor.tenantId??actor.tenant_id)!==tid)throw Object.assign(Error('HR_ACCESS_DENIED'),{status:403});
 const start=text(body.periodStart),end=text(body.periodEnd);
 if(!date(start)||!date(end)||end<start||(Date.parse(end)-Date.parse(start))>90*864e5)throw Object.assign(Error('HR_INVALID_PAY_PERIOD'),{status:400});
 const hours=Number(body.hours),gross=Number(body.proposedUsd);
 if(!Number.isFinite(hours)||hours<0||hours>744||!Number.isFinite(gross)||gross<0||gross>10000)throw Object.assign(Error('HR_INVALID_DRAFT_AMOUNT'),{status:400});
 const provider=method(body.provider);
 if(!provider)throw Object.assign(Error('HR_INVALID_PAYOUT_PROVIDER'),{status:400});
 const note=text(body.note).slice(0,500);
 const baseline=Number.isFinite(Number(estimatedGrossPay))?Number(estimatedGrossPay):null;
 return {id:'hrdraft_'+require('node:crypto').randomBytes(9).toString('hex'),tenantId:tid,
  workerId:text(worker.id),workerName:text(worker.name).slice(0,130),
  periodStart:start,periodEnd:end,hours:Math.round(hours*100)/100,
  proposedUsd:Math.round(gross*100)/100,estimatedSystemGrossUsd:baseline,
  provider,note,reason:'HUMAN_DRAFT_REQUIRES_OWNER_REVIEW',status:'Pending Owner Review',
  createdBy:text(actor.id),createdAt:new Date().toISOString(),decidedAt:null,decidedBy:null,
  externalPaymentInitiated:false,paymentVerified:false};
}
function overview({tenantId,users,v9,actor}={}){
 const tid=tenant(tenantId),data=v9||{},list=staff(users,tid);
 const drafts=(Array.isArray(data?.hrOps?.drafts)?data.hrOps.drafts:[]).filter(d=>Number(d.tenantId)===tid);
 const prefs=data?.hrOps?.preferences||{};
 const entries=Array.isArray(data.timeEntries)?data.timeEntries:[];
 const people=list.map(u=>{
  const id=text(u.id),onboarding=data.onboarding?.[id]||{},comp=data.compensation?.[id]||{};
  const shifts=entries.filter(e=>e&&text(e.userId)===id).slice(0,2000);
  const completed=shifts.filter(e=>e.clockIn&&e.clockOut);
  const minutes=completed.reduce((sum,e)=>{
   const duration=Date.parse(e.clockOut)-Date.parse(e.clockIn);
   if(!Number.isFinite(duration)||duration<0||duration>24*3600000)return sum;
   const breaks=(Array.isArray(e.breaks)?e.breaks:[]).reduce((n,b)=>{
    const ms=Date.parse(b?.end)-Date.parse(b?.start);
    return n+(Number.isFinite(ms)&&ms>0?ms:0);
   },0);
   return sum+Math.max(0,Math.round((duration-breaks)/60000));
  },0);
  return {id,name:text(u.name).slice(0,130),role:text(u.role),active:u.active!==false,
   country:text(onboarding.country||'Not recorded').slice(0,80),
   onboardingStatus:text(onboarding.status||'Not Started').slice(0,80),
   classification:'NOT_VERIFIED',
   agreedRateUsd:Number.isFinite(Number(comp.payRate))?Number(comp.payRate):null,
   payPeriod:text(comp.payPeriod||'Not configured').slice(0,30),
   completedTimeHours:Math.round(minutes/60*100)/100,
   openShifts:shifts.filter(e=>e.clockIn&&!e.clockOut).length,
   payoutPreference:method(prefs[id]?.provider)||'Not selected',
   payoutPreferenceStatus:text(prefs[id]?.status||'Not reviewed'),
   documents:'CHECKLIST_ONLY_NO_FILES',
   taxCompliance:'REQUIRES_CLASSIFICATION_AND_COUNTRY_REVIEW'};
 });
 return {ok:true,readOnly:true,workspace:'SBC HR Department',tenantId:tid,
  actor:{role:actor?.role||'',name:text(actor?.name).slice(0,130)},
  people,counts:{staff:people.length,active:people.filter(p=>p.active).length,
   pendingDrafts:drafts.filter(d=>d.status==='Pending Owner Review').length,
   unreviewedPayoutMethods:people.filter(p=>p.payoutPreferenceStatus!=='Owner Approved').length},
  drafts:drafts.slice(0,100).map(d=>({...d})),providers:[...METHODS],
  restrictions:{ownerOnly:['Create and deactivate accounts','Set compensation rates',
   'Approve or reject draft payouts','Approve payout providers','Mark actual payroll Paid','Initiate external payment'],
   delegatedHr:['View workforce roster and closed time entries','Prepare payout review drafts',
    'Recommend payout provider without storing banking credentials'],
   neverAutomated:['External transfers','Tax withholding','Worker classification','Hiring or firing']},
  note:'Drafts are not wages paid or tax-compliant payroll. Time-clock hours are unapproved and may require corrections; no bank account data, tax documents, provider credentials or employee contact details are exposed.'};
}
module.exports={HR_ROLE,STAFF_ROLES,METHODS,tenant,staff,allowed,method,makeDraft,overview};
