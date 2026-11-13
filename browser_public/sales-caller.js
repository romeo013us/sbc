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
 const titles={attention:'Priority Follow-ups',today:'Daily Shift Plan',leads:'Assigned Accounts',call:'Account Conversations',scripts:'English / Español',websites:'Website Showroom',training:'Training & Certification',time:'Clock & Breaks'};
 if(!titles[name])return;current=name;
 document.querySelectorAll('[data-page]').forEach(x=>x.hidden=x.id!==name);
 document.querySelectorAll('[data-panel]').forEach(x=>x.classList.toggle('active',x.dataset.panel===name));
 $('panel-title').textContent=titles[name];$('alert').hidden=true;
 if(name==='today')renderShift();
  if(name==='websites')renderWebsiteShowroom().catch(e=>notice('Website showroom unavailable: '+error(e)));
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
 $('employee-name').textContent=(result.user?.name||'Employee')+' · '+(result.role==='caller'?'Account Manager':result.role.replace('_',' '));
 $('preview-banner').hidden=!preview;
 $('m-leads').textContent=result.metrics.assigned;
 $('m-callable').textContent=result.role==='caller'?result.metrics.callable:'—';
 $('m-attention').textContent=result.role==='caller'?(window.SBCFollowupPriority?priorityCalls().length+accountCareItems().length:'Unavailable'):result.metrics.needsAttention;
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
function accountCareItems(){
 const now=new Date().toISOString().slice(0,10);
 return (data?.leads||[]).filter(c=>String(c.status||'').toLowerCase()==='customer'&&
   /^\d{4}-\d{2}-\d{2}$/.test(String(c.followUpAt||'').slice(0,10)))
  .map(c=>({id:c.id,name:c.businessName||'Customer account',date:String(c.followUpAt).slice(0,10)}))
  .filter(c=>c.date<=new Date(Date.now()+30*86400000).toISOString().slice(0,10))
  .sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name)).slice(0,50);
}
function renderAttention(){
 const target=$('attention-list');target.replaceChildren();
 if(data?.role==='caller'&&!window.SBCFollowupPriority){
  target.textContent='Follow-up prioritization is unavailable. Refresh the workspace before acting on scheduled callbacks.';
  return;
 }
 const issues=data?.role==='caller'?priorityCalls():[];
 const careItems=data?.role==='caller'?accountCareItems():[];
 const research=(data?.leads||[]).filter(x=>x.needsAttention);
 if(!issues.length&&!research.length&&!careItems.length){target.append(recordRow('No follow-ups currently listed','Check assigned leads and notifications; absence here does not prove callbacks were completed.'));return;}
 for(const item of careItems){target.append(recordRow('Customer care · '+item.name,'Account review scheduled: '+item.date+' · confirm customer agreement and service needs','Open account',()=>openLead(item.id),item.date<=new Date().toISOString().slice(0,10)));}
 for(const item of issues.slice(0,50)){
  const when=item.dueAt?stamp(item.dueAt):'Confirm a callback time with the owner';
  const detail=[item.label,when,item.outcome,item.nextAction].filter(Boolean).join(' · ');
  target.append(recordRow(item.businessName,detail,'Open lead',()=>openLead(item.customerId),item.status==='overdue'||item.status==='needs_time'));
 }
 if(issues.length>50)target.append(recordRow('More follow-ups available',String(issues.length-50)+' additional assigned follow-ups. Work this list and refresh to see the next items.'));
 for(const c of research.slice(0,20))target.append(recordRow(c.businessName,'Needs additional verification — owner review required',null,null,true));
}
async function renderWebsiteShowroom(){
 const host=$('sbcSalesWebsiteLibrary'),count=$('sbcSalesWebsiteCount');
 if(!host||!count)return;
 host.replaceChildren(el('p','Loading approved websites for your assigned businesses…'));
 count.textContent='—';
 try{
  // This read-only, tenant/assignment-scoped server projection marks sites Approved.
  // Do not use lead.demoUrl here: it can be a stale draft or a historic URL.
  const response=await api('/api/website-production/call-desk?limit=200');
  if(!Array.isArray(response.rows))throw Error('Approved website list unavailable.');
  const assigned=new Set((data?.leads||[]).map(c=>String(c.id)));
  const rows=response.rows.filter(row=>
   assigned.has(String(row.customerId)) &&
   /^\/demo\/[a-z0-9-]+$/.test(String(row.websiteUrl||'')));
  count.textContent=String(rows.length);
  host.replaceChildren();
  if(!rows.length){
   const empty=el('div',undefined,'sbc-website-empty');
   empty.append(el('strong','No approved website presentations in your assigned queue yet.'),
    el('p','Ask the SBC owner to build and approve a website first. Drafts and unverified media are not available for prospect presentation.'));
   host.append(empty);
   return;
  }
  for(const row of rows){
   const c=(data?.leads||[]).find(x=>String(x.id)===String(row.customerId));
   if(!c)continue;
   const card=el('article',undefined,'sbc-website-lead-card');
   const intro=el('div',undefined,'sbc-website-card-intro');
   const status=el('span','OWNER APPROVED · WEBSITE READY','sbc-website-status-pill');
   const title=el('h3',String(c.businessName||row.businessName||'Assigned business'),'');
   const descriptor=el('p',(row.websiteTier==='starter'?'Business Starter · $199 · One page':'Business Basic · $349 · Four pages')+' · Concept visuals and text are examples until the business confirms details.');
   intro.append(status,title,descriptor);
   const actions=el('div',undefined,'sbc-website-card-actions');
   const link=el('a','↗ View Approved Website','sbc-website-open');
   link.href=String(row.websiteUrl);
   link.target='_blank';link.rel='noopener noreferrer';
   const view=el('button',c.canCall?'Open calling preparation':'Review lead restrictions','sbc-website-lead-action');
   view.type='button';view.addEventListener('click',()=>openLead(c.id));
   actions.append(link,view);
   const note=el('small',c.canCall?'A presentation still requires the prospect’s agreement. No automatic outreach.':'Do not contact this prospect without clearance. This gallery grants no calling or messaging permission.');
   card.append(intro,actions,note);
   host.append(card);
  }
  if(response.rows.length>=200)host.append(el('p','Showing approved sites within the first 200 website sales records. Use owner CRM for any additional records.','muted'));
 }catch(e){
  count.textContent='—';
  host.replaceChildren(el('p','Website showroom unavailable: '+error(e)+'. Refresh after the service is available.'));
 }
}

function renderLeads(){
 const target=$('lead-list'),q=$('search').value.toLowerCase().trim();target.replaceChildren();
 const rows=(data?.leads||[]).filter(c=>[c.businessName,c.contactName,c.phone,c.email,c.city,c.address,c.industry].join(' ').toLowerCase().includes(q));
 if(!rows.length){target.append(recordRow('No matching assigned leads','Ask the owner to assign a reviewed lead batch.'));return;}
 rows.slice(0,150).forEach(c=>{
  const state=c.canCall?'Callable with clearance':(c.queueReason||c.reason||'Not callable');
  target.append(recordRow(c.businessName||'Unnamed lead',[c.contactName,c.phone,c.address||'Address not recorded',c.status,c.followUpAt?('Due '+stamp(c.followUpAt)):'',c.demoUrl?'Website preview ready':'',state].filter(Boolean).join(' · '),
   'Open business profile',()=>openLead(c.id),false));
 });
}
function openLead(id){
 setPage('call');$('call-target').value=String(id||'');renderCallSelection();
}
function renderCallTarget(){
 const selector=$('call-target'),selected=selector.value;selector.replaceChildren(new Option('Select an assigned lead',''));
 for(const c of data?.leads||[])selector.add(new Option(c.businessName+' — '+(c.phone||'no phone'),c.id));
 // Prefer the highest-priority eligible lead, but preserve an explicitly selected
 // eligible lead. Deferred leads remain visible below in the assigned-leads list.
 const selectedLead=(data?.leads||[]).find(c=>c.id===selected);
 const nextEligible=(data?.leads||[]).find(c=>c.canCall===true);
 selector.value=selectedLead?.canCall?selected:(nextEligible?.id||'');
 renderCallSelection();
}
function renderCallerAccount(c){
 var host=$('lead-detail');if(!host)return;
 host.replaceChildren();if(!c){host.textContent='Select an assigned business to view its profile.';return;}
 host.classList.add('sbc-caller-account-profile');
 host.append(el('h3',c.businessName||'Unnamed business'));
 host.append(el('p',(c.industry||'Category not recorded')+' · '+(c.status||'Lead')+' · '+(c.canCall?'Calling clearance subject to shift/training':'Not callable — review only'),'muted'));
 var details=el('div',undefined,'sbc-caller-account-fields');
 var entries=[['Contact / decision maker',c.contactName],['Business phone',c.phone],['Email',c.email],['Business address',c.address],['Website status',c.researchBrief?.websitePresence],['Google profile status',c.researchBrief?.googleBusinessPresence],['Research notes',c.researchBrief?.originalNotes]];
 entries.forEach(function(pair){var row=el('div',undefined,'sbc-caller-account-field');row.append(el('small',pair[0]),el('strong',pair[1]||'Not recorded'));details.append(row);});
 var addLink=function(label,value){if(!value)return;try{var url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return;var a=el('a',label);a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';details.append(a);}catch(_){}};
 addLink('Open business website',c.website);addLink('Open Google Business Profile',c.researchBrief?.googleBusinessUrl);
 var lookup=[c.businessName,c.city||c.address].filter(Boolean).join(' ');
 if(lookup)addLink('Research business address (verify source before saving)','https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(lookup));
 if(!String(c.address||'').trim())details.append(el('p','Business address not recorded. Confirm it with the research team or a reliable business source before using it for customer service or website publication.','muted'));
 host.append(details);
 var planner=window.SBC_ACCOUNT_SUCCESS;
 if(planner&&typeof planner.plan==='function'){
  var success=planner.plan(c);
  var panel=el('section',undefined,'sbc-caller-account-plan');
  panel.append(el('h3','Account manager · customer success'));
  panel.append(el('p','Relationship: '+success.stage+' · Assigned account manager: '+success.accountManager,'muted'));
  panel.append(el('p','Next touchpoint: '+success.nextTouchpoint));
  panel.append(el('p','Recommended next action: '+success.nextAction));
  panel.append(el('p','Instant Sites brief: '+success.siteBrief.industry+' · '+success.siteBrief.location+' · Services: '+(success.siteBrief.services||'confirm with customer')));
  panel.append(el('p','Website concepts require owner approval. Existing client support, payments and fulfillment remain owner-controlled; staff cannot bypass calling consent or account assignment.','muted'));
  host.append(panel);
 }
 // Existing paying customers stay in this assigned account desk beyond the first sale.
 var care=el('section',undefined,'sbc-account-next-touch');
 care.append(el('h3','Account follow-up · ongoing relationship'));
 care.append(el('p','Schedule an agreed review, renewal or service check-in. Saving creates a CRM follow-up only; it does not call, text or email anyone.','muted'));
 var form=el('form'),line=el('label','Next account review date');
 var due=el('input');due.type='date';due.required=true;due.name='dueDate';due.value=/^\d{4}-\d{2}-\d{2}$/.test(String(c.followUpAt||'').slice(0,10))?String(c.followUpAt).slice(0,10):'';
 line.append(due);
 var note=el('label','Reason / customer-agreed next step');
 var purpose=el('textarea');purpose.name='purpose';purpose.required=true;purpose.minLength=12;purpose.maxLength=500;purpose.rows=3;purpose.placeholder='Example: Review website launch, hosting renewal or support request';note.append(purpose);
 var submit=el('button','Save CRM Follow-up','primary');submit.type='submit';
 var feedback=el('p','Only the assigned account manager can schedule this account. Owner can review and transfer ownership.','muted');
 const closed=['do not call','do not contact','dnc','opt out','unsubscribe','lost'].includes(String(c.status||'').toLowerCase());
 if(!canWrite()||closed){submit.disabled=true;feedback.textContent='Read-only: account follow-up changes are not authorized for this role/status.';}
 form.append(line,note,submit,feedback);
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(!canWrite()||closed)return;
  submit.disabled=true;feedback.textContent='Saving the next touchpoint in the authoritative CRM…';
  try{
   const result=await api('/api/v6606/crm/account-portfolios/'+encodeURIComponent(String(c.id))+'/follow-up',{
    method:'POST',body:JSON.stringify({dueDate:due.value,purpose:purpose.value.trim()})});
   if(result?.durable!==true||String(result?.id)!==String(c.id))throw Error('SBC did not confirm a durable follow-up.');
   c.followUpAt=result.followUp;renderLeads();renderAttention();
   feedback.textContent='Saved. Follow-up due '+result.followUp+'; no message or call was sent.';
  }catch(err){feedback.textContent='Not saved: '+error(err)+'. Check assignment and CRM availability.';}
  finally{submit.disabled=false;}
 });
 care.append(form);host.append(care);
 var noteSection=el('section',undefined,'sbc-account-service-notes');
 noteSection.append(el('h3','Record account interaction · customer service'));
 noteSection.append(el('p','Keep the customer relationship in SBC. Log service requests, website changes and agreed next steps here; no payment card details or passwords.','muted'));
 const serviceForm=el('form'),serviceText=el('textarea');serviceText.name='note';serviceText.rows=3;serviceText.minLength=12;serviceText.maxLength=3000;serviceText.required=true;
 serviceText.placeholder='Example: Customer asked about updating their website. Explained next steps and scheduled a service review.';
 const serviceButton=el('button','Save Account Interaction','primary');serviceButton.type='submit';
 const serviceStatus=el('p','A saved account note is visible to SBC management and follows the account when ownership changes.','muted');
 serviceButton.disabled=!canWrite();
 serviceForm.append(serviceText,serviceButton,serviceStatus);
 serviceForm.addEventListener('submit',async event=>{
  event.preventDefault();if(!canWrite())return;
  serviceButton.disabled=true;serviceStatus.textContent='Saving the customer interaction in SBC…';
  try{
   const result=await api('/api/v6606/crm/account-portfolios/'+encodeURIComponent(String(c.id))+'/note',
    {method:'POST',body:JSON.stringify({note:serviceText.value.trim()})});
   if(result?.durable!==true||String(result?.id)!==String(c.id))throw Error('SBC did not verify the account note.');
   serviceText.value='';
   serviceStatus.textContent='Saved to the permanent account record. No customer contact was sent.';
  }catch(err){serviceStatus.textContent='Account note not saved: '+error(err)+'. Verify assignment and try again.';}
  finally{serviceButton.disabled=false;}
 });
 noteSection.append(serviceForm);host.append(noteSection);
 host.append(el('p','Use the call and report controls below to log verified outcomes. Only the SBC owner can edit the master business record or approve outreach.','muted'));
}
function renderCallSelection(){
 const id=$('call-target').value,c=data?.leads.find(x=>x.id===id);
 $('dial-number').value=c?.phone||'';
 renderCallerAccount(c);
 const preview=$('sbc-caller-demo-link');
 if(preview){
  preview.replaceChildren();
  if(c?.demoUrl&&/^\/demo\/[a-z0-9-]+$/.test(c.demoUrl)){
   const link=document.createElement('a');
   link.href=c.demoUrl;link.target='_blank';link.rel='noopener noreferrer';
   link.textContent='Open this prospect’s prepared SBC website preview';
   preview.append(link);
  }else preview.textContent='No prepared website preview for this prospect.';
 }

 const briefHost=$('sbc-caller-research-content'),sourceHost=$('sbc-caller-research-source');
 if(briefHost){
  const r=c?.researchBrief||{},label=v=>v==='found'?'Found (researcher-reported)':v==='not_found'?'Checked; not found':'Not checked / not recorded';
  const text=v=>String(v||'').trim()||'Not verified / not recorded';
  briefHost.textContent=c?[
   'CONTACT & BUSINESS',
   'Business: '+text(c.businessName),
   'Contact: '+text(c.contactName)+(r.ownerContactVerified?' (source checked)':' (name not independently verified)'),
   'Phone: '+text(c.phone),
   'Email: '+text(c.email),
   'Category: '+text(c.industry),
   'Website URL: '+text(c.website),
   'Website check: '+label(r.websitePresence),
   'Google Business Profile: '+label(r.googleBusinessPresence),
   '',
   'RESEARCH FACTS',
   'Years in business: '+text(r.yearsInBusiness),
   'Specific services: '+(r.servicesVerified?text(r.specificServices):'Not independently verified'+(r.specificServices?' — researcher notes: '+r.specificServices:'')),
   'Business history: '+text(r.businessHistory),
   'Likely customers: '+text(r.likelyCustomerTypes)+(r.likelyCustomerTypesStatus==='source_verified'?' (researcher claims source verification)':' (industry-based estimate)'),
   '',
   'SALES PREPARATION — CONDITIONAL',
   'Suggested SBC offer: '+text(r.suggestedSbcOffer),
   'Only appropriate when: '+text(r.offerCondition),
   'Opening question: '+text(r.openingQuestion),
   'Research source: '+text(r.researchSource),
   '',
   'ORIGINAL CRM NOTES',
   text(r.originalNotes),
   '',
   'ORIGINAL PASTED BRIEF',
   text(r.originalBrief),
   '',
   'All research details are researcher-supplied. Lead Assist/owner verification and DNC restrictions still apply.'
  ].join('\n'):'Select a lead to see their research.';
 }
 if(sourceHost){
  sourceHost.replaceChildren();
  const r=c?.researchBrief||{};
  const link=r.researchEvidenceUrl||r.googleBusinessUrl;
  if(link&&/^https:\/\/[^\s]+$/i.test(link)){
   const a=document.createElement('a');a.href=link;a.target='_blank';a.rel='noopener noreferrer';
   a.textContent='Open original research source';sourceHost.append(a);
  }else sourceHost.textContent='No verified research URL attached.';
 }
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
function renderScripts(lang){
 const target=$('script-list');target.replaceChildren();
 const library=window.SBCSalesPlaybook;
 if(!library||typeof library.getSections!=='function'){
  target.append(el('p',lang==='es'?'La guía de ventas no está disponible. Actualice la página.':'Sales playbook unavailable. Refresh the page.','warning'));
  return;
 }
 const spanish=lang==='es',sections=library.getSections(lang);
 const intro=el('div',undefined,'sbc-script-intro');
 intro.append(el('strong',spanish?'LA PRIMERA VENTA ES LA CONVERSACIÓN':'WIN THE CONVERSATION FIRST'));
 intro.append(el('p',spanish?
   'Identifíquese con su nombre completo y SBC. Dé un motivo concreto, haga una pregunta, escuche y acuerde un paso real. Use solo detalles verificados; no prometa resultados.' :
   'Give your full name and SBC. State a specific reason, ask one question, listen, and agree on a real next step. Use only verified details; never guarantee outcomes.'));
 const warning=el('p',spanish?
   'Antes de marcar: compruebe autorización, exclusiones y horario local. Si piden no recibir llamadas, deténgase y registre «No llamar». Nunca envíe mensajes sin el consentimiento correspondiente.' :
   'Before dialing: check calling clearance, suppression and local time. A do-not-call request means STOP and save the DNC outcome. Do not send messages without applicable consent.','muted');
 intro.append(warning);target.append(intro);
 const searchWrap=el('div',undefined,'sbc-script-search');
 const label=el('label',spanish?'Buscar guiones por necesidad, sector u objeción':'Find a script by need, industry or objection');
 const search=el('input');search.type='search';search.autocomplete='off';search.placeholder=spanish?'Ej.: Google, caro, salón, cita':'e.g. Google, price, salon, appointment';
 search.setAttribute('aria-label',label.textContent);searchWrap.append(label,search);target.append(searchWrap);
 const results=el('div',undefined,'sbc-script-results');target.append(results);
 const render=(filter='')=>{
  results.replaceChildren();let count=0;
  const term=String(filter||'').toLocaleLowerCase().trim();
  for(const section of sections){
   const matching=section.items.filter(item=>!term||[item.title,item.say,item.coach,section.title].some(x=>x.toLocaleLowerCase().includes(term)));
   if(!matching.length)continue;count+=matching.length;
   const details=el('details',undefined,'sbc-script-section');details.open=!!term||section.id==='start';
   const summary=el('summary',section.title+' · '+matching.length);
   details.append(summary);
   const cards=el('div',undefined,'sbc-script-cards');
   for(const item of matching){
    const card=el('article',undefined,'sbc-script-card');
    card.append(el('h3',item.title));
    card.append(el('p',item.say,'sbc-script-words'));
    const coach=el('p',item.coach,'sbc-script-coach');card.append(coach);
    const copy=el('button',spanish?'Copiar guion':'Copy talking points','outline');copy.type='button';
    copy.setAttribute('aria-label',(spanish?'Copiar ':'Copy ')+item.title);
    copy.onclick=()=>{
     if(!navigator.clipboard?.writeText){notice(spanish?'No se puede copiar en este navegador.':'Clipboard unavailable in this browser.');return;}
     navigator.clipboard.writeText(item.say).then(()=>{
      copy.textContent=spanish?'Copiado ✓':'Copied ✓';
     }).catch(()=>notice(spanish?'No se pudo copiar.':'Could not copy text.'));
    };
    card.append(copy);cards.append(card);
   }
   details.append(cards);results.append(details);
  }
  if(!count)results.append(el('p',spanish?'No hay guiones con ese filtro.':'No scripts match that search.','muted'));
 };
 search.addEventListener('input',()=>render(search.value));
 render();
 $('lang-es').className=spanish?'primary':'outline';$('lang-en').className=spanish?'outline':'primary';
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
  // A successful disposition must advance the desk; never advance on failed writes.
  $('call-target').value='';
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
