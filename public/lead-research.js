/* SBC Lead Research Workspace: isolated, server-authorized and fail-closed. */
(function(){
'use strict';
var roles=['lead_researcher','researcher','lead_generator','prospector'];
var user=null,leads=null,train=null,clock=null,loadedAt=null,busy=false,active='home';
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
  if(!response.ok){if(response.status===401)throw Error('Your session expired. Sign in again.');throw Error(payload.error||payload.message||('SBC request failed: '+response.status));}
  return payload;
 }catch(e){if(e.name==='AbortError')throw Error('SBC did not respond before the connection timeout.');throw e;}
 finally{clearTimeout(timer);}
}
function setTab(tab){
 if(!['home','queue','add','mine','training','clock'].includes(tab))return;
 active=tab;
 document.querySelectorAll('[data-pane]').forEach(function(el){el.hidden=el.getAttribute('data-pane')!==tab;});
 document.querySelectorAll('[data-tab]').forEach(function(el){el.classList.toggle('active',el.getAttribute('data-tab')===tab);});
 var titles={home:'My Dashboard',queue:'Research Queue',add:'Add Business Lead',mine:'My Submitted Leads',training:'My Training',clock:'Time Clock'};
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
  await loadLeads().catch(function(){note('Lead saved to SBC CRM, but the research queue refresh failed. Do not resubmit: '+saved.id,true);});
 }catch(e){note('Lead not submitted: '+errorMessage(e),true);}
 finally{busy=false;$('save-lead').disabled=false;}
}
async function refresh(){
 $('refresh').disabled=true;
 try{await Promise.allSettled([loadLeads(),loadTraining(),loadClock()]);}
 finally{$('refresh').disabled=false;}
}
document.querySelectorAll('[data-tab]').forEach(function(button){button.addEventListener('click',function(){setTab(button.getAttribute('data-tab'));});});
document.querySelectorAll('[data-go]').forEach(function(button){button.addEventListener('click',function(){setTab(button.getAttribute('data-go'));});});
$('search').addEventListener('input',drawLeads);
$('refresh').addEventListener('click',refresh);
$('lead-form').addEventListener('submit',submitLead);
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
  setInterval(function(){if(document.visibilityState==='visible'&&!busy)loadLeads().catch(function(){});},60000);
 }catch(e){
  var msg=errorMessage(e);txt('access',msg);
  if(/session|authentication|expired/i.test(msg)){location.replace('/');}
 }
})();
})();