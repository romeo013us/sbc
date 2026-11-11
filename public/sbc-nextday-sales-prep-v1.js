/* SBC Sales Follow-Up Prep — default seven-day lead review; existing API remains compatible. */
(function(){
 'use strict';
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const $=id=>document.getElementById(id);
 let rows=[],callers=[],busy=false,emailStatus={ready:false};
 const api=(p,o)=>window.api(p,o?{method:'POST',body:JSON.stringify(o),timeoutMs:20000}:{timeoutMs:20000});
 function nextWeekDate(){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const m=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  let d=new Date(Date.UTC(+m.year,+m.month-1,+m.day+7,12));
  while(d.getUTCDay()===0||d.getUTCDay()===6)d.setUTCDate(d.getUTCDate()+1);
  return d.toISOString().slice(0,10);
 }
 function msg(v,bad){if($('sbc-nextday-note')){$('sbc-nextday-note').textContent=v;$('sbc-nextday-note').style.color=bad?'#e88b86':'';}}
 function candidate(r){
  return '<label style="display:block;padding:10px;border:1px solid var(--border,#64748b);border-radius:8px;margin-bottom:7px">'+
   '<input type="checkbox" data-sbc-nextday-lead="'+esc(r.id)+'" checked> <strong>'+esc(r.businessName)+'</strong> · '+esc(r.phone)+
   '<div style="opacity:.8;font-size:12px;padding-left:24px">Source: '+esc(r.source||'Not recorded')+' · '+esc(r.industry||'Business')+
   ' · '+(r.email?'Email draft available':'No valid email')+' · '+(r.marketingConsentVerified?'Marketing opt-in on record':'No marketing opt-in recorded')+' · '+(r.demo?.ready?'Website preview ready':'Demo not recorded')+'</div></label>'+ 
   (r.email?'<button type="button" class="btn" data-sbc-copy-draft="'+esc(r.id)+'">Copy individual email draft</button>':'');
 }
 function fill(){
  const list=$('sbc-nextday-candidates');if(list)list.innerHTML=rows.length?rows.map(candidate).join(''):'<p>No verified, call-ready leads currently available in this selection. Review the CRM reasons below. No leads were deleted or contacted.</p>';
  const select=$('sbc-nextday-caller');if(select)select.innerHTML='<option value="">Owner / unassigned</option>'+callers.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('');
  const preview=$('sbc-nextday-email-draft');if(preview)preview.value=rows[0]?'Subject: '+rows[0].draft.subject+'\n\n'+rows[0].draft.text:'No email draft available.';
 }
 
 function priorityLine(p){
  const label=p.kind==='APPOINTMENT_REQUEST'?'Appointment requested — schedule review':p.kind==='APPOINTMENT'?'Scheduled appointment':'Follow-up';
  const at=new Date(p.dueAt);
  const when=Number.isFinite(at.getTime())?at.toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):p.dueAt;
  const late=Number.isFinite(at.getTime())&&at.getTime()<=Date.now();
  const mark=late?'<strong style="color:#c16927">Due / overdue</strong> · ':'';
  const scheduler=p.kind==='APPOINTMENT_REQUEST'?
   '<details><summary>Confirm customer appointment</summary>'+
   '<label>Confirmed start (your device time zone)<input type="datetime-local" data-apt-start="'+esc(p.customerId)+'"></label>'+
   '<label><input type="checkbox" data-apt-confirm="'+esc(p.customerId)+'"> Customer explicitly confirmed the time</label>'+
   '<button type="button" class="btn" data-apt-create="'+esc(p.customerId)+'">Schedule appointment</button></details>':'';
  return '<div style="padding:10px;margin:8px 0;border:1px solid var(--border,#64748b);border-radius:8px">'+
   mark+'<strong>'+esc(label)+'</strong> · '+esc(p.businessName)+'<div>'+esc(when)+' · '+esc(p.description)+'</div>'+scheduler+'</div>';
 }
 async function scheduleAppointment(id){
  const raw=document.querySelector('input[data-apt-start="'+id+'"]')?.value;
  const agreed=document.querySelector('input[data-apt-confirm="'+id+'"]')?.checked;
  if(!raw||!agreed)return msg('Confirm an agreed appointment time with the customer before booking.',true);
  const iso=new Date(raw);
  if(!Number.isFinite(iso.getTime())||iso.getTime()<=Date.now())return msg('Choose a valid future time.',true);
  if(!window.confirm('Record a CONFIRMED appointment at '+iso.toLocaleString()+'? This saves a calendar appointment and owner reminder task but does not invite the customer.'))return;
  try{
   const r=await api('/api/owner/nextday/appointment',{customerId:id,startAt:iso.toISOString(),customerConfirmed:true});
   if(!r?.ok)throw Error(r?.error||'Appointment was not saved');
   msg('Appointment saved and reminder task added. No customer notification was sent.');
   await load();
  }catch(e){msg('No appointment confirmed: '+String(e.message||e),true);}
 }
async function load(){
  msg('Loading eligible CRM leads and existing call tasks…');
  try{
   const n=Math.max(1,Math.min(20,Number($('sbc-nextday-limit')?.value||10)));
   const [v,q,p,em]=await Promise.all([api('/api/owner/nextday/preview?limit='+n),api('/api/owner/nextday/queue'),api('/api/owner/nextday/priorities'),api('/api/owner/nextday/email-status')]);
   if(!v?.ok||!q?.ok||!p?.ok||!em?.ok)throw Error('Production data unavailable');
   rows=v.candidates||[];callers=v.callers||[];emailStatus=em;fill();
   const stats=v.candidateDiagnostics||{},summary=$('sbc-nextday-lead-diagnostics'),review=$('sbc-nextday-review-list');
   if(summary){
    const labels=[
      ['total','CRM records'],['ready','Verified + call-ready'],['queued','Already in outbound queue'],
      ['needs_verification','Need Lead Assist/owner verification'],
      ['needs_research','Need more business details'],
      ['phone_missing','Missing usable phone'],['suppressed','Suppressed / do-not-contact'],
      ['synthetic','Internal test records'],['identity_missing','Missing business identity']
    ];
    summary.replaceChildren();
    labels.forEach(([key,label])=>{
      const div=document.createElement('div');div.style.padding='6px 10px';
      const num=document.createElement('strong');num.textContent=String(Number(stats[key]||0));
      div.append(num,document.createTextNode(' · '+label));summary.append(div);
    });
   }
   if(review){
    const pending=v.researchReview||[];
    review.replaceChildren();
    if(!pending.length){review.textContent='No research/verification exceptions in the sampled list.';}
    else pending.forEach(item=>{
     const p=document.createElement('p');p.style.margin='8px 0';
     const strong=document.createElement('strong');strong.textContent=item.businessName||'Unnamed lead';
     p.append(strong,document.createTextNode(' — '+(item.nextAction||item.reason||'Review CRM')+
       ' · '+(item.quality||'Not classified')));
     review.append(p);
    });
   }

   $('sbc-nextday-candidates')?.querySelectorAll('[data-sbc-copy-draft]').forEach(btn=>
     btn.addEventListener('click',async()=>{
       const lead=rows.find(x=>String(x.id)===String(btn.dataset.sbcCopyDraft));
       if(!lead?.email||!lead.draft)return;
       const draft='To: '+lead.email+'\nSubject: '+lead.draft.subject+'\n\n'+lead.draft.text;
       try{await navigator.clipboard.writeText(draft);msg('Copied an individual draft for manual review. Nothing was sent. Check current opt-outs, address and compliance before sending.')}
       catch(_){window.prompt('Copy this individual draft; no email has been sent:',draft)}
     }));

   const readiness=$('sbc-nextday-email-readiness');if(readiness)readiness.textContent=em.ready?
    'Marketing sender configured for consented campaigns. Owner approval still required.':
    'Automatic marketing send disabled: '+[!em.enabled?'disabled':null,!em.apiKeyReady?'provider key':null,!em.senderAttested?'sender verification':null,!em.unsubscribeGroupReady?'unsubscribe group':null,!em.postalAddressReady?'postal address':null,!em.privacyPolicyReady?'privacy policy':null].filter(Boolean).join(', ')+'. Drafts and call prep still work.';
   const due=$('sbc-nextday-priorities');
   if(due)due.innerHTML='<p><strong>'+p.dueCount+' due or overdue</strong> · '+p.appointmentRequests+' appointment requests need review. Earliest due first.</p>'+
    ((p.records||[]).slice(0,30).map(priorityLine).join('')||'<p>No scheduled appointments or follow-ups found.</p>');
   due?.querySelectorAll('[data-apt-create]').forEach(el=>el.addEventListener('click',()=>scheduleAppointment(el.dataset.aptCreate)));
   const queue=$('sbc-nextday-queue');
   if(queue)queue.innerHTML=(q.records||[]).slice(0,25).map(outreachTask).join('')||
    '<p>No previously prepared calls.</p>';
   queue?.querySelectorAll('[data-sbc-send-task]').forEach(b=>b.addEventListener('click',()=>sendOne(b.dataset.sbcSendTask)));
   queue?.querySelectorAll('[data-sbc-record-consent]').forEach(b=>b.addEventListener('click',()=>recordConsent(b.dataset.sbcRecordConsent)));
   queue?.querySelectorAll('[data-sbc-record-reply]').forEach(b=>b.addEventListener('click',()=>recordReply(b.dataset.sbcRecordReply)));
   msg(rows.length+' eligible leads shown. Consent and email provider checks remain enforced.');
  }catch(e){msg('Unable to load authoritative CRM data: '+String(e.message||e),true);}
 }

 function outreachTask(t){
  const status=t.outboundEmailStatus||'DRAFT_ONLY',eligible=t.marketingConsentVerified&&emailStatus.ready;
  const send=eligible&&!/^(PROVIDER_ACCEPTED|SUBMISSION_)/.test(status)?
   '<button type="button" class="btn" data-sbc-send-task="'+esc(t.id)+'">Send approved email (consented)</button>':
   '<small>'+esc(t.marketingConsentVerified?'Sending blocked or already attempted: '+status:'No direct marketing opt-in evidence on record')+'</small>';
  return '<div style="padding:10px;border-top:1px solid var(--border,#64748b)"><strong>'+esc(t.customerName)+
   '</strong> · '+esc(t.dueAt?.slice(0,10))+' · '+esc(t.status)+' · '+esc(t.assignedToName||'Unassigned')+
   '<div><small>Email: '+esc(status)+' · Reply: '+esc(t.replyStatus||'not recorded')+'</small></div>'+
   '<details><summary>Draft, contact history & actions</summary>'+
   '<pre style="white-space:pre-wrap;font:inherit;font-size:12px">'+esc(t.notes||'')+'</pre>'+
   '<div style="padding:8px 0">'+send+'</div>'+
   '<details><summary>Record documented marketing opt-in</summary>'+
   '<p><small>Record only permission SBC directly obtained. Publicly listed addresses, scraped emails and assumed consent do not qualify.</small></p>'+
   '<label>Consent source / evidence<input type="text" data-sbc-consent-source="'+esc(t.customerId)+'" placeholder="e.g. SBC signup form submission record"></label>'+
   '<label>Date consent obtained<input type="date" data-sbc-consent-date="'+esc(t.customerId)+'"></label>'+
   '<label>Method<select data-sbc-consent-method="'+esc(t.customerId)+'"><option value="signup_form">Our signup form</option><option value="customer_request">Customer explicitly requested emails</option><option value="documented_opt_in">Other documented direct opt-in</option></select></label>'+
   '<label><input type="checkbox" data-sbc-consent-proof="'+esc(t.customerId)+'"> I verified direct affirmative consent and have supporting evidence.</label>'+
   '<button type="button" class="btn" data-sbc-record-consent="'+esc(t.customerId)+'">Record consent evidence</button></details>'+
   '<details><summary>Record an actual email reply</summary><p><small>This does NOT read the inbox. Confirm you have seen the reply.</small></p>'+
   '<select data-sbc-reply-kind="'+esc(t.id)+'"><option value="INTERESTED">Interested</option><option value="APPOINTMENT_REQUEST">Requests appointment</option><option value="NOT_INTERESTED">Not interested</option><option value="UNSUBSCRIBE">Unsubscribe</option><option value="BOUNCE">Bounced</option></select>'+
   '<textarea data-sbc-reply-notes="'+esc(t.id)+'" rows="2" placeholder="Short factual note about the real reply"></textarea>'+
   '<button type="button" class="btn" data-sbc-record-reply="'+esc(t.id)+'">Record verified reply</button></details>'+
   '</details></div>';
 }
 async function sendOne(taskId){
  if(busy)return;
  if(!window.confirm('Approve one marketing email from info@sbcmia.com to this customer? Requires documented direct opt-in, authenticated sender, provider readiness and opt-out support. Provider acceptance is not delivery.'))return;
  busy=true;
  try{
   const out=await api('/api/owner/nextday/send/'+encodeURIComponent(taskId),
    {confirm:'OWNER_APPROVES_CONSENTED_EMAIL'});
   if(!out?.ok)throw Error(out?.error||'Email not confirmed');
   await load();msg('Email ACCEPTED by provider, delivery unconfirmed. Check actual reply/delivery status.');
  }catch(e){msg('Email was not confirmed: '+String(e.message||e)+'. Inspect provider status; do not blindly retry.',true)}
  finally{busy=false}
 }
 async function recordConsent(customerId){
  const src=document.querySelector('[data-sbc-consent-source="'+customerId+'"]')?.value||'';
  const date=document.querySelector('[data-sbc-consent-date="'+customerId+'"]')?.value||'';
  const method=document.querySelector('[data-sbc-consent-method="'+customerId+'"]')?.value||'';
  const verified=document.querySelector('[data-sbc-consent-proof="'+customerId+'"]')?.checked;
  if(!verified||!src||!date)return msg('Direct opt-in evidence, date, and confirmation are required.',true);
  if(!window.confirm('Confirm SBC has actual direct opt-in proof for this contact? Do not record consent from a scraped/publicly listed address alone.'))return;
  try{
   const out=await api('/api/owner/nextday/consent/'+encodeURIComponent(customerId),
    {source:src,method,obtainedAt:new Date(date+'T12:00:00Z').toISOString(),
     confirm:'OWNER_HAS_DIRECT_OPT_IN_PROOF'});
   if(!out?.ok)throw Error(out?.error||'Consent not recorded');
   await load();msg('Consent evidence saved. Send remains owner-approved and provider-gated.');
  }catch(e){msg('Consent not saved: '+String(e.message||e),true)}
 }
 async function recordReply(taskId){
  const kind=document.querySelector('[data-sbc-reply-kind="'+taskId+'"]')?.value;
  const notes=document.querySelector('[data-sbc-reply-notes="'+taskId+'"]')?.value||'';
  if(!window.confirm('Confirm you actually received this email reply and classify it as '+kind+'? No customer email is generated.'))return;
  try{
   const out=await api('/api/owner/nextday/reply/'+encodeURIComponent(taskId),
    {kind,notes,confirm:'OWNER_VERIFIED_REAL_REPLY'});
   if(!out?.ok)throw Error(out?.error||'Reply not saved');
   await load();msg('Reply recorded in the CRM; appointment requests appear in due-first review.');
  }catch(e){msg('Reply not recorded: '+String(e.message||e),true)}
 }

 async function prepare(){
  if(busy)return;
  const chosen=Array.from(document.querySelectorAll('input[data-sbc-nextday-lead]:checked')).map(x=>x.getAttribute('data-sbc-nextday-lead'));
  if(!chosen.length)return msg('Select at least one eligible lead.',true);
  if(!$('sbc-nextday-reviewed')?.checked)return msg('Owner must confirm contact/source review before preparing calls.',true);
  const date=$('sbc-nextday-date')?.value;
  if(!window.confirm('Create '+chosen.length+' follow-up call tasks for '+date+'? Emails remain DRAFT ONLY. Nothing will be sent.'))return;
  busy=true;const b=$('sbc-nextday-submit');if(b)b.disabled=true;
  try{
   const r=await api('/api/owner/nextday/prepare',{leadIds:chosen,callDate:date,
    assignedTo:$('sbc-nextday-caller')?.value||'',confirm:'OWNER_REVIEWED_PREP'});
   if(!r?.ok)throw Error(r?.error||'Unable to confirm task persistence');
   msg('Saved '+r.created+' call tasks. '+r.skipped+' duplicates skipped. NO EMAILS SENT.');
   await load();
  }catch(e){msg('Call prep not confirmed: '+String(e?.message||e)+'. Check Tasks before retrying.',true);}
  finally{busy=false;if(b)b.disabled=false;}
 }
 window.sbcOpenNextDaySalesPrep=function(){
  // The server enforces authenticated owner-only endpoints; don't rely on a client global for authorization.
  if(typeof window.openModal!=='function'||typeof window.api!=='function')return;
  window.openModal('Plan Next Week · SBC Sales',
   '<p><strong>Owner-reviewed lead preparation.</strong> Select verified prospects, assign a caller, and create next-week follow-up tasks. Introductory emails are only drafts; no mass emails or auto calls are sent.</p>'+
   '<div class="form-grid"><label>Review up to<select id="sbc-nextday-limit"><option>10</option><option>15</option><option>20</option></select></label>'+
   '<label>Call day<input id="sbc-nextday-date" type="date" required></label>'+
   '<label>Assign to<select id="sbc-nextday-caller"></select></label></div>'+
   '<button type="button" class="btn" id="sbc-nextday-refresh">Refresh candidates</button>'+
   '<p id="sbc-nextday-email-readiness" role="status">Checking email provider readiness…</p>'+ 
   '<h3>Appointments, callbacks and due work</h3><div id="sbc-nextday-priorities"></div>'+ 
   '<h3>CRM readiness overview</h3><div id="sbc-nextday-lead-diagnostics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:4px;border:1px solid var(--border,#64748b);border-radius:8px;padding:8px"></div>'+ 
   '<h3>Verified prospects ready for owner review</h3><div id="sbc-nextday-candidates"></div>'+ 
   '<details><summary>Research and verification needed</summary><div id="sbc-nextday-review-list"></div></details>'+
   '<h3>Example email · preview only</h3><textarea id="sbc-nextday-email-draft" readonly rows="12" style="width:100%"></textarea>'+
   '<p><label><input id="sbc-nextday-reviewed" type="checkbox"> I reviewed lead sources, DNC/opt-outs, applicable calling permissions, and your selected follow-up date and contact restrictions.</label></p>'+
   '<button type="button" class="btn primary" id="sbc-nextday-submit">Prepare Follow-Up Call Tasks</button>'+
   '<p id="sbc-nextday-note" role="status"></p><h3>Prepared queue</h3><div id="sbc-nextday-queue"></div>'+
   '<p><small>Using info@sbcmia.com for public communication drafts. Provide verified mailing address and approved sending policy before enabling commercial email delivery.</small></p>');
  if($('sbc-nextday-date'))$('sbc-nextday-date').value=nextWeekDate();
  $('sbc-nextday-refresh')?.addEventListener('click',load);
  $('sbc-nextday-limit')?.addEventListener('change',load);
  $('sbc-nextday-submit')?.addEventListener('click',prepare);
  load();
 };

 // Low-cost in-app due alert: read-only; does not email, text or auto-dial anyone.
 async function refreshDueAlert(){
  const nav=$('sbc-nextday-nav-link');
  if(!nav||$('app')?.classList.contains('hidden'))return;
  try{
   const p=await api('/api/owner/nextday/priorities');
   if(!p?.ok)return;
   const n=Number(p.dueCount||0);
   nav.textContent=n>0?'☎ Plan Next Week · '+n+' need review':'☎ Plan Next Week';
   nav.setAttribute('aria-label',n>0?n+' SBC sales items need review':'Plan sales follow-ups');
  }catch(_){ /* no false zero on failed status read */ }
 }
 window.addEventListener('focus',refreshDueAlert);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDueAlert();});
 setInterval(refreshDueAlert,300000);
 setTimeout(refreshDueAlert,4000);
 document.addEventListener('click',e=>{const b=e.target?.closest?.('#sbc-nextday-nav-link');if(b){e.preventDefault();window.sbcOpenNextDaySalesPrep();}});
})();
