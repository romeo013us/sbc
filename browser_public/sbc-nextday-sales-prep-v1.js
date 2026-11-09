/* SBC Next-Day Sales Prep V1 — owner review and draft-only call planning. */
(function(){
 'use strict';
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const $=id=>document.getElementById(id);
 let rows=[],callers=[],busy=false;
 const api=(p,o)=>window.api(p,o?{method:'POST',body:JSON.stringify(o),timeoutMs:20000}:{timeoutMs:20000});
 function tomorrow(){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const m=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  let d=new Date(Date.UTC(+m.year,+m.month-1,+m.day+1,12));
  while(d.getUTCDay()===0||d.getUTCDay()===6)d.setUTCDate(d.getUTCDate()+1);
  return d.toISOString().slice(0,10);
 }
 function msg(v,bad){if($('sbc-nextday-note')){$('sbc-nextday-note').textContent=v;$('sbc-nextday-note').style.color=bad?'#e88b86':'';}}
 function candidate(r){
  return '<label style="display:block;padding:10px;border:1px solid var(--border,#64748b);border-radius:8px;margin-bottom:7px">'+
   '<input type="checkbox" data-sbc-nextday-lead="'+esc(r.id)+'" checked> <strong>'+esc(r.businessName)+'</strong> · '+esc(r.phone)+
   '<div style="opacity:.8;font-size:12px;padding-left:24px">Source: '+esc(r.source||'Not recorded')+' · '+esc(r.industry||'Business')+
   ' · '+(r.email?'Email draft available':'No valid email')+' · '+(r.demo?.ready?'Website preview ready':'Demo not recorded')+'</div></label>';
 }
 function fill(){
  const list=$('sbc-nextday-candidates');if(list)list.innerHTML=rows.length?rows.map(candidate).join(''):'<p>No eligible unqueued leads in this sample. Check lead verification, assignments, and suppression before preparing a batch.</p>';
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
   const [v,q,p]=await Promise.all([api('/api/owner/nextday/preview?limit='+n),api('/api/owner/nextday/queue'),api('/api/owner/nextday/priorities')]);
   if(!v?.ok||!q?.ok||!p?.ok)throw Error('Production data unavailable');
   rows=v.candidates||[];callers=v.callers||[];fill();
   const due=$('sbc-nextday-priorities');
   if(due)due.innerHTML='<p><strong>'+p.dueCount+' due or overdue</strong> · '+p.appointmentRequests+' appointment requests need review. Earliest due first.</p>'+
    ((p.records||[]).slice(0,30).map(priorityLine).join('')||'<p>No scheduled appointments or follow-ups found.</p>');
   due?.querySelectorAll('[data-apt-create]').forEach(el=>el.addEventListener('click',()=>scheduleAppointment(el.dataset.aptCreate)));
   const queue=$('sbc-nextday-queue');
   if(queue)queue.innerHTML=(q.records||[]).slice(0,12).map(t=>
    '<div style="padding:8px;border-top:1px solid var(--border,#64748b)"><strong>'+esc(t.customerName)+
    '</strong> · '+esc(t.dueAt?.slice(0,10))+' · '+esc(t.status)+' · '+esc(t.assignedToName||'Unassigned')+
    '<details><summary>Call instructions and unsent email draft</summary><pre style="white-space:pre-wrap;font:inherit;font-size:12px">'+esc(t.notes||'')+'</pre></details></div>').join('')||
    '<p>No previously prepared calls.</p>';
   msg(rows.length+' eligible leads shown. Email drafts are NOT sent. Review before preparing.');
  }catch(e){msg('Unable to load authoritative CRM data: '+String(e.message||e),true);}
 }
 async function prepare(){
  if(busy)return;
  const chosen=Array.from(document.querySelectorAll('input[data-sbc-nextday-lead]:checked')).map(x=>x.getAttribute('data-sbc-nextday-lead'));
  if(!chosen.length)return msg('Select at least one eligible lead.',true);
  if(!$('sbc-nextday-reviewed')?.checked)return msg('Owner must confirm contact/source review before preparing calls.',true);
  const date=$('sbc-nextday-date')?.value;
  if(!window.confirm('Create '+chosen.length+' next-day call tasks for '+date+'? Emails remain DRAFT ONLY. Nothing will be sent.'))return;
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
  window.openModal('Prepare Tomorrow · SBC Sales',
   '<p><strong>Owner-reviewed lead preparation.</strong> Select verified prospects, assign a caller, and create tomorrow’s tasks. Introductory emails are only drafts; no mass emails or auto calls are sent.</p>'+
   '<div class="form-grid"><label>Review up to<select id="sbc-nextday-limit"><option>10</option><option>15</option><option>20</option></select></label>'+
   '<label>Call day<input id="sbc-nextday-date" type="date" required></label>'+
   '<label>Assign to<select id="sbc-nextday-caller"></select></label></div>'+
   '<button type="button" class="btn" id="sbc-nextday-refresh">Refresh candidates</button>'+
   '<h3>Appointments, callbacks and due work</h3><div id="sbc-nextday-priorities"></div>'+ 
   '<h3>New prospects</h3><div id="sbc-nextday-candidates"></div>'+
   '<h3>Example email · preview only</h3><textarea id="sbc-nextday-email-draft" readonly rows="12" style="width:100%"></textarea>'+
   '<p><label><input id="sbc-nextday-reviewed" type="checkbox"> I reviewed lead sources, DNC/opt-outs, applicable calling permissions, and next-business-day timing.</label></p>'+
   '<button type="button" class="btn primary" id="sbc-nextday-submit">Prepare Next-Day Call Tasks</button>'+
   '<p id="sbc-nextday-note" role="status"></p><h3>Prepared queue</h3><div id="sbc-nextday-queue"></div>'+
   '<p><small>Using info@sbcmia.com for public communication drafts. Provide verified mailing address and approved sending policy before enabling commercial email delivery.</small></p>');
  if($('sbc-nextday-date'))$('sbc-nextday-date').value=tomorrow();
  $('sbc-nextday-refresh')?.addEventListener('click',load);
  $('sbc-nextday-limit')?.addEventListener('change',load);
  $('sbc-nextday-submit')?.addEventListener('click',prepare);
  load();
 };
 document.addEventListener('click',e=>{const b=e.target?.closest?.('#sbc-nextday-nav-link');if(b){e.preventDefault();window.sbcOpenNextDaySalesPrep();}});
})();
