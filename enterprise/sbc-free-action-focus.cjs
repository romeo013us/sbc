'use strict';
/**
 * Super SBC free action focus: deterministic read-only suggestions over rows
 * already authorized by the authenticated CRM route. No AI, timers, network,
 * database writes, payment operations, automatic SMS/email or publishing.
 */
const ID=/^[A-Za-z0-9_.:-]{3,80}$/;
const SUPPRESSED=/^(?:do not call|do not contact|dnc|opt out|unsubscribe|bad number|wrong number|lost)$/i;
const CLOSED=/^(?:deleted|archived|duplicate)$/i;
const MS_DAY=86400000;
const clean=(v,n)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
function easternToday(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const field=name=>parts.find(p=>p.type===name)?.value;
 return field('year')+'-'+field('month')+'-'+field('day');
}
function parseDay(v){
 if(v===undefined||v===null||v==='')return '';
 if(v instanceof Date&&!Number.isFinite(v.getTime()))return null;
 const raw=v instanceof Date?v.toISOString():String(v).trim();
 const day=raw.slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return null;
 const parsed=new Date(day+'T12:00:00.000Z');
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==day)return null;
 return day;
}
const dayValue=day=>Date.parse(day+'T12:00:00.000Z');
// Validate source text before presentation cleanup. Never turn corrupted import
// bytes into a credible-looking name, and never modify authoritative CRM data.
function displayName(raw){
 let value;
 if(Buffer.isBuffer(raw)){
  try{value=new TextDecoder('utf-8',{fatal:true}).decode(raw)}
  catch{return {name:'Business name needs verification',needsReview:true}}
 }else if(typeof raw==='string')value=raw;
 else value=raw==null?'':String(raw);
 const invalid=/[\u0000-\u001f\u007f-\u009f\ufffd\u202a-\u202e\u2066-\u2069]/u.test(value);
 const trimmed=value.trim();
 if(invalid||!trimmed||!/[\p{L}\p{N}]/u.test(trimmed))
  return {name:'Business name needs verification',needsReview:true};
 return {name:clean(trimmed,160),needsReview:false};
}
// These categories represent *one review queue* each, not 500 urgent tasks.
const BATCHES={
 ASSIGN_MANAGER:{code:'UNASSIGNED_QUEUE_REVIEW',title:'Review unassigned accounts',businessName:'Unassigned accounts',
   detail:'Review unassigned CRM records; verify each business and assign only suitable accounts. No automatic outreach.',priority:3},
 QUALIFY_LEAD:{code:'QUALIFICATION_QUEUE_REVIEW',title:'Review lead qualification queue',businessName:'Assigned prospects',
   detail:'Review research and customer needs before outreach. No automatic messages are sent.',priority:6},
 SCHEDULE_NEXT_STEP:{code:'FOLLOW_UP_PLANNING_QUEUE',title:'Plan account follow-ups',businessName:'Accounts requiring planning',
   detail:'Review account history and set next touchpoints in the existing CRM.',priority:7}
};
function planActions({tenantId,actor,rows,today=easternToday(),limit=12}={}){
 const tid=Number(tenantId);
 if(!Number.isSafeInteger(tid)||tid<1)throw Error('VALID_TENANT_REQUIRED');
 if(!actor||!ID.test(String(actor.id||''))||!['owner','account_manager'].includes(actor.role)||actor.active===false)
   throw Error('ACTION_ACCESS_DENIED');
 if(!Array.isArray(rows))throw Error('AUTHORITATIVE_CUSTOMERS_REQUIRED');
 const todayDay=parseDay(today);
 if(!todayDay)throw Error('VALID_BUSINESS_DAY_REQUIRED');
 const max=Number(limit);
 if(!Number.isSafeInteger(max)||max<1||max>30)throw Error('ACTION_LIMIT_INVALID');
 const result=[],queueCounts={};
 let dataQualityCount=0;
 for(const r of rows){
   // A malformed or cross-tenant result is a security event, NOT a count of zero.
   if(!r||Number(r.tenant_id??r.tenantId)!==tid)throw Error('CROSS_TENANT_CUSTOMER_RESULT');
   if(!ID.test(String(r.id||'')))throw Error('INVALID_CUSTOMER_ID');
   const assigned=String(r.assigned_to??r.assignedTo??'');
   if(actor.role==='account_manager'&&assigned!==String(actor.id))continue;
   const status=clean(r.status,70),name=displayName(r.business_name??r.businessName);
   const businessName=name.name;
   if(CLOSED.test(status))continue;
   if(name.needsReview)dataQualityCount++;
   const blocked=SUPPRESSED.test(status);
   const due=parseDay(r.follow_up??r.followUp);
   const diff=due?Math.round((dayValue(due)-dayValue(todayDay))/MS_DAY):null;
   let code,priority,title,detail;
   if(blocked){
     code='CONTACT_RESTRICTION_REVIEW';priority=2;title='Review contact restriction';
     detail='Internal review only. Do not call, text, email, or schedule outreach.';
   }else if(name.needsReview){
     code='VERIFY_BUSINESS_NAME';priority=1;title='Verify business name';
     detail='CRM source business name contains unreadable or missing characters. Verify source data before assignment or outreach.';
   }else if(due===null){
     code='FOLLOW_UP_DATE_REVIEW';priority=1;title='Correct follow-up date';
     detail='CRM follow-up date is invalid. Review the account before scheduling.';
   }else if(due&&diff<=0){
     code='FOLLOW_UP_DUE';priority=0;title=diff<0?'Overdue follow-up':'Follow-up due today';
     detail='Open the account and check consent, contact permissions, and prior history before any outreach.';
   }else if(actor.role==='owner'&&!assigned){
     code='ASSIGN_MANAGER';priority=3;title='Assign an account manager';
     detail='Unassigned account needs an owner-reviewed relationship assignment.';
   }else if(due&&diff<=7){
     code='FOLLOW_UP_UPCOMING';priority=4;title='Upcoming account follow-up';
     detail='Review the upcoming date and prepare a customer-specific next step.';
   }else if(!clean(r.phone,50)){
     code='VERIFY_CONTACT';priority=5;title='Verify contact information';
     detail='Contact information is incomplete. Research the existing record; do not invent a number.';
   }else if(/^(lead|prospect|new)$/i.test(status)){
     code='QUALIFY_LEAD';priority=6;title='Qualify existing lead';
     detail='Review the research checklist, website opportunity, and contact restrictions.';
   }else if(!due){
     code='SCHEDULE_NEXT_STEP';priority=7;title='Plan the next account touchpoint';
     detail='Set a realistic follow-up date using the existing account tools.';
   }else continue;
   if(BATCHES[code]){
     const key=BATCHES[code].code;
     queueCounts[key]=(queueCounts[key]||0)+1;
     continue;
   }
   result.push({key:tid+':'+r.id+':'+code,accountId:String(r.id),businessName,
      code,priority,title,detail,dueDate:due||null,readOnly:true});
 }
 for(const meta of Object.values(BATCHES)){
   const n=queueCounts[meta.code]||0;
   if(!n)continue;
   result.push({key:tid+':queue:'+meta.code,accountId:null,businessName:meta.businessName,
     code:meta.code,priority:meta.priority,title:meta.title,detail:meta.detail,
     dueDate:null,readOnly:true,batchCount:n});
 }
 result.sort((a,b)=>a.priority-b.priority||
   String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999'))||
   a.businessName.localeCompare(b.businessName)||String(a.accountId||'').localeCompare(String(b.accountId||'')));
 const counts={};for(const a of result)counts[a.code]=(counts[a.code]||0)+1;
 // Project distinct working queues from the same authorized sample. A large
 // backlog in one lane must never hide the remaining lanes.
 const groups=[
  {id:'commitments',match:a=>a.priority===0},
  {id:'review',match:a=>[1,2,5].includes(a.priority)},
  {id:'upcoming',match:a=>a.priority===4},
  {id:'pipeline',match:a=>[3,6,7].includes(a.priority)}
 ];
 const lanes=groups.map(g=>{
  const list=result.filter(g.match);
  return {id:g.id,decisionCount:list.length,recordCount:list.reduce((n,a)=>n+(a.batchCount||1),0),
    actions:list.slice(0,max),moreDecisions:list.length>max};
 });
 return {ok:true,readOnly:true,requiresAi:false,messagesSent:0,actionsExecuted:0,
   billingOrPaymentsChanged:false,source:'AUTHORITATIVE_CRM_MYSQL',
   generatedFor:actor.role,businessDay:todayDay,total:result.length,counts,queueCounts,dataQualityCount,
   actions:result.slice(0,max),lanes};
}
module.exports={planActions,easternToday,parseDay};
