/* SBC Lead Research Workspace: isolated, server-authorized and fail-closed. */
(function(){
'use strict';
var roles=['lead_researcher','researcher','lead_generator','prospector'];
var user=null,leads=null,train=null,clock=null,loadedAt=null,busy=false,active='home',importBatch=null,importRunning=false;
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
 if(!['home','queue','add','import','mine','training','clock'].includes(tab))return;
 if(importRunning&&tab!=='import'){note('Bulk import is running. Finish the current batch before changing workspaces.',true);return;}
 active=tab;
 document.querySelectorAll('[data-pane]').forEach(function(el){el.hidden=el.getAttribute('data-pane')!==tab;});
 document.querySelectorAll('[data-tab]').forEach(function(el){el.classList.toggle('active',el.getAttribute('data-tab')===tab);});
 var titles={home:'My Dashboard',queue:'Research Queue',add:'Add Business Lead',import:'CSV & List Import',mine:'My Submitted Leads',training:'My Training',clock:'Time Clock'};
 txt('page-title',titles[tab]);clearNote();
 if(tab==='training'&&!train)loadTraining();
 if(tab==='clock'&&!clock)loadClock();
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
 var own=leads.filter(function(c){return String(c.researcherId||'')===String(user.id);});
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
  txt('goal-status','Could not load verified CRM totals: '+errorMessage(e));
  $('goal-fill').style.width='0%';$('goal-track').removeAttribute('aria-valuenow');$('goal-track').setAttribute('aria-valuetext','CRM progress unavailable');
 }
}
async function loadTraining(){
 try{
  var data=await api('/api/training');train=data;
  var list=$('training-list');list.replaceChildren();
  var assigned=Array.isArray(data.assigned)?data.assigned:[];
  if(!assigned.length){empty(list,'No training courses assigned to your account yet.');return;}
  assigned.forEach(function(item){
   var course=item.course||item,box=element('div','course-row'),left=element('div'),button=element('button','outline','View course');
   left.append(element('strong',null,course.title||course.name||'Assigned training'));
   left.append(element('small',null,course.description||'View your course content and modules.'));
   button.type='button';button.onclick=function(){loadCourse(course.id||item.courseId||item.id);};
   box.append(left,button);list.append(box);
  });
 }catch(e){empty($('training-list'),'Training cannot be loaded: '+errorMessage(e));}
}
async function loadCourse(id){
 if(!id){note('Course identifier is missing. Please contact your SBC manager.',true);return;}
 var area=$('training-detail');area.hidden=false;empty(area,'Loading course…');
 try{
  var data=await api('/api/training/courses/'+encodeURIComponent(id)),course=data.course||{};
  area.replaceChildren(element('h3',null,course.title||'Training Course'));
  var mods=Array.isArray(course.modules)?course.modules:[];
  if(!mods.length){area.append(element('p','muted','This course has no visible modules.'));return;}
  mods.forEach(function(mod){
   var box=element('div','course-module'),title=element('strong',null,mod.title||'Lesson'),content=element('p',null,typeof mod.content==='string'?mod.content:(mod.description||'Open this lesson in the training system for additional materials.'));
   box.append(title,content);
   var button=element('button','outline','Mark lesson complete');button.type='button';
   button.onclick=async function(){
    button.disabled=true;
    try{await api('/api/training/progress',{method:'POST',body:JSON.stringify({courseId:course.id,moduleId:mod.id,status:'completed'})});note('Training progress saved to SBC.');}
    catch(e){note('Could not save training progress: '+errorMessage(e),true);}
    finally{button.disabled=false;}
   };
   box.append(button);area.append(box);
  });
 }catch(e){empty(area,'Course could not be opened: '+errorMessage(e));}
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