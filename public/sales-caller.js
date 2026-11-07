/* SBC Spanish Sales Caller V66.97 — employee session or owner read-only preview. */
(function(){
'use strict';
const $=id=>document.getElementById(id), page=key=>document.querySelector('[data-page][id="'+key+'"]');
let me=null, data=null, clock=null, training=null, activeCall=null, phoneDevice=null, preview=false, current='attention', running=false, sessionDnc=new Set();
const query=new URLSearchParams(location.search), previewUserId=query.get('previewUserId')||'';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e;};
function notice(msg,urgent=true){const e=$('alert');e.hidden=false;e.textContent=String(msg);if(!urgent)e.style.borderColor='#6abca1';}
function error(e){return String(e?.message||e||'Unknown error').slice(0,300);}
async function api(url,opts){
 const o=Object.assign({credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}},opts||{});
 if(o.body)o.headers=Object.assign({},o.headers,{'Content-Type':'application/json'});
 const r=await fetch(url,o);let j;
 try{j=await r.json();}catch{throw Error('SBC API returned a non-JSON response (HTTP '+r.status+').');}
 if(!r.ok||j?.ok===false)throw Error(j?.error||j?.message||'SBC API failed (HTTP '+r.status+').');
 return j;
}
function canWrite(){return !preview&&me?.role==='caller';}
function timeOpen(){return clock?.open&&!clock.open.clockOut?clock.open:null;}
function readyCall(){return canWrite()&&Boolean(data?.canLiveCall)&&Boolean(timeOpen())&&!activeCall;}
function setPage(name){
 const titles={attention:'Priority Follow-ups',today:'Four-Hour Shift Plan',leads:'Assigned Leads',call:'Call & Notes',scripts:'English / Español',training:'Training & Certification',time:'Clock & Breaks'};
 if(!titles[name])return;current=name;
 document.querySelectorAll('[data-page]').forEach(x=>x.hidden=x.id!==name);
 document.querySelectorAll('[data-panel]').forEach(x=>x.classList.toggle('active',x.dataset.panel===name));
 $('panel-title').textContent=titles[name];$('alert').hidden=true;
 if(name==='today')renderShift();
}
function stamp(v){if(!v)return 'Not scheduled';const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'}):String(v).slice(0,40);}
function recordRow(head,sub,btnText,cb,priority=false){
 const row=el('div',undefined,'item'+(priority?' priority':''));
 const left=el('div');left.append(el('strong',head),el('small',sub));row.append(left);
 if(btnText){const b=el('button',btnText,'outline');b.type='button';b.onclick=cb;row.append(b);}
 return row;
}
async function load(){
 const route='/api/sales-caller/workspace'+(preview?'?previewUserId='+encodeURIComponent(previewUserId):'');
 const result=await api(route);
 if(result.preview!==preview||!['caller','lead_researcher'].includes(result.role))throw Error('Role preview did not match verified session.');
 data=result;
 const shiftSelector=$('sales-shift-length');if(shiftSelector){try{shiftSelector.value=localStorage.getItem('sbc-sales-shift-minutes-v1:'+result.user.id)==='360'?'360':'240';}catch(_){shiftSelector.value='240';}}
 if(window.SBCWorkforceTheme)window.SBCWorkforceTheme.attach(result.role,result.user.id);
 $('employee-name').textContent=(result.user?.name||'Employee')+' · '+result.role.replace('_',' ');
 $('preview-banner').hidden=!preview;
 $('m-leads').textContent=result.metrics.assigned;
 $('m-callable').textContent=result.role==='caller'?result.metrics.callable:'—';
 $('m-attention').textContent=result.role==='caller'?(window.SBCFollowupPriority?priorityCalls().length:'Unavailable'):result.metrics.needsAttention;
 $('m-clearance').textContent=result.role==='caller'?(result.canLiveCall?'Approved':'Training required'):'Research only';
 if(preview){
  clock={open:result.time.find(x=>!x.clockOut)||null,entries:result.time};
  $('clock-indicator').textContent='Read-only employee preview';
  $('time-summary').textContent=clock.open?'Employee clocked in at '+stamp(clock.open.clockIn):'Employee is clocked out';
 }else await loadClock();
 renderLeads();renderAttention();renderShift();renderCallTarget();renderTraining();
}
async function loadClock(){
 if(preview)return;
 try{clock=await api('/api/v9/time/status');$('clock-indicator').textContent=timeOpen()?'Clocked in · '+stamp(clock.open.clockIn):'Clocked out';
  $('time-summary').textContent=timeOpen()?'Clocked in since '+stamp(clock.open.clockIn):'Not clocked in.';
 }catch(e){clock=null;$('clock-indicator').textContent='Clock unavailable';$('time-summary').textContent=error(e);}
 for(const id of ['clock-in','clock-out','break-start','break-end'])$(id).disabled=preview;
 updateCallButtons();
}
function priorityCalls(){
 return window.SBCFollowupPriority?.buildQueue(data?.leads||[],data?.calls||[],Date.now())||[];
}
function renderAttention(){
 const target=$('attention-list');target.replaceChildren();
 if(data?.role==='caller'&&!window.SBCFollowupPriority){
  target.textContent='Follow-up prioritization is unavailable. Refresh the workspace before acting on scheduled callbacks.';
  return;
 }
 const issues=data?.role==='caller'?priorityCalls():[];
 const research=(data?.leads||[]).filter(x=>x.needsAttention);
 if(!issues.length&&!research.length){target.append(recordRow('No follow-ups currently listed','Check assigned leads and notifications; absence here does not prove callbacks were completed.'));return;}
 for(const item of issues.slice(0,50)){
  const when=item.dueAt?stamp(item.dueAt):'Confirm a callback time with the owner';
  const detail=[item.label,when,item.outcome,item.nextAction].filter(Boolean).join(' · ');
  target.append(recordRow(item.businessName,detail,'Open lead',()=>openLead(item.customerId),item.status==='overdue'||item.status==='needs_time'));
 }
 if(issues.length>50)target.append(recordRow('More follow-ups available',String(issues.length-50)+' additional assigned follow-ups. Work this list and refresh to see the next items.'));
 for(const c of research.slice(0,20))target.append(recordRow(c.businessName,'Needs additional verification — owner review required',null,null,true));
}
function renderLeads(){
 const target=$('lead-list'),q=$('search').value.toLowerCase().trim();target.replaceChildren();
 const rows=(data?.leads||[]).filter(c=>[c.businessName,c.contactName,c.phone,c.city].join(' ').toLowerCase().includes(q));
 if(!rows.length){target.append(recordRow('No matching assigned leads','Ask the owner to assign a reviewed lead batch.'));return;}
 rows.slice(0,150).forEach(c=>{
  const state=c.canCall?'Callable with clearance':c.reason||'Not callable';
  target.append(recordRow(c.businessName||'Unnamed lead',[c.contactName,c.phone,c.city,c.status,state].filter(Boolean).join(' · '),
   data.role==='caller'?'Select for call':'View details',()=>openLead(c.id),!c.canCall));
 });
}
function openLead(id){
 setPage('call');$('call-target').value=String(id||'');renderCallSelection();
}
function renderCallTarget(){
 const selector=$('call-target'),selected=selector.value;selector.replaceChildren(new Option('Select an assigned lead',''));
 for(const c of data?.leads||[])selector.add(new Option(c.businessName+' — '+(c.phone||'no phone'),c.id));
 selector.value=selected;if(!selector.value)selector.selectedIndex=0;
 renderCallSelection();
}
function renderCallSelection(){
 const id=$('call-target').value,c=data?.leads.find(x=>x.id===id);
 $('dial-number').value=c?.phone||'';
 $('lead-detail').textContent=c?([c.businessName,c.contactName,c.status,c.reason||''].filter(Boolean).join(' · ')):'Select an assigned lead to call.';
 $('report-button').disabled=!canWrite()||!c;
 updateCallButtons();
}
function updateCallButtons(){
 const c=data?.leads.find(x=>x.id===$('call-target')?.value);
 $('call-button').disabled=!readyCall()||!c?.canCall||sessionDnc.has(String(c?.id));
 $('end-button').disabled=!activeCall;
 $('report-button').disabled=!canWrite()||!c;
}
function renderShift(){
 const host=$('shift-tasks'),engine=window.SBCRoleShiftPlan;host.replaceChildren();
 if(!engine||!data)return;
 const day=engine.easternDay(new Date()),worker=data.user,role=data.role==='caller'?'sales':data.role,anchor=timeOpen()?.clockIn||null;
 const store=(()=>{try{return window.localStorage;}catch{return null;}})();
 const selector=$('sales-shift-length');if(selector)selector.hidden=role!=='sales';
 const selected=role==='sales'&&selector&&selector.value==='360'?360:240;
 const plan=engine.schedule(role,anchor,undefined,{minutes:selected});
 const marked=new Set(engine.read(store,worker,role,day)),completed=plan.items.filter(t=>marked.has(t.id)).length;
 $('task-count').textContent=completed+' of '+plan.items.length+' checked · '+plan.totalMinutes+' planned minutes';
 $('plan-clock').textContent=anchor?'Schedule anchored to verified clock-in: '+stamp(anchor)+' · '+(plan.totalMinutes/60)+'-hour plan.':'Clock in to activate the '+(plan.totalMinutes/60)+'-hour plan. This is a guide, not a payroll setting.';
 $('task-progress').style.width=Math.round(completed/Math.max(plan.items.length,1)*100)+'%';
 for(const t of plan.items){
  const item=el('div',undefined,'item'+(t.status==='current'?' now':'')+(marked.has(t.id)?' done':''));
  const box=el('input');box.type='checkbox';box.className='task-check';box.checked=marked.has(t.id);box.disabled=preview;
  box.setAttribute('aria-label','Mark '+t.title+' done');
  box.onchange=()=>{if(!engine.write(store,worker,role,day,t.id,box.checked))notice('Checklist storage failed; your payroll record was not changed.');renderShift();};
  const main=el('div');main.append(el('strong',t.title),el('small',t.minutes+' minutes · '+(t.startAt?stamp(t.startAt)+' – '+stamp(t.endAt):'Minute '+t.startOffset+'–'+t.endOffset)),el('small',t.detail));
  const go=el('button','Open task','outline');go.type='button';
  go.onclick=()=>setPage(t.tab==='queue'?'attention':t.tab==='mine'?'leads':t.tab==='training'?'training':t.tab==='clock'?'time':t.tab==='add'?'leads':t.tab==='import'?'leads':'call');
  item.append(box,main,go);host.append(item);
 }
}
const scripts={
 en:{
  'Opening':'Hello, my name is [name] calling from Successful By Choice in Miami. We help local businesses improve websites, online visibility, and business printing. Is now an appropriate time to speak briefly?',
  'Discovery':'How do customers find you online today? What part of your website or business listing would you most like to improve?',
  'Offer':'We have a $99 Business Visibility package and website packages starting at $199. I can have our owner confirm exactly what is included before you decide.',
  'Objection':'That makes sense. Would it be helpful if we sent you the service details so you can review them without pressure?',
  'Close':'May I arrange a short follow-up with our owner? I can record your preferred time and the service you are interested in.',
  'Respect refusal':'Understood. I will record your request and make sure you are not contacted again if you do not wish to receive sales calls.'
 },
 es:{
  'Saludo':'Hola, mi nombre es [nombre] y le llamo de Successful By Choice, aquí en Miami. Ayudamos a negocios locales con páginas web, visibilidad en internet e impresión comercial. ¿Es buen momento para hablar brevemente?',
  'Descubrimiento':'¿Cómo encuentran sus clientes su negocio por internet actualmente? ¿Qué le gustaría mejorar de su página web o de su perfil comercial?',
  'Oferta':'Ofrecemos un paquete de visibilidad comercial de $99 y paquetes de páginas web desde $199. Nuestro propietario puede confirmar todos los servicios incluidos antes de que usted decida.',
  'Objeción':'Lo entiendo perfectamente. ¿Le gustaría recibir información de nuestros servicios para revisarla sin compromiso?',
  'Cierre':'¿Podemos programar una llamada breve con nuestro propietario? Puedo anotar el horario que prefiere y el servicio que le interesa.',
  'No llamar':'Entendido. Registraré su solicitud para que no reciba más llamadas comerciales si así lo desea.'
 }};
function renderScripts(lang){
 const target=$('script-list');target.replaceChildren();
 for(const [label,copy] of Object.entries(scripts[lang]||scripts.es)){
  const div=recordRow(label,copy,'Copy',()=>navigator.clipboard?.writeText(copy).catch(()=>notice('Could not copy text.')),false);target.append(div);
 }
 $('lang-es').className=lang==='es'?'primary':'outline';$('lang-en').className=lang==='en'?'primary':'outline';
}
function lessonPart(parent,heading,value){
 if(!value)return;
 const section=el('section',undefined,'lesson-part');
 section.append(el('h4',heading),el('p',value));
 parent.append(section);
}
function showLesson(parent,module,courseId,status){
 const reader=window.SBCResearchLessonReader;
 if(!reader||typeof reader.normalize!=='function'){
  parent.append(el('p','Lesson reader unavailable. Refresh the page. Completion is disabled.','warning'));return;
 }
 const lesson=reader.normalize(module);
 if(!lesson.hasReadableContent){
  parent.append(el('p','This lesson has no readable course material. Contact the SBC owner; completion is disabled.','warning'));return;
 }
 parent.append(el('p','Estimated lesson time: '+lesson.minutes+' minutes','muted'));
 lessonPart(parent,'Lesson objective',lesson.objective);
 if(lesson.learn.length){
  const section=el('section',undefined,'lesson-part'),list=el('ul',undefined,'lesson-bullets');
  section.append(el('h4','What you need to learn'));
  for(const point of lesson.learn)list.append(el('li',point));
  section.append(list);parent.append(section);
 }
 lessonPart(parent,'Practice exercise',lesson.practicePrompt);
 lessonPart(parent,'Evidence to record',lesson.practiceEvidence);
 lessonPart(parent,'Knowledge check',lesson.knowledgePrompt);
 lessonPart(parent,'What a good answer demonstrates',lesson.passingRule);
 if(lesson.questions.length){
  const section=el('section',undefined,'lesson-part'),list=el('ol',undefined,'lesson-bullets');
  section.append(el('h4','Assessment preparation'));
  for(const question of lesson.questions)list.append(el('li',question));
  section.append(list,el('p','These are review prompts, not an automatically graded assessment. Formal certification remains owner-controlled.','muted'));
  parent.append(section);
 }
 parent.append(el('p','Source course lessons are provided as written by SBC Academy.','muted'));
 if(['completed','passed'].includes(String(status||'').toLowerCase())){
  parent.append(el('p','Lesson completed. You can reopen and review it at any time.','training-done'));return;
 }
 if(!canWrite()){
  parent.append(el('p','Owner preview is read-only. No training progress can be submitted.','muted'));return;
 }
 const form=el('form',undefined,'lesson-complete-form'),reflection=el('textarea'),check=el('input');
 reflection.rows=3;reflection.maxLength=1000;
 reflection.placeholder='Write what you learned and how you would apply it to a real SBC lead.';
 const label=el('label','Your answer to the knowledge check','lesson-reflection');label.append(reflection);
 const attestation=el('label',undefined,'lesson-ack');check.type='checkbox';
 check.setAttribute('aria-label','I have read and practiced this lesson');
 attestation.append(check,el('span','I have read the lesson and completed the practice and knowledge check.'));
 const save=el('button','Save Completed Lesson','primary');save.type='submit';save.disabled=true;
 const validate=()=>{save.disabled=!check.checked||reflection.value.trim().length<12;};
 check.addEventListener('change',validate);reflection.addEventListener('input',validate);
 form.append(label,attestation,el('p','Write a short, specific reflection (at least 12 characters). This records lesson study, not a graded exam or certification.','muted'),save);
 form.addEventListener('submit',async event=>{
  event.preventDefault();validate();if(save.disabled||!canWrite())return;
  save.disabled=true;
  try{
   const response=await api('/api/training/progress',{method:'POST',body:JSON.stringify({
    courseId,moduleId:module.id,status:'completed',evidence:reflection.value.trim(),notes:'Caller workstation Academy lesson'
   })});
   if(response?.ok===false)throw Error('Training server rejected the completion.');
   notice('Lesson study progress saved.',false);
   await openCourse(courseId,module.id);
  }catch(e){notice('Training completion not saved: '+error(e));validate();}
 });
 parent.append(form);
}
async function renderTraining(){
 const host=$('training-list'),detail=$('training-detail');
 host.hidden=false;detail.hidden=true;detail.replaceChildren();
 $('training-status').textContent='Onboarding: '+data.onboarding.status+' · Certification: '+data.certification.status+' · Live calls '+(data.canLiveCall?'approved':'blocked until owner clearance');
 host.replaceChildren();
 if(preview){host.append(recordRow('Owner preview','This view intentionally does not read the employee’s private lesson attempts.'));return;}
 try{
  training=await api('/api/training');
  if(!training||training.ok===false||!Array.isArray(training.assigned))throw Error('Unexpected SBC Academy response.');
  const assigned=training.assigned.map(x=>({course:x.course||x,summary:x.summary||{}}))
   .filter(x=>x.course?.id&&(!x.course.status||x.course.status==='published'));
  if(!assigned.length){host.append(recordRow('No courses assigned','Ask the SBC owner to assign published learning material.'));return;}
  for(const item of assigned){
   const course=item.course,summary=item.summary||{};
   const row=el('article',undefined,'item academy-sales-course');
   const left=el('div',undefined,'academy-course-intro');
   left.append(el('strong',course.title||'SBC Academy'));
   left.append(el('small',[(course.description||''),(course.modules?.length||summary.moduleCount||0)+' lessons',Number(summary.percent||0)+'% complete'].filter(Boolean).join(' · ')));
   const button=el('button','Open course','outline');button.type='button';
   button.onclick=()=>openCourse(course.id);
   row.append(left,button);host.append(row);
  }
 }catch(e){host.append(recordRow('Training unavailable',error(e)));}
}
async function openCourse(id,openLessonId=''){
 if(!id){notice('Course identifier missing.');return;}
 const host=$('training-list'),detail=$('training-detail');
 host.hidden=true;detail.hidden=false;
 detail.replaceChildren(el('p','Loading course and lesson material…','muted'));
 try{
  const response=await api('/api/training/courses/'+encodeURIComponent(id)),course=response.course||{};
  if(response?.ok===false||!course.id||!Array.isArray(course.modules))throw Error('SBC Academy did not return the published course materials.');
  detail.replaceChildren();
  const back=el('button','Back to courses','outline');back.type='button';back.onclick=renderTraining;
  detail.append(back,el('h3',course.title||'SBC Academy'),el('p',(course.description||'')+' · '+course.modules.length+' lessons','muted'));
  const statuses=new Map((response.summary?.modules||[]).map(x=>[String(x.id),String(x.status||'not_started')]));
  const modules=course.modules.filter(x=>x.status!=='draft'&&x.status!=='archived')
   .sort((a,b)=>Number(a.order||0)-Number(b.order||0));
  if(!modules.length){detail.append(el('p','No active lessons have been published in this course.','muted'));return;}
  for(const [index,module] of modules.entries()){
   const status=statuses.get(String(module.id))||'not_started';
   const row=el('article',undefined,'training-module'),heading=el('div',undefined,'training-module-head');
   const title=el('div');
   title.append(el('strong',(index+1)+'. '+(module.title||'Lesson')),
    el('small',(module.minutes||15)+' min · '+String(status).replace(/_/g,' ')));
   const button=el('button','Open lesson','outline'),content=el('div',undefined,'training-lesson-content');
   button.type='button';content.hidden=true;button.setAttribute('aria-expanded','false');
   button.onclick=()=>{
    const opening=content.hidden;
    for(const other of detail.querySelectorAll('.training-lesson-content'))other.hidden=true;
    for(const other of detail.querySelectorAll('.training-module-head button')){
     other.textContent='Open lesson';other.setAttribute('aria-expanded','false');
    }
    if(opening){content.replaceChildren();showLesson(content,module,course.id,status);}
    content.hidden=!opening;button.textContent=opening?'Close lesson':'Open lesson';
    button.setAttribute('aria-expanded',String(opening));
   };
   heading.append(title,button);row.append(heading,content);detail.append(row);
   if(String(module.id)===String(openLessonId))button.click();
  }
 }catch(e){
  detail.replaceChildren(recordRow('Course unavailable',error(e),'Back to courses',renderTraining));
  notice('The course did not load; no training progress was changed.');
 }
}
function callLog(s,status){
 return {sessionId:s.id,customerId:s.lead.id,to:s.to,status,startedAt:s.startedAt,endedAt:/^(completed|ended|failed|busy|no-answer|canceled)$/.test(status)?new Date().toISOString():'',direction:'outbound',durationSec:Math.max(0,Math.round((Date.now()-Date.parse(s.startedAt))/1000)),callSid:String(s.conn?.parameters?.CallSid||'').slice(0,120),notes:'',outcome:status};
}
async function saveCall(status){
 if(!activeCall)return false;
 try{const x=await api('/api/voice/log',{method:'POST',body:JSON.stringify(callLog(activeCall,status))});if(x?.durable!==true)throw Error('Call log not durably saved.');return true;}
 catch(e){notice('Voice log not saved: '+error(e));return false;}
}
async function dial(){
 if(running||activeCall||!readyCall())return;
 const lead=data.leads.find(c=>c.id===$('call-target').value);
 if(!lead||!lead.canCall||sessionDnc.has(lead.id)){notice('Select a callable, assigned lead.');return;}
 const phone=lead.phone;running=true;
 const session={id:'sbc_sales_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10),to:phone,lead,startedAt:new Date().toISOString(),conn:null,canceled:false};
 activeCall=session;updateCallButtons();$('call-status').textContent='Checking voice prerequisites…';
 try{
  const status=await api('/api/voice/status');
  if(!status.configured||status.webhookSignatureReady!==true)throw Error('Twilio Voice or signed callback is not configured.');
  const token=await api('/api/voice/token');
  if(!token.token||!window.Twilio?.Device)throw Error('Twilio browser SDK or token unavailable.');
  if(session.canceled)return;
  if(!await saveCall('connecting'))throw Error('Call blocked: durable CRM log was not confirmed.');
  session.logged=true;
  if(session.canceled)return;
  phoneDevice=new window.Twilio.Device(token.token,{codecPreferences:['opus','pcmu'],enableRingingState:true});
  const conn=await phoneDevice.connect({params:{To:phone}});
  if(session.canceled||activeCall!==session){try{conn.disconnect();}catch{}return;}
  session.conn=conn;
  $('call-status').textContent='Dialing '+phone+'…';
  conn.on('accept',()=>{if(activeCall!==session)return;$('call-status').textContent='Connected to '+phone;saveCall('in-progress').catch(()=>{});});
  conn.on('disconnect',()=>finish('completed').catch(()=>{}));
  conn.on('error',e=>{notice('Twilio call error: '+error(e));finish('failed').catch(()=>{});});
 }catch(e){notice('No call placed / call failed: '+error(e));await finish('failed');}
 finally{running=false;if(session.canceled&&activeCall===session)await finish('canceled');}
}
async function finish(status='ended'){
 const s=activeCall;if(!s)return;
 s.canceled=true;
 if(s.conn&&status!=='completed')try{s.conn.disconnect();}catch{}
 if(running&&!s.conn&&status==='ended'){$('call-status').textContent='Cancel requested; disconnecting any delayed call.';return;}
 const saved=s.logged?await saveCall(status):false;activeCall=null;updateCallButtons();
 $('call-status').textContent='Call '+status+(saved?' · logged in SBC':' · log needs review');
 try{phoneDevice?.destroy?.();}catch{}phoneDevice=null;
}
async function saveReport(event){
 event.preventDefault();if(!canWrite())return;
 const lead=data?.leads.find(c=>c.id===$('call-target').value);if(!lead)return;
 const outcome=$('outcome').value,notes=$('notes').value.trim();
 const button=$('report-button');button.disabled=true;
 try{
  const body={customerId:lead.id,contactName:$('contact').value.trim(),outcome,
   callbackAt:$('callback').value?new Date($('callback').value).toISOString():'',
   notes,appointmentRequested:outcome==='Appointment Requested'};
  const saved=await api('/api/v9/call-report',{method:'POST',body:JSON.stringify(body)});
  if(!saved.id)throw Error('No saved report ID returned.');
  if(outcome==='Do Not Call')sessionDnc.add(lead.id);
  $('notes').value='';notice('Report '+saved.id+' submitted for owner review. '+(outcome==='Do Not Call'?'Escalate DNC suppression to owner immediately.':''),false);
  await load();
 }catch(e){notice('Report not saved: '+error(e));}
 finally{button.disabled=false;updateCallButtons();}
}
async function clockAction(action){
 if(!canWrite())return;
 if(action==='out'&&activeCall){notice('End the active call before clocking out.');return;}
 const allowed=['in','out','break_start','break_end'];if(!allowed.includes(action))return;
 const btn=$('clock-'+(action==='in'?'in':action==='out'?'out':action==='break_start'?'in':'out'));
 if(btn)btn.disabled=true;
 try{await api('/api/v9/time/clock',{method:'POST',body:JSON.stringify({action,mode:data.canLiveCall?'calling':'training'})});notice('Time clock: '+action.replace('_',' ')+' confirmed.',false);await loadClock();renderShift();}
 catch(e){notice('Time clock failed: '+error(e));await loadClock();}
}
function switchLanguage(next){
 const chosen=window.SBCSalesLocale?.setLanguage(next)||next;
 try{if(me?.id)localStorage.setItem('sbc-sales-language-v1:'+me.id,chosen);}catch(_){}
 renderScripts(chosen);
}
function bind(){
 document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>setPage(b.dataset.panel));
 $('reload').onclick=()=>load().catch(e=>notice(error(e)));
 $('search').oninput=renderLeads;
 $('call-target').onchange=renderCallSelection;
 $('call-button').onclick=dial;$('end-button').onclick=()=>finish('ended');
 $('report-form').onsubmit=saveReport;
 $('clock-in').onclick=()=>clockAction('in');$('clock-out').onclick=()=>clockAction('out');
 $('break-start').onclick=()=>clockAction('break_start');$('break-end').onclick=()=>clockAction('break_end');
 $('lang-es').onclick=()=>switchLanguage('es');$('lang-en').onclick=()=>switchLanguage('en');
 const shift=$('sales-shift-length');if(shift){shift.onchange=()=>{try{if(data?.user?.id)localStorage.setItem('sbc-sales-shift-minutes-v1:'+data.user.id,shift.value);}catch(_){ }renderShift();};}
 const keys=$('dtmf-keypad');for(const n of ['1','2','3','4','5','6','7','8','9','*','0','#']){
  const b=el('button',n);b.type='button';b.setAttribute('aria-label','Send tone '+n);b.onclick=()=>{if(!activeCall?.conn){notice('Keypad tones work during a connected call.');return;}try{activeCall.conn.sendDigits(n);}catch(e){notice('Cannot send keypad tone: '+error(e));}};keys.append(b);
 }
 $('signout').onclick=async()=>{if(activeCall){notice('End the active call before signing out.');return;}try{await api('/api/logout',{method:'POST'});}catch{}location.replace('/');};
}
(async()=>{
 try{
  const auth=await api('/api/me');me=auth.user;
  preview=me?.role==='owner'&&Boolean(previewUserId);
  if(!preview&&me?.role!=='caller')throw Error('This desk requires a Sales Caller account or owner preview link.');
  bind();await load();
  const locale=window.SBCSalesLocale;
  if(locale){
   let selected='en';
   try{selected=localStorage.getItem('sbc-sales-language-v1:'+me.id)==='es'?'es':'en';}catch(_){}
   locale.install($('desk'));locale.setLanguage(selected);renderScripts(selected);
  }else renderScripts('en');
  $('loading').hidden=true;$('desk').hidden=false;setPage('attention');
 }catch(e){$('loading').textContent='Sales workspace unavailable: '+error(e)+' · Sign in with your assigned account.';}
})();
})();
