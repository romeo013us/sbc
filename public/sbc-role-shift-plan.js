/* SBC Role Shift Plan — deterministic display/checklist helper.
 * Does not write to CRM, payroll, time clock or server audit logs.
 * Completion is local to this browser and must not count as verified production.
 */
(function(root,factory){
 'use strict';
 var api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SBCRoleShiftPlan=api;
})(typeof window!=='undefined'?window:{},function(){
 'use strict';
 var TEMPLATES={
  lead_researcher:[
   ['triage',15,'Review corrections and urgent notices','Open returned leads first. Read correction reasons and any owner alerts; do not modify unverified records blindly.','queue'],
   ['repair',30,'Rework flagged submissions','Use original sources to correct returned records; resubmit only when fields are accurate.','queue'],
   ['research1',60,'Research new local prospects','Find and document businesses, owner names when verified, contact methods and source URLs.','add'],
   ['quality1',15,'Quality and duplicate check','Review saved and pending leads, verify contact formats, remove guesswork and check duplicates.','mine'],
   ['research2',60,'Second focused research block','Continue verified lead research for the daily target; do not submit fabricated information.','add'],
   ['submit',30,'Submit and verify persistence','Submit individually or carefully import valid rows. Confirm each accepted CRM record and note failures.','import'],
   ['review',20,'Review exceptions and finish training','Handle fresh returned leads and review a short lesson if the queue is clear.','queue'],
   ['handoff',10,'Shift handoff and follow-up','Document remaining blockers and next steps; check that time clock and saved submissions are accurate.','mine']
  ],
  sales:[
   ['triage',15,'Review callbacks and urgent follow-ups','Start with scheduled calls, customer requests, open opportunities and owner notices.','queue'],
   ['callbacks',30,'Return priority calls','Complete scheduled callbacks and log outcomes and agreed next actions.','queue'],
   ['outreach',60,'Prospect outreach block','Call permitted, researched leads and use approved scripts and calling controls.','mine'],
   ['logging',15,'Update CRM call outcomes','Record disposition, notes, and follow-up dates; avoid duplicate contacts.','mine'],
   ['followups',60,'Appointments and warm opportunities','Work highest-intent prospects, confirm next steps and schedule appointments.','mine'],
   ['proposals',30,'Prepare quotes and reviewed offers','Prepare accurate package recommendations and route price exceptions for approval.','mine'],
   ['cleanup',20,'Review replies and pending tasks','Return urgent messages, address owner requests and prepare next-day follow-ups.','queue'],
   ['handoff',10,'Sales shift handoff','Log results, outstanding opportunities and action items; close out your shift.','mine']
  ],
  general:[
   ['triage',15,'Review priority assignments','Start with unresolved owner-assigned items and urgent notices.','queue'],
   ['focus1',45,'Complete assigned work block one','Use your role workspace to complete high-priority work.','today'],
   ['focus2',60,'Complete assigned work block two','Continue core responsibilities with accurate records.','today'],
   ['quality',15,'Quality and progress check','Verify completed work and identify anything requiring attention.','today'],
   ['focus3',60,'Complete assigned work block three','Finish planned role-specific work.','today'],
   ['handoff',30,'Follow-ups and team handoff','Document pending items and request necessary decisions.','today'],
   ['wrap',15,'Wrap up and clock status','Finalize your checklist and check recorded time.','clock']
  ]
 };
 function kind(role){
  var r=String(role||'').trim().toLowerCase();
  if(['lead_researcher','researcher','lead_generator','prospector'].includes(r))return 'lead_researcher';
  if(['sales','sales_rep','sales_agent','salesperson','sales_manager','caller','account_manager'].includes(r))return 'sales';
  return 'general';
 }
 function template(role){return TEMPLATES[kind(role)].map(function(x){return {id:x[0],minutes:x[1],title:x[2],detail:x[3],tab:x[4]};});}
 function totalMinutes(role){return template(role).reduce(function(a,t){return a+t.minutes;},0);}
 function easternDay(date){
  var d=date instanceof Date?date:new Date(date||Date.now());
  if(!Number.isFinite(d.valueOf()))d=new Date();
  var parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  var map={};parts.forEach(function(p){map[p.type]=p.value;});
  return map.year+'-'+map.month+'-'+map.day;
 }
 function schedule(role,anchor,now){
  var start=anchor?new Date(anchor):null;
  if(start&&!Number.isFinite(start.valueOf()))start=null;
  var current=now?new Date(now):new Date();
  if(!Number.isFinite(current.valueOf()))current=new Date();
  var passed=start?(current-start)/60000:null,offset=0;
  var rows=template(role).map(function(task){
   var a=offset,b=a+task.minutes;offset=b;
   var state=passed===null?'not-clocked-in':passed<a?'upcoming':passed<b?'current':'elapsed';
   return Object.assign({},task,{startOffset:a,endOffset:b,status:state,startAt:start?new Date(start.valueOf()+a*60000).toISOString():null,endAt:start?new Date(start.valueOf()+b*60000).toISOString():null});
  });
  return {role:kind(role),startAt:start?start.toISOString():null,totalMinutes:offset,items:rows,elapsedMinutes:passed===null?null:Math.max(0,Math.floor(passed))};
 }
 function identity(user){
  var val=String(user&& (user.id||user.username||user.name) ||'').trim().toLowerCase();
  if(!val)return 'unidentified';
  var h=2166136261;
  for(var i=0;i<val.length;i++){h^=val.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(16);
 }
 function key(user,role,date){
  return 'sbc-shift-checklist-v1:'+identity(user)+':'+kind(role)+':'+String(date||easternDay());
 }
 function read(storage,user,role,date){
  try{
   var raw=storage&&storage.getItem(key(user,role,date));
   var parsed=raw?JSON.parse(raw):{};
   var allowed=new Set(template(role).map(function(x){return x.id;}));
   return Object.keys(parsed||{}).filter(function(id){return parsed[id]===true&&allowed.has(id);});
  }catch(_){return [];}
 }
 function write(storage,user,role,date,taskId,completed){
  if(!template(role).some(function(x){return x.id===taskId;}))return false;
  try{
   if(!storage||typeof storage.setItem!=='function')return false;
   var done=new Set(read(storage,user,role,date));
   if(completed)done.add(taskId);else done.delete(taskId);
   var data={};done.forEach(function(id){data[id]=true;});
   storage.setItem(key(user,role,date),JSON.stringify(data));
   return true;
  }catch(_){return false;}
 }
 return {template:template,kind:kind,totalMinutes:totalMinutes,schedule:schedule,easternDay:easternDay,key:key,read:read,write:write};
});
