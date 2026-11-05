/* SBC Lead Research Workspace: isolated, server-authorized and fail-closed. */
(function(){
'use strict';
var roles=['lead_researcher','researcher','lead_generator','prospector'];
var user=null,leads=null,train=null,clock=null,loadedAt=null,busy=false,active='home',importBatch=null,importRunning=false,submittedIds=null,dailyAccepted=null;
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
 var titles={home:'My Dashboard',today:'Today’s Tasks',queue:'Research Queue',add:'Add Business Lead',import:'CSV & List Import',mine:'My Submitted Leads',training:'My Training',clock:'Time Clock'};
 txt('page-title',titles[tab]);clearNote();
 if(tab==='training'&&!train)loadTraining();
 if(tab==='clock'&&!clock)loadClock();
 if(tab==='today')renderDailyPlan();
}
function displayLead(c){
 var item=element('div','lead-row'),left=element('div'),right=element('div'),status=c.verificationStatus||c.status||'Needs Verification';
 left.append(element('strong',null,c.businessName||'Unnamed business'));
 left.append(element('small',null,[c.city||c.address,c.industry,c.phone,c.email].filter(Boolean).join(' · ')||'Contact details pending'));
 right.append(element('span','pill',status));
 var button=element('button','outline','Review');
 button.type='button';button.addEventListener('click',function(){openReview(item,c);});
 right.append(button);item.append(left,right);return item;
}
function openReview(item,lead){
 document.querySelectorAll('.research-review').forEach(function(el){el.remove();});
 var form=element('form','research-review'),fields=element('div','fields');
 var editable=[
  ['Business name','businessName'],['Contact person','contactName'],
  ['Phone','phone'],['Email','email'],['Website','website'],
  ['Industry','industry'],['City','city'],['Research source','verificationSource']
 ];
 editable.forEach(function(pair){
  var label=element('label',null,pair[0]),input=element('input');input.name=pair[1];
  input.value=String(lead[pair[1]]||'').slice(0,500);input.maxLength=500;
  label.append(input);fields.append(label);
 });
 var notes=element('label','wide','Research notes'),textarea=element('textarea');
 textarea.name='notes';textarea.maxLength=3000;textarea.rows=3;textarea.value=String(lead.notes||'').slice(0,3000);notes.append(textarea);fields.append(notes);
 var statusLabel=element('label','wide','Verification decision'),select=element('select');
 select.name='verificationStatus';
 [['Needs Verification','Still needs verification'],['Verified','Information verified'],['Owner Review','Needs owner review']].forEach(function(pair){
   var option=element('option',null,pair[1]);option.value=pair[0];option.selected=lead.verificationStatus===pair[0];select.append(option);
 });statusLabel.append(select);fields.append(statusLabel);
 var actions=element('div','form-actions'),submit=element('button','primary','Save research review'),cancel=element('button','outline','Cancel');
 submit.type='submit';cancel.type='button';cancel.onclick=function(){form.remove();};
 actions.append(submit,cancel);form.append(fields,actions);
 form.onsubmit=async function(event){
  event.preventDefault();submit.disabled=true;clearNote();
  var fd=new FormData(form),data={};
  editable.forEach(function(pair){data[pair[1]]=String(fd.get(pair[1])||'').trim();});
  data.notes=String(fd.get('notes')||'').trim();data.verificationStatus=String(fd.get('verificationStatus')||'Needs Verification');
  try{
   await api('/api/v9/lead-verification/'+encodeURIComponent(String(lead.id)),{method:'POST',body:JSON.stringify(data)});
   note('Research review saved to SBC.');form.remove();
   await loadLeads().catch(function(){note('Review saved, but the refreshed queue is unavailable.',true);});
  }catch(e){note('Research review was not saved: '+errorMessage(e),true);}
  finally{submit.disabled=false;}
 };
 item.append(form);
}
function drawLeads(){
 if(!leads)return;
 var q=$('queue-list'),m=$('mine-list'),filter=String($('search').value||'').trim().toLowerCase();
 var chosen=leads.filter(function(c){return [c.businessName,c.phone,c.email,c.city,c.address,c.industry].join(' ').toLowerCase().includes(filter);});
 var own=leads.filter(function(c){return submittedIds?submittedIds.has(String(c.id)):String(c.researcherId||'')===String(user.id);});
 q.replaceChildren();m.replaceChildren();
 if(!chosen.length)empty(q,filter?'No matching leads in your current research queue.':'No leads currently assigned to your research queue.');
 else chosen.forEach(function(c){q.append(displayLead(c));});
 if(!own.length)empty(m,'No current queue items are marked as submitted by your account. Completed or moved leads may no longer appear here.');
 else own.forEach(function(c){m.append(displayLead(c));});
 txt('metric-queue',leads.length);
 txt('metric-unverified',leads.filter(function(c){return !c.verificationStatus||['Needs Verification','Owner Review'].includes(c.verificationStatus);}).length);
 txt('metric-mine',own.length);
}
async function loadLeads(){
 var notice=$('queue-error');notice.hidden=true;
 try{
  var response=await api('/api/v9/lead-verification');
  if(!Array.isArray(response.leads))throw Error('CRM returned no valid research queue.');
  leads=response.leads;loadedAt=new Date();drawLeads();
  txt('sync-label','CRM synced '+loadedAt.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}));
 }catch(e){
  notice.hidden=false;notice.textContent='Research queue unavailable: '+errorMessage(e);
  txt('sync-label',leads?'CRM data may be stale':'CRM unavailable');
  if(!leads){txt('metric-queue','—');txt('metric-unverified','—');txt('metric-mine','—');empty($('queue-list'),'Unable to load your queue. No zero counts are being assumed.');empty($('mine-list'),'Unable to load your submissions.');}
  throw e;
 }
}
async function loadProgress(){
 try{
  var result=await api('/api/workforce/research-progress');
  if(!result.ok||!Number.isInteger(result.todayCount)||result.todayCount<0)throw Error('SBC did not return valid production counts.');
  var total=result.todayCount,target=16,stretch=20;
  if(!Array.isArray(result.submittedLeadIds))throw Error('CRM did not return auditable submission IDs.');
  submittedIds=new Set(result.submittedLeadIds.map(String));
  if(leads)drawLeads();
  dailyAccepted=total;
  renderDailyPlan();
  txt('goal-current',total);
  txt('goal-seven',Number.isInteger(result.last7Count)?result.last7Count:'—');
  txt('goal-all',Number.isInteger(result.allTimeCount)?result.allTimeCount:'—');
  txt('goal-verified',Number.isInteger(result.verifiedTodayCount)?result.verifiedTodayCount:'—');
  txt('goal-date',result.date+' · Eastern business day');
  txt('goal-status',total>=stretch?'Stretch goal achieved! Every additional quality lead is a bonus.':total>=target?'Daily goal reached — '+(stretch-total)+' more to hit the stretch.':(target-total)+' more accepted leads to reach your daily goal.');
  $('goal-fill').style.width=Math.min(100,Math.max(0,total/stretch*100))+'%';
  $('goal-track').setAttribute('aria-valuenow',String(Math.min(stretch,total)));
  $('goal-track').setAttribute('aria-valuetext',String(total)+' leads saved out of 20 stretch target');
 }catch(e){
  ['goal-current','goal-seven','goal-all','goal-verified'].forEach(function(id){txt(id,'—');});
  dailyAccepted=null;renderDailyPlan();
  txt('goal-status','Could not load verified CRM totals: '+errorMessage(e));
  $('goal-fill').style.width='0%';$('goal-track').removeAttribute('aria-valuenow');$('goal-track').setAttribute('aria-valuetext','CRM progress unavailable');
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
 txt('daily-focus-title','Today’s focus: '+focus);
 txt('daily-overview',et.day+' · '+et.date+' ET · Research, verify, learn, and hand off qualified prospects.');
 txt('daily-plan-date',et.day+', '+et.date+' · Suggested focus: '+focus+'. Priorities refresh automatically each Eastern business day.');
 var unverified=leads?leads.filter(function(c){return !c.verificationStatus||['Needs Verification','Owner Review'].includes(c.verificationStatus);}).length:null;
 var incomplete=leads?leads.filter(function(c){return !c.phone||!c.website||!c.contactName;}).length:null;
 var training=trainedToday();
 var items=[
  {number:'01',label:'Start with verification',detail:'Review at least 5 existing leads. Confirm contact details and document a trustworthy research source. Do not mark Sales Ready.',tab:'queue',action:'Open research queue',stat:unverified===null?'Queue loading…':unverified+' active leads need verification'},
  {number:'02',label:'Research new business prospects',detail:'Focus on '+focus+'. Locate real businesses, check for duplicates, and capture verified phones, websites and contact names. Aim for 8 quality prospects in your first research block.',tab:'add',action:'Add new business',stat:dailyAccepted===null?'Accepted lead total unavailable':dailyAccepted+' accepted in CRM today'},
  {number:'03',label:'Clean up records',detail:'Audit 5 existing records for missing numbers, stale websites, duplicate names or uncertain data. Correct only information you have confirmed; flag the rest for owner review.',tab:'queue',action:'Review existing leads',stat:incomplete===null?'Research data loading…':incomplete+' visible records need contact cleanup'},
  {number:'04',label:'Study one Academy lesson',detail:'Open an assigned SBC training course, read the full learning material, complete the practice and answer the knowledge check before recording progress.',tab:'training',action:'Open training reader',stat:training===null?'Training progress unavailable':training+' lesson'+(training===1?'':'s')+' completed today'},
  {number:'05',label:'Finish the lead target and handoff',detail:'Continue verified research toward 16 accepted leads, with 20 as a stretch. Before signing out, review submissions and note any items needing management approval.',tab:'mine',action:'Review my submissions',stat:dailyAccepted===null?'CRM count unavailable':dailyAccepted>=16?'Daily accepted-lead goal reached':(16-dailyAccepted)+' additional accepted leads to base goal'}
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
 }catch(e){txt('clock-summary','Time clock unavailable: '+errorMessage(e));}
}
async function doClock(action){
 $('clock-in').disabled=true;$('clock-out').disabled=true;
 try{
  await api('/api/v9/time/clock',{method:'POST',body:JSON.stringify({action:action,mode:'training'})});
  await loadClock();note(action==='in'?'Clocked in successfully.':'Clocked out successfully.');
 }catch(e){note('Time clock update failed: '+errorMessage(e),true);await loadClock();}
}
async function submitLead(event){
 event.preventDefault();if(busy)return;
 var form=event.target,fd=new FormData(form),data={source:'Lead Research'};
 ['businessName','contactName','phone','email','website','industry','address','notes'].forEach(function(key){data[key]=String(fd.get(key)||'').trim();});
 if(!data.businessName&&!data.phone&&!data.email){note('Enter a business name, phone or email.',true);return;}
 busy=true;$('save-lead').disabled=true;clearNote();
 try{
  var saved=await api('/api/workforce/leads',{method:'POST',body:JSON.stringify(data)});
  if(!saved.id||!saved.persistence||saved.persistence.verified!==true)throw Error('The backend did not provide verified CRM persistence evidence.');
  form.reset();setTab('home');note('Lead saved and verified in the central SBC CRM. Reference: '+saved.id);
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
  $('access').hidden=true;$('workspace').hidden=false;
  await refresh();
  setInterval(function(){if(document.visibilityState==='visible'&&!busy&&!importRunning)Promise.allSettled([loadLeads(),loadProgress()]);},60000);
 }catch(e){
  var msg=errorMessage(e);txt('access',msg);
  if(/session|authentication|expired/i.test(msg)){location.replace('/');}
 }
})();
})();