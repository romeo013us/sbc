/* SBC Account Management OS — authenticated tenant server owns every record.
 * Browser stores no customer details. All writes are server-authorized.
 */
(()=>{'use strict';
 const $=id=>document.getElementById(id),state={view:'accounts',accounts:[],handoffs:[],channels:[],posts:[],selected:null,lang:'en',role:'',busy:false};
 const dict={es:{siteValue:"¿Por qué una página web?",siteValueTitle:"3 razones para tener una página web",siteValueHelp:"Respuestas breves y precisas; sin prometer ventas ni posiciones en Google.",findTitle:"1 · Que le encuentren",findText:"Una página ofrece un lugar claro donde conocer su negocio cuando buscan o escuchan de usted.",trustTitle:"2 · Inspirar confianza",trustText:"Una página profesional ayuda a evaluar servicios y datos comerciales comprobados.",contactTitle:"3 · Facilitar el contacto",contactText:"Un lugar para teléfono, cotizaciones y citas cuando esas funciones estén activadas.",siteNeed:"“¿Por qué necesito una página web?”",siteNeedAnswer:"Ayuda a que le encuentren, genera confianza y facilita el contacto. ¿Cuál de esas ventajas le serviría más?",socialQuestion:"“Pero ya tengo Facebook.”",socialAnswer:"¡Excelente! Mantenga Facebook. Su página lo complementa con servicios y datos de contacto en un solo lugar.",careTitle:"Configuración y gestión mensual",careText:"El paquete inicial figura a $199. Una gestión opcional de $79 al mes está en revisión del propietario; no se debe presentar como disponible. Confirme alcance y facturación antes de ofrecerla.",accounts:'Mis cuentas',handoffs:'Transferencias de investigación',social:'Estudio de redes',controls:'Seguridad y controles',connected:'Conectado al CRM de SBC',back:'Centro de mando',refresh:'Actualizar',portfolio:'Cartera de clientes asignados',portfolioHelp:'Cada contacto pertenece a una empresa con un administrador responsable.',researchQueue:'Investigación → Gestión de cuentas',researchHelp:'Los clientes potenciales verificados se revisan antes de asignarse.',contentStudio:'Estudio de redes sociales',contentHelp:'Prepare publicaciones para Facebook e Instagram. El dueño autoriza cada publicación.',safety:'Controles operativos',customer:'Cliente',channel:'Cuenta social autorizada',caption:'Texto de la publicación',media:'URL pública HTTPS de la imagen (requerida para Instagram)',link:'URL de destino',createDraft:'Crear borrador',contentQueue:'Publicaciones y aprobaciones',note:'Nota de cuenta',saveNote:'Guardar nota',timeline:'Historial de relaciones',quickTitle:'Una acción · Guardar resultado',quickHelp:'Registre lo ocurrido, conserve el historial y programe el siguiente paso. Esto no realiza llamadas ni envía mensajes.',quickOutcome:'¿Qué sucedió?',quickPick:'Seleccione resultado…',quickConnected:'Hablé con el negocio',quickNoAnswer:'Sin respuesta',quickFollowUp:'Solicitó seguimiento',quickBadNumber:'Número incorrecto · requiere investigación',quickDnc:'No contactar · bloquear ahora',quickDate:'Fecha del próximo seguimiento',quickNote:'¿Qué se aprendió o solicitó?',quickGuard:'Verifique la identidad, el número, el consentimiento y las restricciones antes de llamar. Aquí no se inicia ninguna llamada.',quickSave:'Guardar resultado y siguiente paso',accountSearch:'Buscar cuenta'}};
 const t=k=>dict[state.lang]?.[k]||document.querySelector(`[data-t="${k}"]`)?.dataset.en||k;
 const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
 const blockedAccount=a=>a?.doNotContact===true||a?.doNotCall===true||a?.salesSuppressed===true||
  /^(?:do not call|do not contact|dnc|opt.?out|unsubscribe|lost|deleted|bad number|wrong number)$/i.test(String(a?.status||'').trim());
 const localToday=()=>{
  const d=new Date();
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 };
 let pendingQuick=null;
 function updateQuickForm(){
  const form=$('sbcManagerOutcomeForm');
  if(!form)return;
  const outcome=form.elements.outcome.value,
   dateField=$('sbcQuickDateField'),
   date=form.elements.dueDate;
  dateField.hidden=!['CONNECTED','FOLLOW_UP_REQUESTED'].includes(outcome);
  date.required=outcome==='FOLLOW_UP_REQUESTED';
  date.min=localToday();
  if(dateField.hidden)date.value='';
  const status=$('sbcQuickStatus');
  if(status&&status.dataset.saved!=='yes')status.textContent=outcome==='DO_NOT_CONTACT'?
   'This immediately suppresses future outreach when saved.':
   outcome==='BAD_NUMBER'?'This removes the number from normal outreach pending new research.':
   'Save this internal CRM record; no call or message will be sent.';
 }
 function configureQuickForm(account){
  const section=$('sbcManagerQuickActions');
  if(!section)return;
  section.hidden=state.role!=='account_manager';
  $('noteForm').hidden=state.role==='account_manager';
  if(section.hidden)return;
  const form=$('sbcManagerOutcomeForm'),blocked=blockedAccount(account);
  form.reset();pendingQuick=null;
  $('sbcQuickPhone').textContent='Account phone: '+String(account.phone||'Not verified')+
   ' · Review your documented permission and calling requirements before dialing.';
  $('sbcQuickStatus').dataset.saved='';
  $('sbcQuickStatus').textContent=blocked?
   'Contact suppressed or number invalid. This account is for internal review only.':
   'Ready to record a verified manual outcome. No call or message is initiated.';
  form.querySelectorAll('input,select,textarea,button').forEach(field=>field.disabled=blocked);
  $('sbcQuickSave').disabled=blocked;
  updateQuickForm();
 }
 async function submitQuickOutcome(event){
  event.preventDefault();
  const form=event.currentTarget,status=$('sbcQuickStatus');
  const account=state.accounts.find(x=>String(x.id)===String(state.selected));
  if(state.role!=='account_manager'||!account||blockedAccount(account)){
   status.textContent='This account is no longer authorized for contact. Refresh the account.';
   return;
  }
  const body={outcome:String(form.elements.outcome.value),
   note:String(form.elements.note.value||'').trim()};
  const due=String(form.elements.dueDate.value||'');
  if(due&&['CONNECTED','FOLLOW_UP_REQUESTED'].includes(body.outcome))body.dueDate=due;
  if(!['CONNECTED','NO_ANSWER','FOLLOW_UP_REQUESTED','BAD_NUMBER','DO_NOT_CONTACT'].includes(body.outcome)||
   body.note.length<12||body.note.length>1000||(body.outcome==='FOLLOW_UP_REQUESTED'&&!body.dueDate)){
   status.textContent='Choose an outcome, write a clear account note, and supply the required date.';
   return;
  }
  if(!window.crypto?.randomUUID){
   status.textContent='A secure browser session is required to save this outcome.';return;
  }
  if(body.outcome==='DO_NOT_CONTACT'&&!window.confirm('Suppress this account from future outreach? This is an immediate CRM safety change.'))return;
  const signature=JSON.stringify(body),id=String(account.id);
  if(!pendingQuick||pendingQuick.id!==id||pendingQuick.signature!==signature){
   pendingQuick={id,signature,requestId:'sbc-action-'+window.crypto.randomUUID().replace(/-/g,'')};
  }
  body.requestId=pendingQuick.requestId;
  $('sbcQuickSave').disabled=true;
  status.textContent='Saving the outcome and any next step together…';
  try{
   const res=await fetch('/api/v6606/crm/account-portfolios/'+encodeURIComponent(id)+'/interaction',
    {method:'POST',credentials:'same-origin',cache:'no-store',
     headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(body)});
   const data=await res.json().catch(()=>({}));
   if(!res.ok||data.ok!==true||data.durable!==true)
    throw Error(data.code||'ACCOUNT_INTERACTION_NOT_CONFIRMED');
   if(state.selected!==id)return;
   pendingQuick=null;
   account.status=data.status;account.followUp=data.followUp;
   account.doNotContact=data.outcome==='DO_NOT_CONTACT'||account.doNotContact===true;
   account.salesSuppressed=data.outcome==='BAD_NUMBER'||account.salesSuppressed===true;
   status.dataset.saved='yes';
   status.textContent=data.outcome==='BAD_NUMBER'?
    'Saved. Number removed from normal outreach; return the account for research. No automatic retry.':
    data.outcome==='DO_NOT_CONTACT'?
    'Saved. Contact is suppressed and follow-up cleared. Do not contact this business.':
    'Saved in the existing CRM. '+(data.followUp?'Next review: '+data.followUp+'. ':'')+
     'No phone call or customer message was sent.';
   await loadAccountHistoryV5(id);
   if(data.outcome==='DO_NOT_CONTACT'||data.outcome==='BAD_NUMBER'){
    form.querySelectorAll('input,select,textarea,button').forEach(x=>x.disabled=true);
   }else{form.reset();updateQuickForm();}
  }catch(error){
   status.dataset.saved='';
   status.textContent='Not confirmed: '+String(error.message||error)+
    '. The same Save action safely retries the identical request.';
  }finally{
   if(!blockedAccount(account)&&state.selected===id)$('sbcQuickSave').disabled=false;
  }
 }
 const message=(s,bad=false)=>{$('alert').textContent=s||'';$('alert').style.borderColor=bad?'#ba696d':''};
 async function api(route,{method='GET',body}={}){
  const r=await fetch(route,{credentials:'same-origin',method,headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const d=await r.json().catch(()=>({}));if(!r.ok||d.ok!==true)throw Error(String(d.error||'REQUEST_NOT_AUTHORIZED'));
  return d.data;
 }
 function page(view){state.view=view;document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false')});
  document.querySelectorAll('main .view').forEach(el=>el.hidden=el.id!==`view-${view}`);$('pageTitle').textContent=document.querySelector(`[data-view="${view}"] span`)?.textContent||view;
  if(view==='social')socialLoad().catch(e=>message(e.message,true));if(view==='handoffs')loadHandoffs().catch(e=>message(e.message,true));
 }
 function accountOptions(){return state.accounts.map(a=>`<option value="${escapeHtml(a.id)}">${escapeHtml(a.businessName)}</option>`).join('');}
 function renderAccountGrid(){
  const term=String($('sbcAccountSearch')?.value||'').trim().toLowerCase();
  const matches=state.accounts.filter(a=>!term||
   [a.businessName,a.contactName,a.phone,a.id,a.city].some(v=>String(v??'').toLowerCase().includes(term)));
  const shown=matches.slice(0,80),count=matches.length,spanish=state.lang==='es';
  if(state.accounts.length===0){
   $('sbcAccountCount').textContent=spanish?'No hay cuentas asignadas.':'No assigned accounts.';
   $('accountGrid').innerHTML='<p class="empty">No accounts have been assigned to your authenticated session. No sample customer data is displayed.</p>';
   return;
  }
  $('sbcAccountCount').textContent=term?
   (spanish?'Mostrando '+shown.length+' de '+count+' coincidencias.':'Showing '+shown.length+' of '+count+' matching accounts.'):
   (count>shown.length?
    (spanish?'Mostrando '+shown.length+' de '+count+' cuentas. Busque para encontrar otra empresa.':'Showing '+shown.length+' of '+count+' accounts. Search to find another business.'):
    (spanish?count+' cuentas asignadas.':count+' assigned accounts.'));
  if(!shown.length){
   $('accountGrid').innerHTML='<p class="empty">'+(spanish?
    'No se encontraron cuentas asignadas con esa búsqueda.':'No matching assigned accounts. Try a business name, phone or CRM ID.')+'</p>';
   return;
  }
  $('accountGrid').innerHTML=shown.map(a=>
   '<article class="account-card"><span class="status">'+escapeHtml(a.status||'Account')+'</span>'+
   '<h3>'+escapeHtml(a.businessName||'Business name not recorded')+'</h3>'+
   '<div class="meta">Account: '+escapeHtml(a.id)+'</div>'+
   '<div class="meta">'+escapeHtml(a.phone||'No verified phone')+'</div>'+
   '<button class="button secondary" data-action="open-account" data-id="'+escapeHtml(a.id)+'">Open account</button></article>'
  ).join('');
 }
 async function load(){message('');try{
  const me=await fetch('/api/me',{credentials:'same-origin',headers:{Accept:'application/json'}});
  const identity=await me.json().catch(()=>({}));
  if(!me.ok||identity.ok!==true||!['owner','account_manager'].includes(identity.user?.role)||identity.user.active===false)throw Error('ACCOUNT_MANAGER_AUTHORIZATION_REQUIRED');
  state.role=identity.user.role;
  const p=state.role==='account_manager'?
   await api('/api/v6606/crm/account-portfolios/mine'):
   await api('/api/account-social/v1/portfolio');
  state.accounts=p.accounts||[];
  // Social Studio maintains separate permissions; its queue cannot hide valid CRM accounts.
  const q=await api('/api/account-social/v1/research/queue').catch(()=>[]);
  state.handoffs=q||[];
  $('rolePill').textContent=(state.role==='owner'?'OWNER':'ACCOUNT MANAGER')+' · TENANT '+p.tenantId;
  $('metrics').innerHTML=[['Managed accounts',state.accounts.length],['Research handoffs',state.handoffs.length],['DNC / suppressions',state.accounts.filter(x=>x.doNotContact).length],['Connected channels','Verify in Social Studio']].map(([label,v])=>`<div class="metric"><strong>${escapeHtml(v)}</strong><small>${escapeHtml(label)}</small></div>`).join('');
  renderAccountGrid();
  $('socialCustomer').innerHTML=accountOptions();renderHandoffs();if(state.selected)openAccount(state.selected);if(state.view==='social')await socialLoad();
 }catch(e){
  // Access may have expired while this page was open. Clear *every* previously
  // authorized customer view (not just the primary account cards).
  state.accounts=[];state.handoffs=[];state.channels=[];state.posts=[];
  state.selected=null;state.role='';pendingQuick=null;
  $('accountDetail').hidden=true;
  for(const id of ['metrics','handoffList','socialCustomer','socialChannel','socialList',
    'accountFacts','timeline','detailTitle']){
    const node=$(id);if(node)node.replaceChildren();
  }
  for(const id of ['sbcAccountResearchV4','sbcAccountPlanV5']){
    const node=$(id);if(node)node.replaceChildren();
  }
  $('sbcAccountCount').textContent='Account list unavailable. Sign in or ask the owner for access.';
  $('accountGrid').innerHTML='<p class="empty">Account data could not be verified. Check your login or ask the owner to enable the workstation.</p>';
  message('Workspace unavailable: '+e.message,true);$('rolePill').textContent='NOT AUTHORIZED';}}
 function openAccount(id){const a=state.accounts.find(x=>x.id===id);if(!a)return;state.selected=id;
  $('accountDetail').hidden=false;$('detailTitle').textContent=a.businessName;
  $('accountFacts').innerHTML=`<p class="muted">Manager: ${escapeHtml(a.managerId)} · CRM status: ${escapeHtml(a.status)} · ${a.doNotContact?'CONTACT SUPPRESSED':'Follow your documented consent and outreach policies'}</p>`;
  $('timeline').innerHTML=(a.timeline||[]).length?a.timeline.map(x=>`<div class="timeline-row"><span class="tag">${escapeHtml(x.kind)}</span> ${escapeHtml(x.summary)}<div class="muted">${escapeHtml(x.createdAt)}</div></div>`).join(''):'<p class="empty">No recorded account interactions yet.</p>';
  configureQuickForm(a);
  $('accountDetail').scrollIntoView({behavior:'smooth',block:'start'});
  if(state.role==='account_manager'){void loadAccountHistoryV5(id);void loadAccountResearchV4(id);void loadAccountPlanV5(id);}
 }


 async function loadAccountHistoryV5(id){
  try{
   const response=await fetch('/api/v6606/crm/account-portfolios/'+encodeURIComponent(id)+'/history',
    {credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
   const data=await response.json().catch(()=>({}));
   if(state.selected!==id)return;
   if(!response.ok||data.ok!==true)throw Error(data.code||'CRM_HISTORY_UNAVAILABLE');
   $('timeline').innerHTML=(data.notes||[]).length?data.notes.map(n=>'<div class="timeline-row"><span class="tag">CRM note</span> '+
    escapeHtml(n.note)+'<div class="muted">'+escapeHtml(n.createdAt)+' · '+escapeHtml(n.authorName)+'</div></div>').join(''):
    '<p class="empty">No CRM account notes yet. All notes are attached to this existing business record.</p>';
  }catch(error){if(state.selected===id)$('timeline').textContent='CRM history not confirmed: '+String(error.message||error)}
 }
 async function loadAccountResearchV4(id){
  let host=$('sbcAccountResearchV4');
  if(!host){host=document.createElement('section');host.id='sbcAccountResearchV4';host.className='account-card';$('accountDetail').appendChild(host);}
  host.textContent='Loading owner-approved account research…';
  try{
   const response=await fetch('/api/prospect-intelligence/v4/accounts/'+encodeURIComponent(id)+'/research',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
   const result=await response.json().catch(()=>({}));
   if(state.selected!==id)return;
   if(!response.ok||result.ok!==true)throw Error(result.code||'RESEARCH_ACCESS_NOT_VERIFIED');
   const list=result.research||[];
   if(!list.length){host.innerHTML='<h3>Approved Account Research</h3><p>No owner-reviewed V4 findings attached to this account yet.</p>';return}
   host.innerHTML='<h3>Approved Account Research</h3><p class="muted">Evidence-based suggestions; no automatic contact, charge or ranking promise.</p>'+
    list.map(r=>'<article class="timeline-row"><strong>'+escapeHtml(r.business?.businessName||'Business')+'</strong>'+
    '<p>Evidence: '+escapeHtml(r.opportunity?.verification||'unverified')+' · Priority: '+escapeHtml(r.opportunity?.score??'Not verified')+'</p>'+
    '<p>'+escapeHtml(r.nextAction)+'</p><p class="muted">Audit: '+escapeHtml(r.opportunity?.evidenceDate||'Unverified')+
    ' · '+escapeHtml(r.opportunity?.outreach?.action||'VERIFY_PERMISSION')+'</p></article>').join('');
  }catch(e){if(state.selected===id)host.textContent='Research access not verified. Ask the owner to check assignment. '+String(e.message||e)}
 }

 async function loadAccountPlanV5(id){
  let host=$('sbcAccountPlanV5');
  if(!host){host=document.createElement('section');host.id='sbcAccountPlanV5';host.className='account-card';$('accountDetail').appendChild(host);}
  host.textContent='Loading approved account opportunity plan…';
  try{
   const response=await fetch('/api/prospect-intelligence/v5/accounts/'+encodeURIComponent(id)+'/plan',
    {credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
   const data=await response.json().catch(()=>({}));
   if(state.selected!==id)return;
   if(!response.ok||data.ok!==true||!data.plan)throw Error(data.code||'PLAN_NOT_VERIFIED');
   const plan=data.plan,contactBlocked=plan.contactStatus==='SUPPRESSED';
   host.innerHTML='<h3>Account Revenue Intelligence V5</h3>'+
    '<p class="muted">Assigned Account Manager workspace · planning only. No automatic calls, messages, quotes, or charges.</p>'+
    '<p><strong>Account:</strong> '+escapeHtml(plan.businessName)+' · '+escapeHtml(plan.customerStage)+
    ' · Research: '+escapeHtml(plan.auditStatus)+'</p>'+
    '<p><strong>Next CRM follow-up:</strong> '+escapeHtml(plan.nextFollowUp||'Not scheduled')+
    ' · Contact status: '+escapeHtml(plan.contactStatus)+'</p>'+
    '<h4>Recommended internal next steps</h4><ul>'+plan.actions.map(a=>'<li><strong>'+escapeHtml(a.title)+'</strong> — '+escapeHtml(a.details)+'</li>').join('')+'</ul>'+
    '<p class="muted">'+escapeHtml(plan.caveat)+'</p>'+
    (contactBlocked?'<p><strong>Contact suppressed. Do not schedule outreach.</strong></p>':
     '<form id="sbcV5FollowUpForm" class="form-grid" aria-label="Record internal CRM follow-up">'+
      '<label>Next follow-up date<input name="dueDate" type="date" min="'+escapeHtml(localToday())+'" required></label>'+ 
      '<label class="wide">Specific account follow-up reason<textarea name="purpose" rows="2" minlength="12" maxlength="500" required placeholder="Document the confirmed next step; no customer message will be sent."></textarea></label>'+ 
      '<button type="submit" class="button secondary" id="sbcV5ManualFollowUp">Save internal follow-up</button></form>')+
    '<p id="sbcV5PlanStatus" role="status" class="muted">Recommendations are not orders or verified revenue.</p>';
   const action=$('sbcV5ManualFollowUp'),form=$('sbcV5FollowUpForm');
   form?.addEventListener('submit',async event=>{
    event.preventDefault();
    if(state.selected!==id)return;
    const date=String(form.elements.dueDate.value||'');
    const purpose=String(form.elements.purpose.value||'').trim();
    const note=$('sbcV5PlanStatus');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<localToday()||purpose.length<12||purpose.length>500){
     note.textContent='Choose a current or future date and enter a specific reason (12–500 characters).';return;
    }
    action.disabled=true;note.textContent='Saving the CRM follow-up with assignment and suppression checks…';
    try{
     const answer=await fetch('/api/v6606/crm/account-portfolios/'+encodeURIComponent(id)+'/follow-up',
      {method:'POST',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json'},
       body:JSON.stringify({dueDate:date,purpose:purpose.trim()})});
     const saved=await answer.json().catch(()=>({}));
     if(!answer.ok||saved.ok!==true||saved.durable!==true)throw Error(saved.code||'FOLLOW_UP_NOT_CONFIRMED');
     note.textContent='Verified: internal CRM follow-up saved for '+saved.followUp+'. No call or message was sent.';
    }catch(error){note.textContent='Not saved: '+String(error.message||error)+'. Confirm ownership and account status.'}
    finally{action.disabled=false}
   });
  }catch(error){if(state.selected===id)host.textContent='V5 account plan unavailable or access denied: '+String(error.message||error)}
 }
 async function loadHandoffs(){state.handoffs=await api('/api/account-social/v1/research/queue');renderHandoffs();}
 function renderHandoffs(){const list=$('handoffList');list.innerHTML=state.handoffs.length?state.handoffs.map(h=>`<article class="handoff-row"><div><h3>${escapeHtml(h.customerId)}</h3><span class="tag">${escapeHtml(h.status)}</span><p class="muted">${escapeHtml(h.summary||'')}</p><p class="muted">Researcher: ${escapeHtml(h.researcherId)} · Manager: ${escapeHtml(h.managerId||'Awaiting assignment')}</p>${h.retryNotBefore?`<p class="muted">No phone retry before ${escapeHtml(h.retryNotBefore)}</p>`:''}</div><div class="controls">${h.status==='READY_FOR_REVIEW'&&state.role==='owner'?`<button class="button secondary" data-action="assign" data-id="${escapeHtml(h.id)}">Assign manager</button>`:''}${h.status==='ASSIGNED'?`<button class="button secondary" data-action="return" data-id="${escapeHtml(h.id)}">Return for research</button>`:''}</div></article>`).join(''):'<p class="empty">No handoff records for this account. Research remains in Lorna’s own workstation.</p>';}
 async function socialLoad(){const select=$('socialCustomer');if(!select.value&&state.accounts.length)select.value=state.accounts[0].id;
  const id=select.value;if(!id){$('socialList').innerHTML='<p class="empty">Assign a customer account first.</p>';return;}
  const [channels,posts]=await Promise.all([api(`/api/account-social/v1/accounts/${encodeURIComponent(id)}/channels`),api(`/api/account-social/v1/accounts/${encodeURIComponent(id)}/posts`)]);
  state.channels=channels||[];state.posts=posts||[];
  $('socialChannel').innerHTML=state.channels.length?state.channels.map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.platform)} · ${escapeHtml(c.providerAccountId)} · ${escapeHtml(c.status)}</option>`).join(''):'<option value="">No authorized social account</option>';
  $('socialList').innerHTML=state.posts.length?state.posts.map(p=>`<article class="post-row"><div><span class="tag">${escapeHtml(p.platform)} · ${escapeHtml(p.status)}</span><p>${escapeHtml(p.body)}</p><p class="muted">Created ${escapeHtml(p.createdAt||'')} · Approval ${escapeHtml(p.approvedBy||'Required')}</p></div><div class="controls">${p.status==='DRAFT'?`<button class="button secondary" data-action="submit" data-id="${escapeHtml(p.id)}">Submit for approval</button>`:''}${p.status==='PENDING_APPROVAL'&&state.role==='owner'?`<button class="button secondary" data-action="approve" data-id="${escapeHtml(p.id)}">Owner approve</button>`:''}${p.status==='APPROVED'&&state.role==='owner'?`<button class="button" data-action="schedule" data-id="${escapeHtml(p.id)}">Schedule</button>`:''}</div></article>`).join(''):'<p class="empty">No posts for this customer. Create a draft only after you have verified the business details.</p>';
 }
 async function action(name,id){try{state.busy=true;message('');
  if(['approve','schedule','assign'].includes(name)&&state.role!=='owner')throw Error('OWNER_APPROVAL_REQUIRED');if(name==='open-account'){openAccount(id);return;}
  if(name==='submit'){await api(`/api/account-social/v1/posts/${encodeURIComponent(id)}/submit`,{method:'POST'});message('Post submitted to owner approval.');await socialLoad();return;}
  if(name==='approve'){await api(`/api/account-social/v1/posts/${encodeURIComponent(id)}/approve`,{method:'POST'});message('Post approved; not yet published.');await socialLoad();return;}
  if(name==='schedule'){const val=window.prompt('Schedule ISO-8601 time with timezone (example: 2026-12-01T14:00:00-05:00):');if(!val)return;await api(`/api/account-social/v1/posts/${encodeURIComponent(id)}/schedule`,{method:'POST',body:{scheduledAt:val}});message('Scheduled. Publishing remains guarded by verified server permissions.');await socialLoad();return;}
  if(name==='assign'){const managerId=window.prompt('Enter the verified account-manager staff ID:');if(!managerId)return;await api(`/api/account-social/v1/research/handoffs/${encodeURIComponent(id)}/assign`,{method:'POST',body:{managerId}});message('Account manager assigned.');await load();return;}
  if(name==='return'){const issue=window.prompt('Issue code: BAD_NUMBER, MISSING_CONTACT, INCORRECT_BUSINESS or SOURCE_CONFLICT');if(!issue)return;const reason=window.prompt('Explain the issue with specifics so Lorna can research efficiently:');if(!reason)return;await api(`/api/account-social/v1/research/handoffs/${encodeURIComponent(id)}/return`,{method:'POST',body:{issue,reason}});message('Feedback returned to researcher; existing account preserved.');await load();return;}
 }catch(e){message('Action not completed: '+e.message,true)}finally{state.busy=false;}}
 document.querySelectorAll('[data-t]').forEach(x=>x.dataset.en=x.textContent);
 document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>page(b.dataset.view)));
 $('refresh').addEventListener('click',load);$('sbcAccountSearch').addEventListener('input',renderAccountGrid);$('closeDetail').addEventListener('click',()=>{$('accountDetail').hidden=true});
 $('noteForm').addEventListener('submit',async e=>{e.preventDefault();if(!state.selected)return;
  try{const form=e.target,summary=form.elements.summary.value.trim(),id=state.selected;
   if(state.role==='account_manager'){
    if(summary.length<12)throw Error('Write a specific account note of at least 12 characters.');
    const response=await fetch('/api/v6606/crm/account-portfolios/'+encodeURIComponent(id)+'/note',
     {method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({note:summary})});
    const saved=await response.json().catch(()=>({}));
    if(!response.ok||saved.ok!==true||saved.durable!==true)throw Error(saved.code||'NOTE_NOT_PERSISTED');
    form.reset();await loadAccountHistoryV5(id);message('CRM account note saved. No customer message sent.');
   }else{
    await api('/api/account-social/v1/accounts/'+encodeURIComponent(id)+'/interactions',{method:'POST',body:{kind:'note',summary}});
    form.reset();await load();message('Account timeline updated.');
   }
  }catch(error){message(error.message,true)}
 });
 $('sbcManagerOutcomeForm').addEventListener('submit',submitQuickOutcome);
 $('sbcManagerOutcomeForm').elements.outcome.addEventListener('change',()=>{ $('sbcQuickStatus').dataset.saved='';updateQuickForm();});
 $('socialCustomer').addEventListener('change',()=>socialLoad().catch(e=>message(e.message,true)));
 $('socialForm').addEventListener('submit',async e=>{e.preventDefault();try{const f=e.target;
  await api('/api/account-social/v1/posts',{method:'POST',body:{channelId:f.elements.channelId.value,body:f.elements.body.value,mediaUrl:f.elements.mediaUrl.value,ctaUrl:f.elements.ctaUrl.value}});
  f.elements.body.value='';f.elements.mediaUrl.value='';f.elements.ctaUrl.value='';await socialLoad();message('Draft saved. No public post was sent.');}catch(error){message('Draft not saved: '+error.message,true)}});
 document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!state.busy)action(b.dataset.action,b.dataset.id)});
 ['en','es'].forEach(lang=>{$('lang-'+lang).addEventListener('click',()=>{state.lang=lang;document.documentElement.lang=lang;document.querySelectorAll('[data-t]').forEach(x=>{x.textContent=dict[lang]?.[x.dataset.t]||x.dataset.en});$('lang-en').setAttribute('aria-pressed',String(lang==='en'));$('lang-es').setAttribute('aria-pressed',String(lang==='es'));page(state.view);renderAccountGrid()});});
 page('accounts');load();
})();
