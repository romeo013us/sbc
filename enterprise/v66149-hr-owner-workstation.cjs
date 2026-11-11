'use strict';
/* V66.149 – HR department owner acceptance read model.
 * No worker/classification mutations, payments, provider calls or tax advice.
 * Deliberately no live HR-manager role: role activation requires audited
 * deny-by-default session/RBAC, manager invite and finance separation.
 */
const WORKERS=new Set(['caller','lead_researcher','fulfillment']);
const MAX_PEOPLE=500;
function tenant(id){
 const t=Number(id);
 if(!Number.isSafeInteger(t)||t<1)throw Object.assign(Error('HR_TENANT_REQUIRED'),{code:'HR_TENANT_REQUIRED',status:403});
 return t;
}
function str(v,n=120){return String(v??'').trim().slice(0,n)}
function amount(v){const n=Number(v);return Number.isFinite(n)&&n>=0&&n<1e8?Math.round(n*100)/100:0}
function visible(opts={}){
 const tid=tenant(opts.tenantId);
 const users=Array.isArray(opts.users)?opts.users:[];
 const v=opts.v9&&typeof opts.v9==='object'?opts.v9:{};
 const compensation=v.compensation&&typeof v.compensation==='object'?v.compensation:{};
 const onboarding=v.onboarding&&typeof v.onboarding==='object'?v.onboarding:{};
 const timeEntries=Array.isArray(v.timeEntries)?v.timeEntries:[];
 const runs=Array.isArray(v.payrollRuns)?v.payrollRuns:[];
 const roster=users.filter(u=>u&&Number(u.tenantId??u.tenant_id)===tid&&WORKERS.has(String(u.role))).slice(0,MAX_PEOPLE);
 const ids=new Set(roster.map(u=>String(u.id)));
 const now=Date.now();
 const work=roster.map(u=>{
  const id=String(u.id),c=compensation[id]||{},o=onboarding[id]||{};
  const logged=timeEntries.filter(e=>String(e.userId)===id);
  const closed=logged.filter(e=>e.clockIn&&e.clockOut);
  const minutes=closed.reduce((acc,e)=>{
   const duration=(Date.parse(e.clockOut)-Date.parse(e.clockIn))/60000;
   const breaks=(Array.isArray(e.breaks)?e.breaks:[]).reduce((sum,b)=>{
    const m=b.start&&b.end?(Date.parse(b.end)-Date.parse(b.start))/60000:0;
    return sum+(Number.isFinite(m)&&m>=0?m:0);
   },0);
   return acc+(Number.isFinite(duration)&&duration>=0?Math.max(0,duration-breaks):0);
  },0);
  const exp=str(u.expiresAt,35);
  const expiration=exp&&Number.isFinite(Date.parse(exp))?Date.parse(exp)<=now:false;
  return {id,strName:str(u.name,90),username:str(u.username,60),role:String(u.role),
    active:u.active!==false&&!expiration,expired:expiration,
    locationCountry:str(o.country,75)||'Not recorded',
    classification:'NOT_DETERMINED_BY_THIS_SYSTEM',
    onboardingStatus:str(o.status,65)||'Not started',
    agreementRecorded:o.contractorAgreementAccepted===true,
    ownerVerified:o.ownerVerified===true,
    payCurrency:str(c.currency,12)||'USD',
    rate:amount(c.payRate),payPeriod:str(c.payPeriod,30)||'Unspecified',
    closedHours:Math.round(minutes/60*100)/100,
    openClockEntries:logged.filter(e=>e.clockIn&&!e.clockOut).length};
 });
 const owned=runs.filter(r=>ids.has(String(r.userId))).
  sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,100).
  map(r=>({id:str(r.id,80),staffId:str(r.userId,80),
   periodStart:str(r.periodStart,25),periodEnd:str(r.periodEnd,25),
   status:['Draft','Approved','Paid','Void'].includes(r.status)?r.status:'Needs Review',
   recordedAmount:amount(r.total),currency:str(r.currency,12)||'USD',
   paidAt:str(r.paidAt,35),hasPaymentReference:Boolean(str(r.paymentReference))}));
 const totals={active:work.filter(p=>p.active).length,inactive:work.filter(p=>!p.active).length,
  onboardingReview:work.filter(p=>p.onboardingStatus!=='Approved'||!p.ownerVerified).length,
  openTimeEntries:work.reduce((a,p)=>a+p.openClockEntries,0),
  draftPayroll:owned.filter(r=>r.status==='Draft').length,
  approvedPayroll:owned.filter(r=>r.status==='Approved').length,
  paidMarked:owned.filter(r=>r.status==='Paid').length};
 return {ok:true,readOnly:true,version:'66.149',tenantId:tid,capabilities:{
    owner:['view_personnel','review_attendance','review_compensation','review_payroll_drafts','open_existing_owner_controls'],
    hrManagerFuture:['view_assigned_personnel','request_onboarding','review_time_entries','prepare_payroll_drafts','flag_policy_issues'],
    forbiddenForHr:['change_own_pay','create_admin_accounts','approve_payroll','send_money','mark_paid','access_crm','view_secrets']
  },roleActivation:'HR_MANAGER_NOT_ENABLED',
  totalPeople:work.length,people:work,totals,payrollRuns:owned,
  warning:'Pay summaries and Paid status are internal bookkeeping, not provider confirmation. Contractor labels are not a legal classification. No live HR-manager login is enabled.'};
}
module.exports={visible,tenant,WORKERS};