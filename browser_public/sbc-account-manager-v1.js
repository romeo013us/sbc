/* SBC Account Management OS — authenticated tenant server owns every record.
 * Browser stores no customer details. All writes are server-authorized.
 */
(()=>{'use strict';
 const $=id=>document.getElementById(id),state={view:'accounts',accounts:[],handoffs:[],channels:[],posts:[],selected:null,lang:'en',role:'',busy:false};
 const dict={es:{accounts:'Mis cuentas',handoffs:'Transferencias de investigación',social:'Estudio de redes',controls:'Seguridad y controles',connected:'Conectado al CRM de SBC',back:'Centro de mando',refresh:'Actualizar',portfolio:'Cartera de clientes asignados',portfolioHelp:'Cada contacto pertenece a una empresa con un administrador responsable.',researchQueue:'Investigación → Gestión de cuentas',researchHelp:'Los clientes potenciales verificados se revisan antes de asignarse.',contentStudio:'Estudio de redes sociales',contentHelp:'Prepare publicaciones para Facebook e Instagram. El dueño autoriza cada publicación.',safety:'Controles operativos',customer:'Cliente',channel:'Cuenta social autorizada',caption:'Texto de la publicación',media:'URL pública HTTPS de la imagen (requerida para Instagram)',link:'URL de destino',createDraft:'Crear borrador',contentQueue:'Publicaciones y aprobaciones',note:'Nota de cuenta',saveNote:'Guardar nota',timeline:'Historial de relaciones'}};
 const t=k=>dict[state.lang]?.[k]||document.querySelector(`[data-t="${k}"]`)?.dataset.en||k;
 const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
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
 async function load(){message('');try{
  const p=await api('/api/account-social/v1/portfolio');state.accounts=p.accounts||[];
  const q=await api('/api/account-social/v1/research/queue');state.handoffs=q||[];
  state.role=state.role||'restricted';$('rolePill').textContent='AUTHORIZED · TENANT '+p.tenantId;
  $('metrics').innerHTML=[['Managed accounts',state.accounts.length],['Research handoffs',state.handoffs.length],['DNC / suppressions',state.accounts.filter(x=>x.doNotContact).length],['Connected channels','Verify in Social Studio']].map(([label,v])=>`<div class="metric"><strong>${escapeHtml(v)}</strong><small>${escapeHtml(label)}</small></div>`).join('');
  $('accountGrid').innerHTML=state.accounts.length?state.accounts.map(a=>`<article class="account-card"><span class="status">${escapeHtml(a.status||'Account')}</span><h3>${escapeHtml(a.businessName)}</h3><div class="meta">Account: ${escapeHtml(a.id)}</div><div class="meta">${escapeHtml(a.phone||'No verified phone')}</div><button class="button secondary" data-action="open-account" data-id="${escapeHtml(a.id)}">Open account</button></article>`).join(''):'<p class="empty">No accounts have been assigned to your authenticated session. No sample customer data is displayed.</p>';
  $('socialCustomer').innerHTML=accountOptions();renderHandoffs();if(state.selected)openAccount(state.selected);if(state.view==='social')await socialLoad();
 }catch(e){$('accountGrid').innerHTML='<p class="empty">Account data could not be verified. Check your login or ask the owner to enable the workstation.</p>';message('Workspace unavailable: '+e.message,true);$('rolePill').textContent='NOT AUTHORIZED';}}
 function openAccount(id){const a=state.accounts.find(x=>x.id===id);if(!a)return;state.selected=id;
  $('accountDetail').hidden=false;$('detailTitle').textContent=a.businessName;
  $('accountFacts').innerHTML=`<p class="muted">Manager: ${escapeHtml(a.managerId)} · CRM status: ${escapeHtml(a.status)} · ${a.doNotContact?'CONTACT SUPPRESSED':'Follow your documented consent and outreach policies'}</p>`;
  $('timeline').innerHTML=(a.timeline||[]).length?a.timeline.map(x=>`<div class="timeline-row"><span class="tag">${escapeHtml(x.kind)}</span> ${escapeHtml(x.summary)}<div class="muted">${escapeHtml(x.createdAt)}</div></div>`).join(''):'<p class="empty">No recorded account interactions yet.</p>';
  $('accountDetail').scrollIntoView({behavior:'smooth',block:'start'});
 }
 async function loadHandoffs(){state.handoffs=await api('/api/account-social/v1/research/queue');renderHandoffs();}
 function renderHandoffs(){const list=$('handoffList');list.innerHTML=state.handoffs.length?state.handoffs.map(h=>`<article class="handoff-row"><div><h3>${escapeHtml(h.customerId)}</h3><span class="tag">${escapeHtml(h.status)}</span><p class="muted">${escapeHtml(h.summary||'')}</p><p class="muted">Researcher: ${escapeHtml(h.researcherId)} · Manager: ${escapeHtml(h.managerId||'Awaiting assignment')}</p>${h.retryNotBefore?`<p class="muted">No phone retry before ${escapeHtml(h.retryNotBefore)}</p>`:''}</div><div class="controls">${h.status==='READY_FOR_REVIEW'?`<button class="button secondary" data-action="assign" data-id="${escapeHtml(h.id)}">Assign manager</button>`:''}${h.status==='ASSIGNED'?`<button class="button secondary" data-action="return" data-id="${escapeHtml(h.id)}">Return for research</button>`:''}</div></article>`).join(''):'<p class="empty">No handoff records for this account. Research remains in Lorna’s own workstation.</p>';}
 async function socialLoad(){const select=$('socialCustomer');if(!select.value&&state.accounts.length)select.value=state.accounts[0].id;
  const id=select.value;if(!id){$('socialList').innerHTML='<p class="empty">Assign a customer account first.</p>';return;}
  const [channels,posts]=await Promise.all([api(`/api/account-social/v1/accounts/${encodeURIComponent(id)}/channels`),api(`/api/account-social/v1/accounts/${encodeURIComponent(id)}/posts`)]);
  state.channels=channels||[];state.posts=posts||[];
  $('socialChannel').innerHTML=state.channels.length?state.channels.map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.platform)} · ${escapeHtml(c.providerAccountId)} · ${escapeHtml(c.status)}</option>`).join(''):'<option value="">No authorized social account</option>';
  $('socialList').innerHTML=state.posts.length?state.posts.map(p=>`<article class="post-row"><div><span class="tag">${escapeHtml(p.platform)} · ${escapeHtml(p.status)}</span><p>${escapeHtml(p.body)}</p><p class="muted">Created ${escapeHtml(p.createdAt||'')} · Approval ${escapeHtml(p.approvedBy||'Required')}</p></div><div class="controls">${p.status==='DRAFT'?`<button class="button secondary" data-action="submit" data-id="${escapeHtml(p.id)}">Submit for approval</button>`:''}${p.status==='PENDING_APPROVAL'?`<button class="button secondary" data-action="approve" data-id="${escapeHtml(p.id)}">Owner approve</button>`:''}${p.status==='APPROVED'?`<button class="button" data-action="schedule" data-id="${escapeHtml(p.id)}">Schedule</button>`:''}</div></article>`).join(''):'<p class="empty">No posts for this customer. Create a draft only after you have verified the business details.</p>';
 }
 async function action(name,id){try{state.busy=true;message('');if(name==='open-account'){openAccount(id);return;}
  if(name==='submit'){await api(`/api/account-social/v1/posts/${encodeURIComponent(id)}/submit`,{method:'POST'});message('Post submitted to owner approval.');await socialLoad();return;}
  if(name==='approve'){await api(`/api/account-social/v1/posts/${encodeURIComponent(id)}/approve`,{method:'POST'});message('Post approved; not yet published.');await socialLoad();return;}
  if(name==='schedule'){const val=window.prompt('Schedule ISO-8601 time with timezone (example: 2026-12-01T14:00:00-05:00):');if(!val)return;await api(`/api/account-social/v1/posts/${encodeURIComponent(id)}/schedule`,{method:'POST',body:{scheduledAt:val}});message('Scheduled. Publishing remains guarded by verified server permissions.');await socialLoad();return;}
  if(name==='assign'){const managerId=window.prompt('Enter the verified account-manager staff ID:');if(!managerId)return;await api(`/api/account-social/v1/research/handoffs/${encodeURIComponent(id)}/assign`,{method:'POST',body:{managerId}});message('Account manager assigned.');await load();return;}
  if(name==='return'){const issue=window.prompt('Issue code: BAD_NUMBER, MISSING_CONTACT, INCORRECT_BUSINESS or SOURCE_CONFLICT');if(!issue)return;const reason=window.prompt('Explain the issue with specifics so Lorna can research efficiently:');if(!reason)return;await api(`/api/account-social/v1/research/handoffs/${encodeURIComponent(id)}/return`,{method:'POST',body:{issue,reason}});message('Feedback returned to researcher; existing account preserved.');await load();return;}
 }catch(e){message('Action not completed: '+e.message,true)}finally{state.busy=false;}}
 document.querySelectorAll('[data-t]').forEach(x=>x.dataset.en=x.textContent);
 document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>page(b.dataset.view)));
 $('refresh').addEventListener('click',load);$('closeDetail').addEventListener('click',()=>{$('accountDetail').hidden=true});
 $('noteForm').addEventListener('submit',async e=>{e.preventDefault();if(!state.selected)return;try{const form=e.target,summary=form.elements.summary.value.trim();await api(`/api/account-social/v1/accounts/${encodeURIComponent(state.selected)}/interactions`,{method:'POST',body:{kind:'note',summary}});form.reset();await load();message('Account timeline updated.')}catch(error){message(error.message,true)}});
 $('socialCustomer').addEventListener('change',()=>socialLoad().catch(e=>message(e.message,true)));
 $('socialForm').addEventListener('submit',async e=>{e.preventDefault();try{const f=e.target;
  await api('/api/account-social/v1/posts',{method:'POST',body:{channelId:f.elements.channelId.value,body:f.elements.body.value,mediaUrl:f.elements.mediaUrl.value,ctaUrl:f.elements.ctaUrl.value}});
  f.elements.body.value='';f.elements.mediaUrl.value='';f.elements.ctaUrl.value='';await socialLoad();message('Draft saved. No public post was sent.');}catch(error){message('Draft not saved: '+error.message,true)}});
 document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!state.busy)action(b.dataset.action,b.dataset.id)});
 ['en','es'].forEach(lang=>{$('lang-'+lang).addEventListener('click',()=>{state.lang=lang;document.documentElement.lang=lang;document.querySelectorAll('[data-t]').forEach(x=>{x.textContent=dict[lang]?.[x.dataset.t]||x.dataset.en});$('lang-en').setAttribute('aria-pressed',String(lang==='en'));$('lang-es').setAttribute('aria-pressed',String(lang==='es'));page(state.view)});});
 page('accounts');load();
})();
