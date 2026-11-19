/* SBC Appointment Workflow V1 — one CRM calendar across Call Center and Account 360.
 * User action only: saving an appointment never places a call, sends a message or creates a lead.
 */
(function(root,factory){
 'use strict';
 const lib=factory();
 if(typeof module==='object'&&module.exports)module.exports=lib;
 else{root.SBC_APPOINTMENTS=lib;lib.install(root);}
})(typeof window!=='undefined'?window:{},function(){
 'use strict';
 const escapeHtml=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const asDate=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d:null;};
 const localInput=value=>{const d=asDate(value);if(!d)return '';const z=n=>String(n).padStart(2,'0');return [d.getFullYear(),z(d.getMonth()+1),z(d.getDate())].join('-')+'T'+z(d.getHours())+':'+z(d.getMinutes());};
 const displayTime=value=>{const d=asDate(value);return d?d.toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):'Time not recorded';};
 function forCustomer(appointments,customerId){return (Array.isArray(appointments)?appointments:[]).filter(a=>String(a.customerId||'')===String(customerId||'')&&!!customerId).slice().sort((a,b)=>{
  const active=a.status==='Cancelled'?1:0,other=b.status==='Cancelled'?1:0;
  return active-other||((asDate(a.startAt)?.getTime()||0)-(asDate(b.startAt)?.getTime()||0));
 });}
 function payload(fields,isNew,now=Date.now()){
  const customerId=String(fields.customerId||'').trim(),title=String(fields.title||'').trim();
  const start=asDate(fields.startAt),end=asDate(fields.endAt);
  if(!customerId)throw Error('Choose an existing customer account.');
  if(!title||title.length>160)throw Error('Enter an appointment title (160 characters maximum).');
  if(!start||!end)throw Error('Choose valid start and end times.');
  if(isNew&&start.getTime()<now-60000)throw Error('Choose a future appointment time.');
  if(end<=start)throw Error('End time must be after the start time.');
  if(end.getTime()-start.getTime()>24*3600000)throw Error('Appointments cannot exceed 24 hours.');
  const result={customerId,title,startAt:start.toISOString(),endAt:end.toISOString(),
   location:String(fields.location||'').trim().slice(0,255),notes:String(fields.notes||'').trim().slice(0,3000)};
  if(!isNew){if(!['Scheduled','Completed','Cancelled'].includes(String(fields.status||'')))throw Error('Choose a valid appointment status.');result.status=fields.status;}
  return result;
 }
 function install(win){
  const doc=win.document;if(!doc||!win.MutationObserver)return;
  const getData=()=>{try{return win.state?.data||{};}catch{return {};}};
  const records=()=>Array.isArray(getData().appointments)?getData().appointments:[];
  const customers=()=>Array.isArray(getData().customers)?getData().customers:[];
  const canWrite=()=>['owner','manager','caller'].includes(String(win.state?.me?.role||''))&&!getData().readOnly&&!getData().recoveryRequired;
  const callHost=()=>doc.getElementById('sbcManualDialer');
  const accountHost=()=>doc.getElementById('sbcLeadAccount360');
  let callCustomer='',lastContext='',submitting=false,queued=false;
  const pickId=id=>customers().some(c=>String(c.id)===String(id))?String(id):'';
  function rows(customerId){
   const a=forCustomer(records(),customerId);
   return a.length?a.map(x=>'<div class="sbc-appt-row"><div><strong>'+escapeHtml(x.title||'Appointment')+'</strong>'+
    '<p>'+escapeHtml(displayTime(x.startAt))+(x.endAt?' – '+escapeHtml(displayTime(x.endAt)):'')+' · '+escapeHtml(x.status||'Scheduled')+'</p>'+
    (x.location?'<p>Location: '+escapeHtml(x.location)+'</p>':'')+
    (x.notes?'<p>Notes: '+escapeHtml(x.notes)+'</p>':'')+'</div>'+
    '<button type="button" class="btn small" data-sbc-appt-edit="'+escapeHtml(x.id)+'"'+(!canWrite()?' disabled':'')+'>Edit</button></div>').join(''):
    '<p class="mini">No appointments currently loaded for this account.</p>';
  }
  function mountAccount(){
   const host=accountHost();if(!host)return;
   const id=pickId(host.dataset.sbcLeadId);if(!id)return;
   let pane=host.querySelector('#sbcAccountAppointments');
   if(!pane){pane=doc.createElement('section');pane.id='sbcAccountAppointments';pane.className='sbc-profile-panel sbc-appt-account';
    (host.querySelector('.sbc-profile-columns')||host).prepend(pane);}
   const key=JSON.stringify([id,canWrite(),forCustomer(records(),id)]);
   if(pane.dataset.renderKey===key)return;
   pane.dataset.renderKey=key;
   pane.innerHTML='<div class="sbc-appt-heading"><div><h3>📅 Customer appointments</h3><p class="mini">Book, view and reschedule meetings linked to this account.</p></div>'+
    '<button type="button" class="btn primary" data-sbc-appt-new="'+escapeHtml(id)+'"'+(!canWrite()?' disabled':'')+'>+ Set appointment</button></div>'+rows(id)+
    '<p class="mini">SBC Calendar record only. No automatic invitation, call, email or text.</p>';
  }
  function mountCall(){
   const host=callHost();if(!host)return;
   let pane=doc.getElementById('sbcCallAppointments');
   if(!pane){pane=doc.createElement('section');pane.id='sbcCallAppointments';pane.className='sbc-appt-call';host.insertAdjacentElement('afterend',pane);}
   const all=customers();if(!pickId(callCustomer))callCustomer='';
   const key=JSON.stringify([callCustomer,canWrite(),all.map(c=>[c.id,c.businessName||c.contactName]),forCustomer(records(),callCustomer)]);
   if(pane.dataset.renderKey===key)return;
   pane.dataset.renderKey=key;
   const opts=all.slice().sort((a,b)=>String(a.businessName||a.contactName||'').localeCompare(String(b.businessName||b.contactName||''))).map(c=>
    '<option value="'+escapeHtml(c.id)+'"'+(String(c.id)===callCustomer?' selected':'')+'>'+escapeHtml(c.businessName||c.contactName||'Unnamed account')+'</option>').join('');
   pane.innerHTML='<div class="sbc-appt-heading"><div><h3>📅 Set an appointment</h3><p class="mini">After your call, link the meeting to a customer account so it appears in Account 360.</p></div></div>'+
    '<div class="sbc-appt-controls"><label for="sbcCallAppointmentCustomer">Customer account</label><select id="sbcCallAppointmentCustomer"><option value="">Select an existing customer</option>'+opts+'</select>'+
    '<button class="btn primary" type="button" data-sbc-appt-new="'+escapeHtml(callCustomer)+'"'+(!callCustomer||!canWrite()?' disabled':'')+'>+ Book appointment</button></div>'+
    (callCustomer?'<h4>Appointments for selected customer</h4>'+rows(callCustomer):'<p class="mini">Select a customer to view existing appointments or create a new one.</p>')+
    '<p class="mini">The dial pad can call numbers without a saved lead; booking requires an existing CRM account.</p>';
  }
  function refresh(){mountAccount();mountCall();}
  function selected(customerId){return customers().find(c=>String(c.id)===String(customerId));}
  function openEditor(customerId,appointmentId='',source='call'){
   if(!canWrite())return win.toast?.('Appointment changes are not available in read-only mode.');
   const a=appointmentId?records().find(x=>String(x.id)===String(appointmentId)):null;
   if(appointmentId&&!a)return win.toast?.('Appointment not in the current CRM view. Refresh.');
   customerId=String(a?.customerId||customerId||'');if(!selected(customerId))return win.toast?.('Choose a valid customer account first.');
   if(typeof win.openModal!=='function')return win.toast?.('Appointment editor is unavailable.');
   lastContext=source==='account'?customerId:'';
   const start=asDate(a?.startAt)||new Date(Math.ceil((Date.now()+3600000)/1800000)*1800000);
   const end=asDate(a?.endAt)||new Date(start.getTime()+30*60000);
   const status=a?.status||'Scheduled';
   win.openModal(a?'Edit appointment':'Schedule appointment','<form id="sbcAppointmentForm" class="sbc-appt-editor"><p><strong>Customer:</strong> '+escapeHtml(selected(customerId).businessName||selected(customerId).contactName||'Account')+'</p>'+
    '<input type="hidden" name="customerId" value="'+escapeHtml(customerId)+'"><div class="form-grid">'+
    '<label>Purpose / title<input name="title" maxlength="160" required value="'+escapeHtml(a?.title||'Customer appointment')+'"></label>'+
    '<label>Start date and time<input type="datetime-local" name="startAt" required value="'+escapeHtml(localInput(start))+'"></label>'+
    '<label>End date and time<input type="datetime-local" name="endAt" required value="'+escapeHtml(localInput(end))+'"></label>'+
    '<label>Location / method<input name="location" maxlength="255" value="'+escapeHtml(a?.location||'')+'" placeholder="Phone, office, video meeting"></label>'+
    (a?'<label>Status<select name="status">'+['Scheduled','Completed','Cancelled'].map(v=>'<option'+(v===status?' selected':'')+'>'+v+'</option>').join('')+'</select></label>':'')+
    '<label style="grid-column:1/-1">Notes<textarea name="notes" maxlength="3000" rows="3" placeholder="Agreed agenda, next step, or meeting details">'+escapeHtml(a?.notes||'')+'</textarea></label></div>'+
    '<p class="mini">Local time on this device. Saving updates SBC Calendar and the linked customer record. No automatic notifications are sent.</p>'+
    '<p role="alert" id="sbcApptFormError"></p><div class="actions"><button type="button" class="btn" id="sbcApptCancelEditor">Back</button><button type="submit" class="btn primary">'+(a?'Save changes':'Save appointment')+'</button></div></form>');
   const form=doc.getElementById('sbcAppointmentForm');if(!form)return;
   doc.getElementById('sbcApptCancelEditor').onclick=()=>{win.closeModal?.();if(lastContext)win.SBC_LEAD_PROFILE?.open(lastContext);};
   form.onsubmit=async ev=>{
    ev.preventDefault();if(submitting)return;
    const error=doc.getElementById('sbcApptFormError');let body;
    try{body=payload(Object.fromEntries(new FormData(form).entries()),!a);}catch(e){if(error)error.textContent=e.message;return;}
    if(String(body.customerId)!==String(customerId)){if(error)error.textContent='Account changed. Reopen the editor.';return;}
    if(typeof win.api!=='function'){if(error)error.textContent='SBC Calendar API is unavailable.';return;}
    submitting=true;const button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;
    try{
     const result=await win.api('/api/appointments'+(a?'/'+encodeURIComponent(a.id):''),{method:a?'PUT':'POST',body:JSON.stringify(body)});
     if(result?.error||result?.ok===false)throw Error(result.error||result.code||'Appointment was not confirmed.');
     win.closeModal?.();
     try{if(typeof win.load==='function')await win.load();}catch{win.toast?.('Appointment saved; refresh the page to see the latest calendar.');}
     if(lastContext&&win.SBC_LEAD_PROFILE?.open)await win.SBC_LEAD_PROFILE.open(lastContext);
     refresh();win.toast?.(a?'Appointment updated.':'Appointment saved to customer and calendar.');
    }catch(e){if(error)error.textContent='Could not confirm save: '+String(e.message||e);}
    finally{submitting=false;if(button&&button.isConnected)button.disabled=false;}
   };
  }
  function click(event){
   const btn=event.target.closest?.('[data-sbc-appt-new],[data-sbc-appt-edit]');if(!btn)return;
   if(!btn.closest('#sbcCallAppointments,#sbcAccountAppointments'))return;
   event.preventDefault();const account=Boolean(btn.closest('#sbcAccountAppointments'));
   const id=account?accountHost()?.dataset.sbcLeadId:callCustomer;
   openEditor(id,btn.dataset.sbcApptEdit||'',account?'account':'call');
  }
  function change(event){if(event.target.id!=='sbcCallAppointmentCustomer')return;callCustomer=pickId(event.target.value);mountCall();}
  function schedule(){if(queued)return;queued=true;Promise.resolve().then(()=>{queued=false;refresh();});}
  doc.addEventListener('click',click);
  doc.addEventListener('change',change);
  const css=doc.createElement('style');css.id='sbcAppointmentWorkflowCSS';css.textContent=
   '.sbc-appt-account{grid-column:1/-1}.sbc-appt-call{margin:18px 0;padding:18px;border:1px solid #9ba9b7;border-radius:14px;color:inherit}.sbc-appt-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.sbc-appt-heading h3{margin:0 0 6px}.sbc-appt-heading p{margin:0 0 10px}.sbc-appt-controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0}.sbc-appt-controls select{min-width:min(100%,260px);max-width:100%;padding:10px;border:1px solid #9ba9b7;border-radius:8px;background:var(--card,#fff);color:var(--text,#111827)}.sbc-appt-row{display:flex;justify-content:space-between;gap:12px;align-items:start;padding:12px 0;border-top:1px solid #9ba9b7}.sbc-appt-row p{margin:5px 0;overflow-wrap:anywhere}.sbc-appt-editor input,.sbc-appt-editor textarea,.sbc-appt-editor select{width:100%;box-sizing:border-box}.sbc-appt-editor #sbcApptFormError{color:#bd2434}';
  doc.head.appendChild(css);
  new win.MutationObserver(schedule).observe(doc.documentElement,{childList:true,subtree:true});
  refresh();
 }
 return Object.freeze({forCustomer,payload,localInput,displayTime,install});
});