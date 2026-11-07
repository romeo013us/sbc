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
   ['clockin',2,'Clock in and confirm assignments','Log your actual start time and check the research focus. The time clock, not this plan, tracks payable hours.','clock'],
   ['triage',5,'Review real, assigned corrections','Review only valid research records that SBC returned; unusable binary imports stay in the owner CRM for cleanup.','queue'],
   ['research1',70,'Lead research — focused block 1','Find South Florida businesses with verifiable public contact details and record the original research source.','add'],
   ['quality1',5,'Quick lead quality check','Confirm saved entries and source accuracy; remove duplicates from drafts, never delete CRM records.','mine'],
   ['research2',75,'Lead research — focused block 2','Continue finding and submitting unique, complete businesses. Accuracy comes before a numeric quota.','add'],
   ['repair',6,'Correct legitimate verification exceptions','Recheck only real records returned to you; resubmit corrections for automated verification.','queue'],
   ['research3',70,'Lead research — focused block 3','Use the remaining focus period to research, validate and save additional qualified South Florida leads.','add'],
   ['handoff',5,'Summarize research and owner handoff','Check today’s saves, flag blockers to the owner and note where the next research session starts.','mine'],
   ['clockout',2,'Clock out and finish the shift','Review official time-clock status and record your actual clock-out.','clock']
  ],
  sales:[
   ['triage',10,'Review assigned callbacks and Do Not Call requests','Check your assigned leads, scheduled callbacks, and priority owner notes before starting calls.','queue'],
   ['callbacks',20,'Return scheduled callbacks','Call only assigned, authorized leads and record callback outcomes.','queue'],
   ['outreach1',80,'Outbound calling — focused block 1','Use approved bilingual scripts, respect DNC decisions, and save accurate call notes.','call'],
   ['logging',10,'Call notes and lead follow-up checks','Verify completed dispositions and requested callback times were saved.','call'],
   ['outreach2',80,'Outbound calling — focused block 2','Continue approved calls from your own assigned lead list. Route interested prospects to the SBC owner.','call'],
   ['followups',20,'High-intent follow-ups','Confirm appointments and owner handoffs; do not create quotes or collect payments without authorization.','queue'],
   ['cleanup',10,'Verify daily results','Recheck missing call reports, bounced contacts, and tomorrow’s scheduled callbacks.','call'],
   ['handoff',10,'Shift handoff and time clock','Record outcomes and unresolved requests, then complete your official clock-out.','time']
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
 function shiftMinutes(role,options){
  if(kind(role)!=='sales')return 240;
  return options&&Number(options.minutes)===360?360:240;
 }
 function template(role,options){
  var type=kind(role),rows=TEMPLATES[type].map(function(x){return {id:x[0],minutes:x[1],title:x[2],detail:x[3],tab:x[4]};});
  if(type==='sales'&&shiftMinutes(role,options)===360){
   var handoff=rows.pop();
   rows.push({id:'outreach3',minutes:60,title:'Additional outbound calling — focused block 3',detail:'Continue assigned prospect calling. Complete call notes and honor every opt-out immediately.',tab:'call'});
   rows.push({id:'outreach4',minutes:60,title:'Additional outreach and scheduled follow-ups',detail:'Continue prospect calls and priority callbacks within permitted calling hours; submit owner handoffs.',tab:'call'});
   rows.push(handoff);
  }
  return rows;
 }
 function totalMinutes(role,options){return template(role,options).reduce(function(a,t){return a+t.minutes;},0);}
 function easternDay(date){
  var d=date instanceof Date?date:new Date(date||Date.now());
  if(!Number.isFinite(d.valueOf()))d=new Date();
  var parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  var map={};parts.forEach(function(p){map[p.type]=p.value;});
  return map.year+'-'+map.month+'-'+map.day;
 }
 function schedule(role,anchor,now,options){
  var start=anchor?new Date(anchor):null;
  if(start&&!Number.isFinite(start.valueOf()))start=null;
  var current=now?new Date(now):new Date();
  if(!Number.isFinite(current.valueOf()))current=new Date();
  var passed=start?(current-start)/60000:null,offset=0;
  var rows=template(role,options).map(function(task){
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
 return {template:template,kind:kind,totalMinutes:totalMinutes,shiftMinutes:shiftMinutes,schedule:schedule,easternDay:easternDay,key:key,read:read,write:write};
});
