'use strict';
/* SBC V66.128: free, deterministic owner shift recap. Never writes, charges,
 * dials, verifies a prospect, credits payroll, or asks an AI model.
 * The caller must supply tenant-scoped SQL-confirmed CRM rows and audit events.
 */
const BAD=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFD]|(?:PK\x03\x04)|(?:xl\/(?:styles|workbook)\.xml)|(?:\[Content_Types\]\.xml)/u;
const ts=x=>{const n=new Date(x).getTime();return Number.isFinite(n)?n:null;};
const name=(v,fallback='Unidentified employee')=>{
 const s=String(v??'').trim();
 return s&&!BAD.test(s)?s.slice(0,90):fallback;
};
const meta=v=>{if(v&&typeof v==='object'&&!Array.isArray(v))return v;if(typeof v==='string'){try{const x=JSON.parse(v);return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}catch{}}return {}};
const TYPES=Object.freeze({
 workforce_lead_created:'Lead saved to CRM',
 call_report:'Call report logged',
 lead_updated:'Lead edited',
 lead_verification_update:'Lead verification updated',
 website_demo:'Website demo updated'
});
const employeeRoles=new Set(['lead_researcher','researcher','prospector','lead_generator','caller','sales','sales_rep','sales_agent','sales_manager','sales_account_manager','account_manager','fulfillment','support','manager','employee','admin']);
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
 const employees=eligibleUsers(users,t);
 const person=new Map(employees.map(u=>[String(u.id),{id:String(u.id),name:name(u.name||u.username),role:String(u.role||'employee'),
   leadsSaved:0,researchComplete:0,callReports:0,leadUpdates:0,demosUpdated:0,activity:[],lastShift:null,
   latestActivityAt:null,unverifiedLeadEvents:0}]));
 const crm=new Map(crmRows.filter(c=>Number(c.tenant_id??c.tenantId)===t)
   .map(c=>[String(c.id),{id:String(c.id),businessName:name(c.business_name??c.businessName,'CRM name unreadable') }]));
 const byEvent=new Set(),byLead=new Set(),timeline=[];let unverifiable=0,invalid=0;
 for(const e of [...events].sort((a,b)=>(ts(b.created_at??b.createdAt)??0)-(ts(a.created_at??a.createdAt)??0))){
  const userId=String(e.user_id??e.userId??''),employee=person.get(userId);
  if(!employee)continue;
  const at=ts(e.created_at??e.createdAt);
  if(at===null||at<start||at>end){invalid++;continue;}
  const kind=String(e.event_type??e.eventType??''),id=String(e.id||'');
  if(!Object.hasOwn(TYPES,kind)||!id||byEvent.has(id))continue;
  byEvent.add(id);
  const m=meta(e.meta_json??e.meta),leadId=String(m.customerId||'');
  // Events referencing CRM records must match the caller's read-only
  // authoritative tenant SQL lookup. Otherwise do not claim completed work.
  const record=leadId?crm.get(leadId):null;
  if(!record){unverifiable++;if(kind==='workforce_lead_created')employee.unverifiedLeadEvents++;continue;}
  if(kind==='workforce_lead_created'){
    if(byLead.has(userId+':'+leadId))continue;
    byLead.add(userId+':'+leadId);
    employee.leadsSaved++;
    if(m.researchComplete===true)employee.researchComplete++;
  }else if(kind==='call_report')employee.callReports++;
  else if(kind==='lead_updated'||kind==='lead_verification_update')employee.leadUpdates++;
  else if(kind==='website_demo')employee.demosUpdated++;
  const item={employeeId:userId,employee:employee.name,type:kind,label:TYPES[kind],
    businessName:record.businessName,customerId:record.id,at:new Date(at).toISOString()};
  timeline.push(item);
  employee.activity.push(item);
  employee.latestActivityAt=employee.latestActivityAt||item.at;
 }
 const minShiftTime=end-7*86400000;
 for(const s of Array.isArray(shiftEntries)?shiftEntries:[]){
  const employee=person.get(String(s?.userId||'')),started=ts(s?.clockIn);
  if(!employee||started===null||started<minShiftTime||started>end)continue;
  const finished=ts(s?.clockOut),endAt=finished!==null&&finished>=started&&finished<=end?finished:null;
  const current=employee.lastShift;
  if(!current||started>ts(current.clockIn)){
   employee.lastShift={clockIn:new Date(started).toISOString(),clockOut:endAt===null?null:new Date(endAt).toISOString(),
    status:endAt===null?'CLOCKED_IN_OR_MISSING_OUT':'CLOCKED_OUT',
    minutes:endAt===null?null:Math.round((endAt-started)/60000),
    mode:String(s.mode||'').slice(0,40)};
  }
 }
 const people=[...person.values()].sort((a,b)=>a.name.localeCompare(b.name));
 const totals=people.reduce((a,p)=>({leadsSaved:a.leadsSaved+p.leadsSaved,researchComplete:a.researchComplete+p.researchComplete,
  callReports:a.callReports+p.callReports,leadUpdates:a.leadUpdates+p.leadUpdates,demosUpdated:a.demosUpdated+p.demosUpdated}),{leadsSaved:0,researchComplete:0,callReports:0,leadUpdates:0,demosUpdated:0});
 const warnings=[];
 if(!people.length)warnings.push('No tenant-scoped staff accounts available; no employee productivity inferred.');
 if(unverifiable)warnings.push(unverifiable+' audit events could not be matched to existing CRM records in this tenant; excluded from totals.');
 if(invalid)warnings.push(invalid+' staff audit timestamps were outside the selected window or invalid.');
 if(truncated)warnings.push('Audit query limit reached; totals may be incomplete.');
 warnings.push('Shift times come from recorded clock entries; local browser checklists are not certified task completions.');
 warnings.push('Saved leads are not automatically qualified, callable or sales-ready.');
 return {ok:true,readOnly:true,modelCreditsUsed:0,generatedAt:new Date(end).toISOString(),
  window:{hours:span,since:new Date(start).toISOString(),until:new Date(end).toISOString(),timeZone:'America/New_York'},
  source:'TENANT_MYSQL_AUDIT_AND_CRM_PLUS_RECORDED_CLOCK',totals,employees:people,
  timeline:timeline.slice(0,40),unverifiableEvents:unverifiable,truncated:Boolean(truncated),warnings};
}
module.exports={eligibleUsers,summarize};
