/* SBC Lead Research Workspace: isolated, server-authorized and fail-closed. */
(function(){
'use strict';
var roles=['lead_researcher','researcher','lead_generator','prospector'];
var user=null,leads=null,train=null,clock=null,loadedAt=null,busy=false,active='home',importBatch=null,importRunning=false,submittedIds=null,dailyAccepted=null,autoVerifiedToday=null,needsReviewToday=null,pendingAutoToday=null,leadsLoadFailed=false,progressLoadFailed=false;
var $=function(id){return document.getElementById(id);};
var txt=function(id,value){var el=$(id);if(el)el.textContent=String(value);};
function note(message,bad){var el=$('notice');el.hidden=false;el.classList.toggle('danger',!!bad);el.textContent=String(message);}
function clearNote(){var el=$('notice');el.hidden=true;el.textContent='';}
function element(tag,cl,text){var el=document.createElement(tag);if(cl)el.className=cl;if(text!==undefined)el.textContent=String(text);return el;}
function empty(container,message){container.replaceChildren(element('p','muted',message));}
function hasRole(r){return roles.includes(String(r||'').toLowerCase());}
function errorMessage(err){return String(err&&err.message||'Request failed.').slice(0,300);}
async function api(path,opts){
 var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},18000);
 try{
  var options=Object.assign({credentials:'same-origin',cache:'no-store',headers:{'Accept':'application/json'}},opts||{});
  if(options.body){options.headers=Object.assign({},options.headers,{'Content-Type':'application/json'});}
  options.signal=controller.signal;
  var response=await fetch(path,options),payload={};
  try{payload=await response.json();}catch(_){throw Error('SBC returned an invalid response.');}
  if(!response.ok){var problem=Error(response.status===401?'Your session expired. Sign in again.':(payload.error||payload.message||('SBC request failed: '+response.status)));problem.status=response.status;problem.code=payload.code;problem.duplicate=payload.duplicate===true;throw problem;}
  return payload;
 }catch(e){if(e.name==='AbortError')throw Error('SBC did not respond before the connection timeout.');throw e;}
 finally{clearTimeout(timer);}
}
function setTab(tab){
 if(!['home','today','queue','add','import','mine','training','clock'].includes(tab))return;
 if(importRunning&&tab!=='import'){note('Bulk import is running. Finish the current batch before changing workspaces.',true);return;}
 active=tab;
 document.querySelectorAll('[data-pane]').forEach(function(el){el.hidden=el.getAttribute('data-pane')!==tab;});
 document.querySelectorAll('[data-tab]').forEach(function(el){el.classList.toggle('active',el.getAttribute('data-tab')===tab);});
 var titles={home:'My Dashboard',today:'Today’s Tasks',queue:'Needs Attention',add:'Add Business Lead',import:'CSV & List Import',mine:'My Submitted Leads',training:'My Training',clock:'Time Clock'};
 txt('page-title',titles[tab]);clearNote();
 if(tab==='training'&&!train)loadTraining();
 if(tab==='clock'&&!clock)loadClock();
 if(tab==='today'){renderDailyPlan();renderShiftPlan();}
}
function leadAutomationStatus(c){
 var state=String(c?.leadAssistStatus||'NOT_CHECKED');
 if(state==='AUTO_VERIFIED')return 'SBC auto-verified';
 if(state==='NEEDS_HUMAN_REVIEW'||state==='FAILED')return 'Needs more information';
 if(state==='QUEUED'||state==='PROCESSING')return 'SBC checking automatically';
 if(String(c?.verificationStatus||'')==='Owner Review')return 'Owner review';
 return 'Awaiting SBC checks';
}
function suspiciousResearchText(c){
 return [c?.businessName,c?.contactName,c?.phone,c?.email].some(function(value){
  var text=String(value||'');
  return /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\ufffd]/.test(text)||/xl\/(?:workbook|styles)\.xml|\[Content_Types\]\.xml/i.test(text);
 });
}
function isException(c){
 return ['NEEDS_HUMAN_REVIEW','FAILED','REWORK_REQUIRED','RETURNED_FOR_CORRECTION'].includes(String(c?.leadAssistStatus||''))||
  ['Owner Review','Needs Correction','Rework Required'].includes(String(c?.verificationStatus||''))||suspiciousResearchText(c);
}
function correctionReason(c){
 if(suspiciousResearchText(c))return 'Unreadable spreadsheet or corrupted data. Recheck the original research source.';
 var reason=c?.reworkReason||c?.leadAssistReason||c?.verificationReason||c?.leadAssistMessage;
 return String(reason||'SBC requested a correction or additional verification.').slice(0,280);
}
function myAttentionRecords(){
 if(!Array.isArray(leads)||!(submittedIds instanceof Set)||leadsLoadFailed||progressLoadFailed)return null;
 return leads.filter(function(c){return submittedIds.has(String(c.id))&&isException(c);});
}
function updatePriorityIndicator(){
 var pending=myAttentionRecords(),panel=$('attention-priority'),nav=$('[data-tab="queue"]'),count=$('queue-nav-count');
 if(!panel||!nav||!count)return;
 var unknown=pending===null,failed=leadsLoadFailed||progressLoadFailed,num=unknown?null:pending.length;
 panel.hidden=(!failed&&(unknown||num===0));
 panel.classList.toggle('attention-unknown',unknown);
 nav.classList.toggle('queue-has-items',unknown?failed:num>0);
 count.hidden=unknown?!failed:num===0;
 count.textContent=unknown?'!':String(num);
 count.setAttribute('aria-label',unknown?'Correction count unavailable':num+' unresolved lead corrections');
 txt('attention-priority-title',unknown?'Correction status cannot be verified':num+' lead'+(num===1?'':'s')+' returned for correction');
 txt('attention-priority-detail',unknown?'The research queue could not be verified. Check Needs Attention before submitting new leads.':
  'These are your SBC research records requiring correction. Review the reason, confirm the source, and resubmit for verification.');
}
function prioritizeAttention(forceHomeIfClear){
 var pending=myAttentionRecords();
 if(pending===null&&(leadsLoadFailed||progressLoadFailed)||pending&&pending.length)setTab('queue');
 else if(forceHomeIfClear)setTab('today');
}
// SBC_V6686_SECONDARY_PHONE: reuse the existing durable research-notes field.
// One tagged JSON line preserves phone + source without a schema migration or
// changing the canonical phone used by duplicate detection and calling.
var SBC_SECOND_PHONE_TAG='[SBC_ALT_PHONE_V1] ';
function splitSecondaryPhoneNotes(value){
 var other={phone:'',source:''},lines=[];
 String(value||'').split(/\r?\n/).forEach(function(line){
  if(line.indexOf(SBC_SECOND_PHONE_TAG)===0){
   try{
    var candidate=JSON.parse(line.slice(SBC_SECOND_PHONE_TAG.length));
    if(candidate&&typeof candidate.phone==='string'&&candidate.phone.trim()){
     other.phone=candidate.phone.trim().slice(0,80);
     other.source=String(candidate.source||'').trim().slice(0,120);
     return;
    }
   }catch(_){}
  }
  lines.push(line);
 });
 return {notes:lines.join('\n').trim(),phone:other.phone,source:other.source};
}
function composeSecondaryPhoneNotes(notes,phone,source,primary,maxLength){
 var clean=splitSecondaryPhoneNotes(notes).notes;
 var second=String(phone||'').trim(),origin=String(source||'').trim();
 if(second.length>80||origin.length>120)throw Error('The secondary phone or its source is too long.');
 if(origin&&!second)throw Error('Enter the additional phone number before its source.');
 if(second){
  var digits=second.replace(/\D/g,'');
  if(digits.length<7||digits.length>20)throw Error('Check the additional phone number before saving.');
  var firstDigits=String(primary||'').replace(/\D/g,'');
  if(firstDigits&&digits===firstDigits)throw Error('The additional number must differ from the primary phone.');
  clean+=(clean?'\n':'')+SBC_SECOND_PHONE_TAG+JSON.stringify({phone:second,source:origin});
 }
 if(clean.length>maxLength)throw Error('Research notes are full. Shorten your notes before adding another phone number.');
 return clean;
}
function secondaryPhoneLabel(lead){
 var extra=splitSecondaryPhoneNotes(lead?.notes);
 return extra.phone?'Secondary: '+extra.phone+(extra.source?' ('+extra.source+')':''):'';
}

function displayLead(c){
 var item=element('div','lead-row'+(isException(c)?' needs-correction':'')),left=element('div'),right=element('div');
 var own=Boolean(submittedIds&&submittedIds.has(String(c.id)));
 left.append(element('strong',null,c.businessName||'Unnamed business'));
 left.append(element('small',null,[c.city||c.address,c.industry,c.phone,secondaryPhoneLabel(c),c.email].filter(Boolean).join(' · ')||'Contact details pending'));
 if(isException(c))left.append(element('small','correction-reason','Reason: '+correctionReason(c)));
 right.append(element('span','pill',leadAutomationStatus(c)));
 var actionable=own&&isException(c);
 var button=element('button','outline',actionable?'Correct information':'View details');
 button.type='button';button.addEventListener('click',function(){openReview(item,c,actionable);});
 right.append(button);item.append(left,right);return item;
}
function openReview(item,lead,editable){
 document.querySelectorAll('.research-review').forEach(function(el){el.remove();});
 var form=element('div','research-review');
 form.append(element('h3',null,lead.businessName||'Lead details'));
 form.append(element('p','muted','Automation: '+leadAutomationStatus(lead)+(lead.leadAssistCheckedAt?' · Last check '+new Date(lead.leadAssistCheckedAt).toLocaleString():'')));
 form.append(element('p','muted','SBC handles verification. You only need to correct a record when its automatic check requests additional information.'));
 var otherPhone=splitSecondaryPhoneNotes(lead.notes);
 if(!editable){
  form.append(element('p',null,'Research source: '+String(lead.researchSource||lead.source||'Not recorded')));
  form.append(element('p',null,'Primary phone: '+String(lead.phone||'Not recorded')));
  form.append(element('p',null,'Secondary phone: '+(otherPhone.phone||'Not recorded')+(otherPhone.source?' · Source: '+otherPhone.source:'')));
  var close=element('button','outline','Close');close.type='button';close.onclick=function(){form.remove();};form.append(close);item.append(form);return;
 }
 var fields=element('div','fields');
 var editableFields=[
  ['Business name','businessName'],['Contact person','contactName'],
  ['Phone','phone'],['Secondary phone','secondaryPhone'],['Secondary phone source','secondaryPhoneSource'],['Email','email'],['Website','website'],
  ['Industry','industry'],['City','city'],['Research source','verificationSource']
 ];
 editableFields.forEach(function(pair){
  var label=element('label',null,pair[0]),input=element('input');input.name=pair[1];
  input.value=String(pair[1]==='secondaryPhone'?otherPhone.phone:pair[1]==='secondaryPhoneSource'?otherPhone.source:lead[pair[1]]||lead.researchSource&&pair[1]==='verificationSource'&&lead.researchSource||'').slice(0,500);
  input.maxLength=500;label.append(input);fields.append(label);
 });
 var notes=element('label','wide','Research notes'),textarea=element('textarea');
 textarea.name='notes';textarea.maxLength=3000;textarea.rows=3;textarea.value=otherPhone.notes.slice(0,3000);notes.append(textarea);fields.append(notes);
 var submitForm=element('form','research-correction'),actions=element('div','form-actions');
 var submit=element('button','primary','Save correction and recheck'),cancel=element('button','outline','Cancel');
 submit.type='submit';cancel.type='button';cancel.onclick=function(){form.remove();};
 actions.append(submit,cancel);submitForm.append(fields,actions);form.append(submitForm);
 submitForm.onsubmit=async function(event){
  event.preventDefault();submit.disabled=true;clearNote();
  var fd=new FormData(submitForm),data={};
  editableFields.forEach(function(pair){data[pair[1]]=String(fd.get(pair[1])||'').trim();});
  try{
   data.notes=composeSecondaryPhoneNotes(String(fd.get('notes')||'').trim(),data.secondaryPhone,data.secondaryPhoneSource,data.phone,3000);
   delete data.secondaryPhone;delete data.secondaryPhoneSource;
   await api('/api/v9/lead-verification/'+encodeURIComponent(String(lead.id)),{method:'POST',body:JSON.stringify(data)});
   note('Correction saved. SBC Lead Assist will automatically recheck the record.');
   form.remove();await Promise.allSettled([loadLeads(),loadProgress()]);
  }catch(e){note('Correction could not be saved: '+errorMessage(e),true);}
  finally{submit.disabled=false;}
 };
 item.append(form);
}
function drawLeads(){
 if(!leads)return;
 var q=$('queue-list'),m=$('mine-list'),filter=String($('search').value||'').trim().toLowerCase();
 if(!submittedIds){
  empty(q,'Loading your own SBC submissions and exception queue…');
  empty(m,'Loading your submission history…');
  ['metric-queue','metric-unverified','metric-mine'].forEach(function(id){txt(id,'—');});
  updatePriorityIndicator();
  return;
 }
 var own=leads.filter(function(c){return submittedIds.has(String(c.id));});
 var attention=own.filter(isException);
 var chosen=attention.filter(function(c){return [c.businessName,c.phone,secondaryPhoneLabel(c),c.email,c.city,c.address,c.industry].join(' ').toLowerCase().includes(filter);});
 q.replaceChildren();m.replaceChildren();
 if(!chosen.length)empty(q,filter?'No matching exceptions from your submissions.':'No records currently need your corrections. SBC automatically checks submitted leads.');
 else chosen.forEach(function(c){q.append(displayLead(c));});
 if(!own.length)empty(m,'No submitted leads currently visible in your active research CRM. Historical totals appear on your dashboard.');
 else own.forEach(function(c){m.append(displayLead(c));});
 txt('metric-queue',attention.length);
 txt('metric-unverified',own.filter(function(c){return ['QUEUED','PROCESSING','NOT_CHECKED'].includes(String(c.leadAssistStatus||'NOT_CHECKED'))&&!isException(c);}).length);
 txt('metric-mine',own.length);
 updatePriorityIndicator();
}
async function loadLeads(){
 var notice=$('queue-error');notice.hidden=true;
 try{
  var response=await api('/api/v9/lead-verification');
  if(!Array.isArray(response.leads))throw Error('CRM returned no valid research queue.');
  leads=response.leads;loadedAt=new Date();leadsLoadFailed=false;drawLeads();
  txt('sync-label','CRM synced '+loadedAt.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}));
 }catch(e){
  leadsLoadFailed=true;
  notice.hidden=false;notice.textContent='Research queue unavailable: '+errorMessage(e);
  txt('sync-label',leads?'CRM data may be stale':'CRM unavailable');
  if(!leads){txt('metric-queue','—');txt('metric-unverified','—');txt('metric-mine','—');empty($('queue-list'),'Unable to load your queue. No zero counts are being assumed.');empty($('mine-list'),'Unable to load your submissions.');}
  updatePriorityIndicator();
  throw e;
 }
}
async function loadProgress(){
 try{
  var result=await api('/api/workforce/research-progress');
  if(!result.ok||result.source!=='research-intake-audit'||!Number.isInteger(result.todayCount)||result.todayCount<0)
   throw Error('SBC research progress endpoint is outdated or returned invalid counts. Update the verified server release.');
  if(!Array.isArray(result.submittedLeadIds))throw Error('SBC did not return auditable submission IDs.');
  submittedIds=new Set(result.submittedLeadIds.map(String));progressLoadFailed=false;
  dailyAccepted=result.todayCount;
  autoVerifiedToday=Number.isInteger(result.autoVerifiedTodayCount)?result.autoVerifiedTodayCount:null;
  needsReviewToday=Number.isInteger(result.needsReviewTodayCount)?result.needsReviewTodayCount:null;
  pendingAutoToday=Number.isInteger(result.pendingAutoTodayCount)?result.pendingAutoTodayCount:null;
  if(leads)drawLeads();
  renderDailyPlan();
  txt('goal-current',dailyAccepted);
  txt('goal-seven',Number.isInteger(result.last7Count)?result.last7Count:'—');
  txt('goal-all',Number.isInteger(result.rawSavedAllTimeCount)?result.rawSavedAllTimeCount:'—');
  txt('goal-verified',autoVerifiedToday===null?'—':autoVerifiedToday);
  txt('goal-existing',needsReviewToday===null?'—':needsReviewToday);
  txt('goal-date',result.date+' · Eastern business day');
  txt('goal-status',(dailyAccepted>=20?'Stretch research target achieved!':dailyAccepted>=16?'Daily research target achieved — '+(20-dailyAccepted)+' to reach stretch.':(16-dailyAccepted)+' complete research submissions remain toward your target.')+
   (pendingAutoToday!==null?' · '+pendingAutoToday+' automatic checks pending':''));
  $('goal-fill').style.width=Math.min(100,Math.max(0,dailyAccepted/20*100))+'%';
  $('goal-track').setAttribute('aria-valuenow',String(Math.min(20,dailyAccepted)));
  $('goal-track').setAttribute('aria-valuetext',String(dailyAccepted)+' unique research-complete submissions out of 20 stretch target');
 }catch(e){
  ['goal-current','goal-seven','goal-all','goal-verified','goal-existing'].forEach(function(id){txt(id,'—');});
  dailyAccepted=null;autoVerifiedToday=null;needsReviewToday=null;pendingAutoToday=null;
  submittedIds=null;progressLoadFailed=true;drawLeads();renderDailyPlan();updatePriorityIndicator();
  txt('goal-status','Could not load research totals: '+errorMessage(e));
  $('goal-fill').style.width='0%';$('goal-track').removeAttribute('aria-valuenow');$('goal-track').setAttribute('aria-valuetext','SBC research totals unavailable');
 }
}


/* Display-only role scheduling. The MySQL time clock remains authoritative. */
function shiftStorage(){
 try{return window.localStorage;}catch(_){return null;}
}
function shiftAnchorKey(){
 var plan=window.SBCRoleShiftPlan;
 if(!plan||!user)return '';
 return 'sbc-clock-verified-shift-v1:'+plan.key(user,user.role,plan.easternDay(new Date()));
}
function rememberVerifiedClockIn(){
 var key=shiftAnchorKey(),value=clock?.open?.clockIn,storage=shiftStorage();
 if(!key||!value||!storage)return;
 var t=new Date(value);
 if(!Number.isFinite(t.valueOf()))return;
 try{
  var old=storage.getItem(key),oldTime=old&&new Date(old);
  // Preserve the earliest verified clock-in for this calendar day after breaks.
  if(!old||!Number.isFinite(oldTime.valueOf())||t<oldTime)storage.setItem(key,t.toISOString());
 }catch(_){}
}
function verifiedShiftAnchor(){
 var current=clock?.open?.clockIn,storage=shiftStorage(),key=shiftAnchorKey();
 try{
  var old=storage&&key?storage.getItem(key):null;
  var time=old&&Number.isFinite(new Date(old).valueOf())?new Date(old):null;
  var live=current&&Number.isFinite(new Date(current).valueOf())?new Date(current):null;
  return time&&live?(time<live?time:live):time||live||null;
 }catch(_){return current&&Number.isFinite(new Date(current).valueOf())?new Date(current):null;}
}
function renderShiftPlan(){
 var engine=window.SBCRoleShiftPlan,host=$('shift-task-list');
 if(!engine||!host||!user)return;
 var role=engine.kind(user.role),date=engine.easternDay(new Date()),anchor=verifiedShiftAnchor(),plan=engine.schedule(role,anchor),stored=new Set(engine.read(shiftStorage(),user,role,date));
 var done=plan.items.filter(function(task){return stored.has(task.id);}).length;
 txt('shift-progress',done+' of '+plan.items.length);
 var bar=$('shift-progress-track'),fill=$('shift-progress-fill'),percent=Math.round(done/plan.items.length*100);
 if(bar)bar.setAttribute('aria-valuenow',String(percent));
 if(fill)fill.style.width=percent+'%';
 var displayTime=function(timestamp){
  return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(timestamp))+' ET';
 };
 txt('shift-clock-label',anchor?'Scheduled from verified clock-in: '+displayTime(anchor)+'. Shift plan: '+plan.totalMinutes+' minutes.':'Clock in to activate timed tasks. Preview: '+plan.totalMinutes+' minutes · 4-hour shift.');
 host.replaceChildren();
 plan.items.forEach(function(task,i){
  var row=element('div','shift-task'+(task.status==='current'?' active':'')+(stored.has(task.id)?' done':''));
  var checkbox=element('input');checkbox.type='checkbox';checkbox.checked=stored.has(task.id);checkbox.setAttribute('aria-label','Mark '+task.title+' complete');
  var body=element('div'),name=element('div','shift-task-title',(i+1)+'. '+task.title);
  var range=task.startAt?displayTime(task.startAt)+' – '+displayTime(task.endAt):'Minute '+task.startOffset+' – '+task.endOffset+' from clock-in';
  var status=stored.has(task.id)?'Complete':task.status==='current'?'Current block':task.status==='elapsed'?'Time block elapsed':task.status==='upcoming'?'Upcoming':'Pending clock-in';
  body.append(name,element('div','shift-task-meta',range+' · '+task.minutes+' min'),element('div','shift-task-detail',task.detail),element('div','shift-task-status',status));
  var open=element('button','outline','Open workspace');open.type='button';open.onclick=function(){setTab(task.tab);};
  checkbox.onchange=function(){
   var ok=engine.write(shiftStorage(),user,role,date,task.id,checkbox.checked);
   if(!ok){checkbox.checked=!checkbox.checked;note('This browser cannot store task completion. Your CRM was not changed.',true);return;}
   renderShiftPlan();
  };
  row.append(checkbox,body,open);host.append(row);
 });
 var next=plan.items.find(function(task){return !stored.has(task.id)&&(task.status==='current'||task.status==='upcoming');})||
  plan.items.find(function(task){return !stored.has(task.id);});
 var home=$('shift-home');
 if(home){
  home.hidden=false;
  txt('shift-home-title',done===plan.items.length?'All shift checklist items marked complete':next?'Shift task: '+next.title:'Shift plan');
  txt('shift-home-detail',anchor?(done+' of '+plan.items.length+' checked · '+(next?'Next: '+next.minutes+' min · '+next.detail:'Review your clock status before ending the shift.')):
    'Clock in to start the schedule. '+done+' of '+plan.items.length+' checked today.');
 }
}

function easternDay(){
 var d=new Date(),zone='America/New_York';
 return {day:new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'long'}).format(d),
  date:new Intl.DateTimeFormat('en-US',{timeZone:zone,month:'short',day:'numeric',year:'numeric'}).format(d),
  key:new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)};
}
function trainedToday(){
 if(!train||!Array.isArray(train.progress))return null;
 var date=easternDay().key,fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
 return train.progress.filter(function(p){
  if(!['completed','passed'].includes(p.status)||!p.completedAt)return false;
  var when=new Date(p.completedAt);
  return !Number.isNaN(when.valueOf())&&fmt.format(when)===date;
 }).length;
}
function renderDailyPlan(){
 var list=$('daily-task-list');if(!list)return;
 var et=easternDay(),themes={Monday:'barbers and beauty businesses',Tuesday:'restaurants and cafés',Wednesday:'auto services and repair shops',Thursday:'local retail stores',Friday:'professional and home services',Saturday:'quality checks and existing lead cleanup',Sunday:'prepare next week’s research queue'},
  focus=themes[et.day]||'local small businesses';
 txt('daily-focus-title','Research new '+focus);
 txt('daily-overview',et.day+' · '+et.date+' ET · Find prospects, document sources, submit, and let SBC verify.');
 txt('daily-plan-date',et.day+', '+et.date+' · Suggested research focus: '+focus+'. Priorities follow the Eastern business day.');
 var training=trainedToday();
 var items=[
  {number:'01',label:'Find new business prospects',detail:'Research '+focus+'. Collect real business names and usable public contact details. Verify the source of what you enter, not a second approval status.',tab:'add',action:'Submit researched lead',stat:dailyAccepted===null?'CRM total unavailable':dailyAccepted+' research-complete leads submitted today'},
  {number:'02',label:'Add complete researched lists',detail:'Use CSV or paste to add multiple businesses when you have reliable contact details and a source for each. A raw list of names alone does not count toward the research goal.',tab:'import',action:'Open CSV & list import',stat:'Preview, reject duplicates, and confirm each CRM save'},
  {number:'03',label:'Handle only automatic-verification exceptions',detail:'SBC Lead Assist automatically checks submitted leads. Only correct your own records when SBC specifically flags missing or conflicting information. Do not review all existing CRM leads.',tab:'queue',action:'View my exceptions',stat:needsReviewToday===null?'SBC checks loading…':needsReviewToday+' of today’s research submissions need follow-up'},
  {number:'04',label:'Finish a short Academy lesson',detail:'Use a short training block to improve research accuracy. Open and read the actual lesson before saving progress; do not treat training as extra lead quota.',tab:'training',action:'Open training reader',stat:training===null?'Training progress unavailable':training+' Academy lesson'+(training===1?'':'s')+' completed today'},
  {number:'05',label:'Reach your 16–20 research goal and hand off',detail:'Finish with 16 complete, unique submissions (20 stretch). Review your work, note any unresolved exceptions and sign out. Automatic verification runs independently; its delays do not reduce your submitted-work count.',tab:'mine',action:'My leads & status',stat:dailyAccepted===null?'CRM goal unavailable':dailyAccepted>=16?'Daily research goal reached':(16-dailyAccepted)+' complete submissions remain to the base goal'}
 ];
 list.replaceChildren();
 items.forEach(function(item){
  var row=element('div','daily-task-row'),number=element('div','daily-task-number',item.number),body=element('div','daily-task-body');
  body.append(element('strong',null,item.label),element('p',null,item.detail),element('small',null,item.stat));
  var button=element('button','outline',item.action);button.type='button';button.onclick=function(){setTab(item.tab);};
  row.append(number,body,button);list.append(row);
 });
}

function trainingParagraph(parent,label,value){
 if(!value)return;
 var section=element('section','lesson-part');
 if(label)section.append(element('h4',null,label));
 section.append(element('p',null,value));
 parent.append(section);
}
function lessonContent(parent,mod,courseId,status){
 var reader=window.SBCResearchLessonReader;
 if(!reader||typeof reader.normalize!=='function'){
  empty(parent,'Training lesson reader is unavailable. Refresh the page; completion is disabled until content loads.');return;
 }
 var lesson=reader.normalize(mod);
 if(!lesson.hasReadableContent){
  empty(parent,'This lesson has no readable course material. Contact your SBC manager. Completion is disabled.');return;
 }
 var meta=element('p','muted','Estimated lesson time: '+lesson.minutes+' minutes');
 parent.append(meta);
 trainingParagraph(parent,'Lesson objective',lesson.objective);
 if(lesson.learn.length){
  var sec=element('section','lesson-part'),heading=element('h4',null,'What you need to learn'),ul=element('ul','lesson-bullets');
  lesson.learn.forEach(function(point){ul.append(element('li',null,point));});
  sec.append(heading,ul);parent.append(sec);
 }
 trainingParagraph(parent,'Practice exercise',lesson.practicePrompt);
 trainingParagraph(parent,'Evidence to record',lesson.practiceEvidence);
 trainingParagraph(parent,'Knowledge check',lesson.knowledgePrompt);
 trainingParagraph(parent,'What a good answer demonstrates',lesson.passingRule);
 if(lesson.questions.length){
  var quiz=element('section','lesson-part'),h=element('h4',null,'Assessment preparation'),ol=element('ol','lesson-bullets');
  lesson.questions.forEach(function(q){ol.append(element('li',null,q));});
  quiz.append(h,ol,element('p','muted','These are review prompts, not an automatically graded assessment. Formal certification remains owner-controlled.'));
  parent.append(quiz);
 }
 if(['completed','passed'].includes(String(status||''))){
  parent.append(element('p','training-done','Lesson completed. You can reopen and review it at any time.'));
  return;
 }
 var form=element('form','lesson-complete-form'),reflection=element('textarea');
 reflection.rows=3;reflection.maxLength=1000;reflection.placeholder='Write what you learned and how you would apply it to a real SBC lead.';
 var label=element('label','lesson-reflection',lesson.knowledgePrompt?'Your answer to the knowledge check':'Your lesson notes');
 label.append(reflection);
 var attestation=element('label','lesson-ack'),check=element('input');
 check.type='checkbox';check.setAttribute('aria-label','I have read and practiced this lesson');
 attestation.append(check,element('span',null,'I have read the lesson and completed the practice and knowledge check.'));
 var submit=element('button','primary','Save Completed Lesson');
 submit.type='submit';submit.disabled=true;
 function validate(){submit.disabled=!check.checked||reflection.value.trim().length<12;}
 check.addEventListener('change',validate);reflection.addEventListener('input',validate);
 form.append(label,attestation,element('p','muted','Write a short, specific reflection (at least 12 characters). This records lesson study, not a graded exam or certification.'),submit);
 form.addEventListener('submit',async function(event){
  event.preventDefault();if(submit.disabled)return;
  var answer=reflection.value.trim();
  if(answer.length<12||!check.checked)return;
  submit.disabled=true;
  try{
   var result=await api('/api/training/progress',{method:'POST',
     body:JSON.stringify({courseId:courseId,moduleId:mod.id,status:'completed',evidence:answer,notes:'Study completed in SBC Research Academy'})});
   if(result?.ok===false)throw Error(result.error||'Training service did not confirm the update.');
   note('Lesson completed and saved to your SBC Academy progress.');
   await loadTraining();
   await loadCourse(courseId);
  }catch(e){note('Lesson was not marked complete: '+errorMessage(e),true);validate();}
 });
 parent.append(form);
}
async function loadTraining(){
 try{
  var data=await api('/api/training');
  if(!data||data.ok===false||!Array.isArray(data.assigned))throw Error('SBC training catalog returned an unexpected format.');
  train=data;
  var list=$('training-list');list.replaceChildren();
  var assigned=data.assigned.map(function(item){return {course:item.course||item,summary:item.summary||null,assigned:true};});
  var available=Array.isArray(data.available)?data.available.map(function(c){return {course:c,summary:null,assigned:false};}):[];
  var known=new Set(),items=assigned.concat(available).filter(function(item){
   var c=item.course||{};
   if(!c.id||c.status!=='published'||known.has(String(c.id)))return false;
   known.add(String(c.id));return true;
  });
  if(!items.length){empty(list,'No published training is available for your account. Contact your SBC owner or manager; do not mark courses complete without learning material.');renderDailyPlan();return;}
  renderDailyPlan();
  items.forEach(function(item){
   var course=item.course,box=element('div','course-row'),left=element('div'),button=element('button','outline','Open course and lessons');
   left.append(element('strong',null,course.title||'SBC Academy Course'));
   var stats=item.summary;
   left.append(element('small',null,(course.description||'Assigned SBC training')+' · '+(course.modules?.length||stats?.moduleCount||0)+' lessons'+(stats?' · '+stats.percent+'% complete':'')+(item.assigned?' · Assigned':' · Available')));
   button.type='button';button.onclick=function(){loadCourse(course.id);};
   box.append(left,button);list.append(box);
  });
 }catch(e){empty($('training-list'),'Training is unavailable: '+errorMessage(e));train=null;}
}
async function loadCourse(id){
 if(!id){note('Course identifier is missing. Contact your SBC manager.',true);return;}
 var area=$('training-detail');area.hidden=false;empty(area,'Loading course and lesson material…');
 try{
  var data=await api('/api/training/courses/'+encodeURIComponent(id)),course=data.course||{};
  if(!data.ok||!course.id||!Array.isArray(course.modules))throw Error('No readable course was returned by the training system.');
  area.replaceChildren(element('h3',null,course.title||'SBC Academy Course'));
  area.append(element('p','muted',(course.description||'')+' · '+course.modules.length+' lessons. Select Open lesson to read the complete material.'));
  var statuses=new Map((data.summary?.modules||[]).map(function(m){return [String(m.id),m.status];}));
  if(!course.modules.length){area.append(element('p','muted','No lessons have been published in this course.'));return;}
  var modules=course.modules.filter(function(m){return m.status!=='archived'&&m.status!=='draft';}).slice().sort(function(a,b){return Number(a.order||0)-Number(b.order||0);});
  if(!modules.length){area.append(element('p','muted','No active lessons have been published in this course.'));return;}
  modules.forEach(function(mod,index){
   var status=statuses.get(String(mod.id))||'not_started';
   var row=element('div','course-module training-module'),head=element('div','training-module-head'),
       title=element('div'),button=element('button','outline','Open lesson'),
       content=element('div','training-lesson-content');
   content.hidden=true;
   title.append(element('strong',null,(index+1)+'. '+(mod.title||'Lesson')));
   title.append(element('small',null,(mod.minutes||15)+' min · '+String(status).replace(/_/g,' ')));
   button.type='button';button.setAttribute('aria-expanded','false');
   button.onclick=function(){
    var opening=content.hidden;
    if(opening){
     document.querySelectorAll('.training-lesson-content').forEach(function(el){el.hidden=true;});
     document.querySelectorAll('.training-module-head button').forEach(function(el){el.textContent='Open lesson';el.setAttribute('aria-expanded','false');});
     content.replaceChildren();lessonContent(content,mod,course.id,status);
    }
    content.hidden=!opening;button.textContent=opening?'Close lesson':'Open lesson';button.setAttribute('aria-expanded',opening?'true':'false');
   };
   head.append(title,button);row.append(head,content);area.append(row);
  });
  if(typeof area.scrollIntoView==='function')area.scrollIntoView({block:'start',behavior:'smooth'});
 }catch(e){empty(area,'Course could not be opened: '+errorMessage(e));note('This course did not load; progress has not been changed.',true);}
}
async function loadClock(){
 try{
  clock=await api('/api/v9/time/status');
  txt('clock-summary',clock.open?'Clocked in since '+new Date(clock.open.clockIn).toLocaleString():'You are currently clocked out.');
  $('clock-in').disabled=!!clock.open;$('clock-out').disabled=!clock.open;
  rememberVerifiedClockIn();renderShiftPlan();
 }catch(e){txt('clock-summary','Time clock unavailable: '+errorMessage(e));}
}
async function doClock(action){
 $('clock-in').disabled=true;$('clock-out').disabled=true;
 try{
  await api('/api/v9/time/clock',{method:'POST',body:JSON.stringify({action:action,mode:'training'})});
  await loadClock();
  if(action==='in'){
   await Promise.allSettled([loadLeads(),loadProgress()]);
   prioritizeAttention(false);
   if(active!=='queue')setTab('today');
  }
  renderShiftPlan();
  note(action==='in'?(active==='queue'?'Clocked in. Your corrections are your first priority.':'Clocked in successfully.'):'Clocked out successfully.');
 }catch(e){note('Time clock update failed: '+errorMessage(e),true);await loadClock();}
}
async function submitLead(event){
 event.preventDefault();if(busy)return;
 var form=event.target,fd=new FormData(form),data={source:'Lead Research'};
 ['businessName','contactName','phone','email','website','industry','address','notes','verificationSource'].forEach(function(key){data[key]=String(fd.get(key)||'').trim();});
 try{data.notes=composeSecondaryPhoneNotes(data.notes,fd.get('secondaryPhone'),fd.get('secondaryPhoneSource'),data.phone,2000);}
 catch(e){note('Lead not submitted: '+errorMessage(e),true);return;}
 if(!data.businessName&&!data.phone&&!data.email){note('Enter a business name, phone or email.',true);return;}
 busy=true;$('save-lead').disabled=true;clearNote();
 try{
  var saved=await api('/api/workforce/leads',{method:'POST',body:JSON.stringify(data)});
  if(!saved.id||!saved.persistence||saved.persistence.verified!==true)throw Error('The backend did not provide verified CRM persistence evidence.');
  form.reset();setTab('home');note((saved.researchComplete?'Research-complete lead saved; it counts toward your daily research target.':'Lead saved. Add a real contact method and research source to qualify for the research target.')+' SBC Lead Assist will perform verification automatically. Reference: '+saved.id);
  await Promise.allSettled([loadLeads(),loadProgress()]);
 }catch(e){note('Lead not submitted: '+errorMessage(e),true);}
 finally{busy=false;$('save-lead').disabled=false;}
}
async function refresh(){
 $('refresh').disabled=true;
 try{await Promise.allSettled([loadLeads(),loadProgress(),loadTraining(),loadClock()]);}
 finally{$('refresh').disabled=false;}
}

function importStatus(message){txt('import-run-status',message);}
function rowResult(row){
 if(row.status==='invalid')return row.errors.join(' · ');
 if(row.status==='saved')return 'Saved · '+row.reference;
 if(row.status==='duplicate')return 'Already in CRM — skipped';
 if(row.status==='error')return 'Not confirmed: '+row.message;
 if(row.status==='pending')return 'Not attempted';
 if(row.warnings.length)return 'Ready · '+row.warnings.join(' · ');
 return 'Ready to import';
}
function importRowElement(row){
 var div=element('div','import-row '+(row.status==='saved'?'saved':row.status==='error'||row.status==='invalid'?'failed':''));
 div.id='import-row-'+row.index;
 var index=element('span',null,String(row.rowNumber));
 var name=element('strong',null,row.record.businessName||'Missing business name');
 var detail=element('small',null,[row.record.contactName,row.record.phone,row.record.email,row.record.website].filter(Boolean).join(' · ')||'No verified contact details supplied');
 var result=element('span','result',rowResult(row));
 div.append(index,name,detail,result);return div;
}
function drawImportPreview(){
 var panel=$('import-preview-panel'),list=$('import-preview-list');
 panel.hidden=!importBatch;
 if(!importBatch){list.replaceChildren();return;}
 var rows=importBatch.records;
 txt('import-details',importBatch.total+' businesses found · '+importBatch.format+(importBatch.headersDetected?' · column headers mapped':' · standard column order'));
 txt('import-ready',rows.filter(function(r){return r.status==='ready';}).length+' ready');
 txt('import-invalid',rows.filter(function(r){return r.status==='invalid';}).length+' invalid');
 txt('import-saved',rows.filter(function(r){return r.status==='saved';}).length+' saved · '+rows.filter(function(r){return r.status==='duplicate';}).length+' CRM duplicates');
 list.replaceChildren();
 rows.forEach(function(row){list.append(importRowElement(row));});
 $('import-confirm').disabled=importRunning||!rows.some(function(r){return r.status==='ready';});
}
function updateImportRow(row){
 var old=$('import-row-'+row.index);
 if(old)old.replaceWith(importRowElement(row));
 var rows=importBatch.records;
 txt('import-ready',rows.filter(function(r){return r.status==='ready';}).length+' remaining');
 txt('import-invalid',rows.filter(function(r){return r.status==='invalid';}).length+' invalid');
 txt('import-saved',rows.filter(function(r){return r.status==='saved';}).length+' saved · '+rows.filter(function(r){return r.status==='duplicate';}).length+' duplicates');
}
async function previewImport(){
 if(importRunning)return;
 var preview=$('import-preview');preview.disabled=true;
 try{
  var file=$('import-file').files[0],raw='';
  if(file){
   if(file.size>600000)throw Error('File exceeds the 600 KB safety limit. Split the list into smaller CSV files.');
   raw=await file.text();
  }else raw=$('import-text').value;
  if(!window.SBCResearchImportCore)throw Error('CSV parser did not load. Refresh this workspace before importing.');
  importBatch=window.SBCResearchImportCore.preview(raw,{format:$('import-format').value});
  drawImportPreview();importStatus('Preview complete. Review the businesses and click Import to save valid rows.');
 }catch(e){
  importBatch=null;drawImportPreview();importStatus('Preview not available: '+errorMessage(e));
 }finally{preview.disabled=false;}
}
function resetImport(){
 if(importRunning)return;
 $('import-file').value='';$('import-text').value='';$('import-format').value='auto';
 importBatch=null;drawImportPreview();importStatus('List cleared. No changes were made to SBC CRM.');
}
async function confirmImport(){
 if(importRunning||busy||!importBatch)return;
 var rows=importBatch.records,ready=rows.filter(function(r){return r.status==='ready';});
 if(!ready.length){importStatus('There are no valid new rows to import.');return;}
 // Confirmation is a direct user action. We never retry failed or unknown writes.
 importRunning=true;$('import-confirm').disabled=true;$('import-preview').disabled=true;$('import-reset').disabled=true;
 $('import-file').disabled=true;$('import-text').disabled=true;$('import-format').disabled=true;
 var saved=0,duplicates=0,errors=0,attempts=0,stopped=false;
 try{
  for(var row of ready){
   if(!user){stopped=true;break;}
   attempts++;importStatus('Saving '+attempts+' of '+ready.length+' · '+saved+' accepted · '+duplicates+' duplicates…');
   try{
    var result=await api('/api/workforce/leads',{method:'POST',body:JSON.stringify(row.record)});
    if(!result||!result.id||result.persistence?.verified!==true)
      throw Error('CRM save could not be verified. Stop and check SBC before importing again.');
    row.status='saved';row.reference=String(result.id);saved++;
   }catch(e){
    if(e.status===409||e.duplicate){row.status='duplicate';duplicates++;}
    else{
     row.status='error';row.message=errorMessage(e);errors++;
     // Server 5xx, connection/timeouts, role expiration or read-only recovery:
     // do not send further records after an ambiguous or denied write.
     stopped=true;
    }
   }
   updateImportRow(row);
   if(stopped)break;
  }
  if(stopped){
   rows.filter(function(r){return r.status==='ready';}).forEach(function(r){r.status='pending';updateImportRow(r);});
   importStatus('Import stopped safely. '+saved+' saved, '+duplicates+' duplicates, '+errors+' unconfirmed errors. Remaining rows were not attempted. Check SBC CRM before attempting those rows again.');
  }else importStatus('Import completed: '+saved+' saved, '+duplicates+' duplicates, '+errors+' errors. Invalid preview rows were never sent.');
  await Promise.allSettled([loadLeads(),loadProgress()]);
 }finally{
  importRunning=false;$('import-preview').disabled=false;$('import-reset').disabled=false;
  $('import-file').disabled=false;$('import-text').disabled=false;$('import-format').disabled=false;
  $('import-confirm').disabled=true; // Never replay rows without a fresh review.
  if(!stopped&&saved>0)note('CSV import saved '+saved+' new business leads to SBC CRM.');
 }
}

document.querySelectorAll('[data-tab]').forEach(function(button){button.addEventListener('click',function(){setTab(button.getAttribute('data-tab'));});});
document.querySelectorAll('[data-go]').forEach(function(button){button.addEventListener('click',function(){setTab(button.getAttribute('data-go'));});});
$('search').addEventListener('input',drawLeads);
$('refresh').addEventListener('click',refresh);
$('lead-form').addEventListener('submit',submitLead);
$('import-preview').addEventListener('click',previewImport);
$('import-reset').addEventListener('click',resetImport);
$('import-confirm').addEventListener('click',confirmImport);
$('import-file').addEventListener('change',function(){if(!importRunning){importBatch=null;drawImportPreview();importStatus($('import-file').files.length?'File selected. Click Preview to review it.':'File cleared; paste a list or select another file.');}});
$('import-text').addEventListener('input',function(){if(!importRunning){importBatch=null;drawImportPreview();}});
$('import-format').addEventListener('change',function(){if(!importRunning){importBatch=null;drawImportPreview();}});
$('clock-in').addEventListener('click',function(){doClock('in');});
$('clock-out').addEventListener('click',function(){doClock('out');});
$('sign-out').addEventListener('click',async function(){try{await api('/api/logout',{method:'POST'});}finally{location.replace('/');}});
(async function start(){
 try{
  var me=await api('/api/me');
  if(!me.authenticated||!me.user||!hasRole(me.user.role)){location.replace('/');return;}
  user=me.user;txt('user-name',user.name||user.username||'Lead Researcher');
  await refresh();
  prioritizeAttention(true);
  renderShiftPlan();
  $('access').hidden=true;$('workspace').hidden=false;
  setInterval(function(){if(document.visibilityState==='visible'&&!busy&&!importRunning){renderShiftPlan();Promise.allSettled([loadLeads(),loadProgress()]);}},60000);
 }catch(e){
  var msg=errorMessage(e);txt('access',msg);
  if(/session|authentication|expired/i.test(msg)){location.replace('/');}
 }
})();
})();