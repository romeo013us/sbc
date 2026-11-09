'use strict';
/* SBC V66.128 owner-only deterministic employee activity recap.
 * Read-only, zero AI credits. Evidence comes from tenant-scoped employees,
 * durable SQL audit and CRM rows, plus the recorded server time clock.
 */
const BAD=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFD]|(?:PK\x03\x04)|(?:xl\/(?:styles|workbook)\.xml)|(?:\[Content_Types\]\.xml)/u;
const stamp=x=>{const n=new Date(x).getTime();return Number.isFinite(n)?n:null;};
const safe=(v,fallback='Unavailable')=>{
 const s=String(v??'').trim();return s&&!BAD.test(s)?s.slice(0,100):fallback;
};
const meta=v=>{if(v&&typeof v==='object'&&!Array.isArray(v))return v;
 if(typeof v==='string'){try{const x=JSON.parse(v);return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}catch{}}return {};
};
const employeeRoles=new Set(['lead_researcher','researcher','prospector','lead_generator','caller','sales','sales_rep','sales_agent','sales_manager','sales_account_manager','account_manager','fulfillment','support','manager','employee','admin']);
const LABELS=Object.freeze({
 login:['Access','Signed into Command Center'],
 time_clock:['Shift','Time clock event'],
 workforce_lead_created:['Leads','Lead saved to CRM'],
 lead_updated:['Leads','Lead edited'],
 lead_verification_update:['Leads','Lead verification updated'],
 lead_submitted_to_kim:['Leads','Lead submitted for review'],
 lead_submitted:['Leads','Lead submitted'],
 research_notice_resolved:['Leads','Research correction resolved'],
 call_report:['Sales','Call report submitted'],
 v9_call_report:['Sales','Call report submitted'],
 voice_call:['Sales','Voice call activity recorded'],
 website_demo:['Sales','Website demo updated'],
 training_progress_v2:['Training','Training progress recorded'],
 training_attempt_submitted_v2:['Training','Training assessment submitted'],
 training_certification_v2:['Training','Training certification recorded'],
 training_assignment_v2:['Training','Training assignment updated'],
 training_assessment_review_v2:['Training','Training assessment reviewed'],
 onboarding_updated:['Training','Onboarding progress updated'],
 customer_created:['CRM','Customer created'],
 customer_updated:['CRM','Customer edited'],
 workflow_created:['Tasks','Workflow created'],
 lead_assignment:['Tasks','Lead assignment updated'],
 lead_batch_assignment:['Tasks','Lead batch assigned'],
 mega_next_action_created:['Tasks','Next action created'],
 pipeline_stage_changed:['Tasks','Pipeline stage updated'],
 fulfillment_assignment:['Tasks','Fulfillment assignment updated'],
 production_stage_changed:['Tasks','Production stage changed'],
 user_created:['Administration','User account created'],
 user_updated:['Administration','User account changed']
});
function classify(type){
 if(Object.hasOwn(LABELS,type))return LABELS[type];
 if(/^training_|^cert_|^onboarding_/.test(type))return ['Training','Training activity recorded'];
 if(/^call_|^voice_/.test(type))return ['Sales','Calling activity recorded'];
 if(/^lead_|^workforce_/.test(type))return ['Leads','Lead or workforce activity recorded'];
 if(/^time_|^shift_/.test(type))return ['Shift','Shift activity recorded'];
 if(/^payment_|^refund_|^commission_/.test(type))return ['Financial','Financial workflow action recorded'];
 if(/^kim_|^ai_|^autonomous_/.test(type))return ['Automation','Automation action recorded'];
 return ['Other','Recorded system action'];
}
function eligibleUsers(users,tenantId){
 const t=Number(tenantId);
 if(!Number.isSafeInteger(t)||t<1)throw Error('OWNER_RECAP_TENANT_REQUIRED');
 return (Array.isArray(users)?users:[])
   .filter(u=>u&&Number(u.tenantId)===t&&employeeRoles.has(String(u.role||'').toLowerCase()))
   .filter(u=>String(u.id||'').length>0);
}
function summarize({tenantId,users,events,crmRows,shiftEntries,now=Date.now(),hours=24,truncated=false}={}){
 const t=Number(tenantId),span=Number(hours);
 if(!Number.isSafeInteger(t)||t<1)throw Error('OWNER_RECAP_TENANT_REQUIRED');
 if(![24,48,168].includes(span))throw Error('OWNER_RECAP_WINDOW_INVALID');
 if(!Array.isArray(events)||!Array.isArray(crmRows))throw Error('OWNER_RECAP_AUTHORITATIVE_RECORDS_REQUIRED');
 const end=Number(now),start=end-span*3600000;
 if(!Number.isFinite(end)||end<=0)throw Error('OWNER_RECAP_CLOCK_INVALID');
 const employees=eligibleUsers(users,t),person=new Map(employees.map(u=>[String(u.id),{
  id:String(u.id),name:safe(u.name||u.username,'Employee name unreadable'),
  role:safe(u.role||'employee','employee'),active:u.active!==false,
  leadsSaved:0,researchComplete:0,callReports:0,leadUpdates:0,demosUpdated:0,
  signIns:0,trainingEvents:0,otherActions:0,unverifiedLeadEvents:0,
  activity:[],lastShift:null,latestActivityAt:null
 }]));
 const crm=new Map(crmRows.filter(c=>Number(c.tenant_id??c.tenantId)===t)
   .map(c=>[String(c.id),{id:String(c.id),businessName:safe(c.business_name??c.businessName,'CRM name unreadable')}]));
 const seenEvents=new Set(),byLead=new Set(),timeline=[];
 let unverifiable=0,badTimes=0;
 for(const e of [...events].sort((a,b)=>(stamp(b.created_at??b.createdAt)||0)-(stamp(a.created_at??a.createdAt)||0))){
  const userId=String(e.user_id??e.userId??''),employee=person.get(userId);
  if(!employee)continue;
  const at=stamp(e.created_at??e.createdAt),kind=String(e.event_type??e.eventType??'');
  if(at===null||at<start||at>end){badTimes++;continue;}
  const id=String(e.id||'');
  if(!id||seenEvents.has(id)||!/^[a-z0-9_:-]{2,90}$/i.test(kind))continue;
  seenEvents.add(id);
  const m=meta(e.meta_json??e.meta),leadId=String(m.customerId||'');
  const record=leadId?crm.get(leadId):null;
  const mustHaveRecord=new Set(['workforce_lead_created','lead_updated','lead_verification_update','call_report','v9_call_report','website_demo','lead_submitted_to_kim']);
  const verified=!mustHaveRecord.has(kind)||Boolean(record);
  if(!verified){unverifiable++;if(kind==='workforce_lead_created')employee.unverifiedLeadEvents++;}
  if(verified){
   if(kind==='workforce_lead_created'&&!byLead.has(userId+':'+leadId)){
    byLead.add(userId+':'+leadId);employee.leadsSaved++;
    if(m.researchComplete===true)employee.researchComplete++;
   }
   if(kind==='call_report'||kind==='v9_call_report')employee.callReports++;
   if(kind==='lead_updated'||kind==='lead_verification_update')employee.leadUpdates++;
   if(kind==='website_demo')employee.demosUpdated++;
  }
  if(kind==='login')employee.signIns++;
  if(classify(kind)[0]==='Training')employee.trainingEvents++;
  if(classify(kind)[0]==='Other')employee.otherActions++;
  const [category,label]=classify(kind);
  const item={employeeId:userId,employee:employee.name,type:kind,category,
   label:verified?label:label+' — CRM link unverified',
   verified, ...(record?{customerId:record.id,businessName:record.businessName}:{}),
   at:new Date(at).toISOString()};
  // Do not display free-form audit messages, passwords, notes, tokens, phone
  // numbers or raw meta JSON. These entries describe server-recorded actions.
  timeline.push(item);employee.activity.push(item);
  employee.latestActivityAt=employee.latestActivityAt||item.at;
 }
 // Shift records are from the existing durable V9 server state, not from
 // locally checked browser task boxes. Keep last shift for context (7 days).
 for(const s of Array.isArray(shiftEntries)?shiftEntries:[]){
  const employee=person.get(String(s?.userId||'')),started=stamp(s?.clockIn);
  if(!employee||started===null||started<end-7*86400000||started>end)continue;
  const finished=stamp(s?.clockOut),out=finished!==null&&finished>=started&&finished<=end?finished:null;
  if(!employee.lastShift||started>stamp(employee.lastShift.clockIn)){
   employee.lastShift={clockIn:new Date(started).toISOString(),
    clockOut:out===null?null:new Date(out).toISOString(),
    status:out===null?'OPEN_OR_MISSING_CLOCK_OUT':'CLOCKED_OUT',
    recordedMinutes:out===null?null:Math.round((out-started)/60000),
    mode:safe(s.mode||'unspecified','unspecified')};
  }
 }
 const people=[...person.values()].sort((a,b)=>a.name.localeCompare(b.name));
 const keys=['leadsSaved','researchComplete','callReports','leadUpdates','demosUpdated','signIns','trainingEvents','otherActions'];
 const totals=Object.fromEntries(keys.map(k=>[k,people.reduce((n,p)=>n+p[k],0)]));
 const warnings=[];
 if(!people.length)warnings.push('No tenant-scoped employee accounts found. This does not prove no work occurred.');
 if(unverifiable)warnings.push(unverifiable+' logged actions lack a matching tenant CRM record; related completion counts exclude them.');
 if(badTimes)warnings.push(badTimes+' audit timestamps were invalid or outside the selected window.');
 if(truncated)warnings.push('The SQL audit query reached its 5,000-event display limit. Some actions might not be included.');
 warnings.push('Only server-recorded actions appear; this is not a screen or keystroke monitor.');
 warnings.push('Browser-only shift checklists are not counted as completed work or payroll evidence.');
 warnings.push('Saved leads are not automatically verified, qualified or approved for outbound calling.');
 return {ok:true,readOnly:true,modelCreditsUsed:0,generatedAt:new Date(end).toISOString(),
  window:{hours:span,since:new Date(start).toISOString(),until:new Date(end).toISOString(),timeZone:'America/New_York'},
  source:'TENANT_MYSQL_AUDIT_AND_CRM_PLUS_RECORDED_CLOCK',totals,employees:people,
  timeline:timeline.slice(0,100),unverifiableEvents:unverifiable,truncated:Boolean(truncated),warnings};
}
module.exports={eligibleUsers,summarize,classify};
