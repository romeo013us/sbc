from pathlib import Path
r=Path(__file__).resolve().parents[1]
p=r/'public/sbc-account-manager-v1.js'
s=p.read_text()
a="const $=id=>document.getElementById(id),state={view:'accounts',accounts:[],handoffs:[],channels:[],posts:[],selected:null,lang:'en',role:'',busy:false};"
b="const $=id=>document.getElementById(id),state={view:'accounts',accounts:[],handoffs:[],channels:[],posts:[],accountAppointments:[],selected:null,lang:'en',role:'',busy:false};"
assert s.count(a)==1;s=s.replace(a,b)
# Add actual feature functions before first existing renderAccountGrid
at=s.index(' function renderAccountGrid(){')
functions=r''' async function salesJson(path,options={}){
  const response=await fetch(path,{method:options.method||'GET',credentials:'same-origin',cache:'no-store',
   headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{})},
   ...(options.body?{body:JSON.stringify(options.body)}:{})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok!==true)throw Error(result.code||'SALES_ACTION_NOT_CONFIRMED');
  return result;
 }
 function todayActionHost(){
  let host=$('sbcAMTodayRevenueActions');
  if(!host){host=document.createElement('section');host.id='sbcAMTodayRevenueActions';host.className='account-card';
   host.style.cssText='border:1px solid #74a6c4;padding:16px;margin:12px 0 22px;border-radius:14px;background:#f5faff;color:#19304a';
   $('accountGrid').parentElement.insertBefore(host,$('accountGrid'));}
  return host;
 }
 async function loadRevenueActions(){
  if(!['owner','account_manager'].includes(state.role))return;
  const host=todayActionHost();host.textContent='Loading assigned revenue actions…';
  try{
   const [data,reminders]=await Promise.all([
    salesJson('/api/sbc/sales/actions/today?limit=80'),
    salesJson('/api/sbc/sales/reminders/preview').catch(()=>({rows:[],sendEnabled:false}))]);
   const labels={MEETING_REVIEW:'1 · Past meeting — verify attendance',DUE_CALLBACK:'2 · Due callback',
    MEETING_PREP:'3 · Prepare confirmed meeting',RESEARCHED_LEAD:'4 · Research-backed prospect'};
   host.innerHTML='<header><h2 style="font-size:19px;margin:0 0 5px">📈 Today\'s Revenue Actions</h2>'+ 
    '<p class="muted" style="color:#365269">Missed-meeting review → Due callbacks → Upcoming Zoom prep → Verified prospect opportunities. No automatic outreach.</p></header>'+ 
    '<p><strong>'+escapeHtml(data.total)+' assigned next steps</strong> · '+escapeHtml(data.counts.meetingReviews)+' meeting reviews · '+escapeHtml(data.counts.dueCallbacks)+' callbacks · '+escapeHtml(data.counts.meetingPrep)+' preparations</p>'+ 
    '<div style="max-height:320px;overflow:auto">'+(data.rows.length?data.rows.slice(0,30).map(row=> 
     '<article style="padding:11px 5px;border-top:1px solid #c4d5e2"><strong>'+escapeHtml(row.businessName)+'</strong> · '+escapeHtml(labels[row.type]||row.title)+
     '<p style="margin:5px 0;color:#365269;font-size:13px">'+escapeHtml(row.nextAction)+'</p>'+ 
     '<button type="button" class="button secondary" data-action="open-revenue-account" data-id="'+escapeHtml(row.customerId)+'">Open assigned account</button></article>').join(''):
     '<p>Nothing due in your assigned portfolio. Verify your assigned accounts and refresh.</p>')+'</div>'+ 
    '<p class="muted" style="color:#365269">Meeting reminder previews: '+escapeHtml(reminders.rows?.length||0)+
    '. SMS/email dispatch remains OFF until verified consent, provider readiness and a confirmed meeting URL are implemented and accepted.</p>'+ 
    '<button type="button" class="button secondary" data-action="refresh-revenue-actions">Refresh priorities</button>';
  }catch(error){host.textContent='Today\'s Revenue Actions unavailable: '+String(error.message||error)+'; no customer contact was initiated.';}
 }
 async function loadAccountAppointments(id){
  let host=$('sbcAMAppointmentBooking');if(!host){host=document.createElement('section');host.id='sbcAMAppointmentBooking';host.className='account-card';$('accountDetail').appendChild(host);}
  host.textContent='Loading appointment calendar…';
  try{
   const data=await salesJson('/api/appointments?customerId='+encodeURIComponent(id));
   if(state.selected!==id)return;
   state.accountAppointments=data.appointments||[];
   host.innerHTML='<h3>📅 Discovery appointments · 10-minute Zoom</h3>'+ 
    '<p class="muted">Call first → Book Zoom → Prepare the private ChatGPT website concept → Present. No website is required to book.</p>'+ 
    '<button type="button" class="button" data-action="book-zoom" data-id="'+escapeHtml(id)+'">Book 10-minute Zoom</button>'+ 
    (state.accountAppointments.length?state.accountAppointments.map(a=>
      '<article class="timeline-row"><strong>'+escapeHtml(a.title)+'</strong> · '+escapeHtml(a.status)+
      '<p>'+escapeHtml(new Date(a.startAt).toLocaleString())+' · '+escapeHtml(a.location||'Location not yet confirmed')+'</p>'+ 
      (a.status==='Scheduled'?'<button type="button" class="button secondary" data-action="reschedule-zoom" data-id="'+escapeHtml(a.id)+'">Reschedule</button>':'')+'</article>').join(''):
     '<p class="muted">No appointment on this account yet.</p>')+
    '<p class="muted">Saving an appointment does not send a text, email, Zoom invitation, or create a meeting link.</p>';
  }catch(error){if(state.selected===id)host.textContent='Could not load appointment calendar: '+String(error.message||error)}
 }
 function toLocalInput(value){
  const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';
  const z=v=>String(v).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
 }
 async function openBookingEditor(accountId,appointmentId=''){
  const account=state.accounts.find(x=>String(x.id)===String(accountId));if(!account)throw Error('ASSIGNED_ACCOUNT_REQUIRED');
  const existing=state.accountAppointments.find(x=>String(x.id)===String(appointmentId));
  if(appointmentId&&!existing)throw Error('APPOINTMENT_NOT_IN_ASSIGNED_ACCOUNT');
  let dialog=$('sbcAMBookingDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='sbcAMBookingDialog';document.body.append(dialog);}
  const start=existing?new Date(existing.startAt):new Date(Math.ceil((Date.now()+60*60*1000)/(30*60*1000))*(30*60*1000));
  const end=existing?new Date(existing.endAt):new Date(start.getTime()+10*60000);
  dialog.innerHTML='<form id="sbcAMBookingForm" style="min-width:min(90vw,390px);max-width:560px;color:#1e293b">'+
   '<h3 style="margin-top:0">'+(existing?'Reschedule':'Book 10-minute Zoom')+'</h3>'+ 
   '<p><strong>'+escapeHtml(account.businessName)+'</strong></p>'+ 
   '<label>Starts (your device local time)<input type="datetime-local" name="startAt" required value="'+escapeHtml(toLocalInput(start))+'"></label>'+ 
   '<label>Ends<input type="datetime-local" name="endAt" required value="'+escapeHtml(toLocalInput(end))+'"></label>'+ 
   '<label>Confirmed Zoom link or meeting method<input type="text" name="location" maxlength="255" value="'+escapeHtml(existing?.location||'Video / Zoom link pending')+'"></label>'+ 
   '<label>Internal preparation notes<textarea name="notes" rows="3" maxlength="3000">'+escapeHtml(existing?.notes||'Prepare a private SBC website concept after this meeting is booked. Confirm meeting link with the customer.')+'</textarea></label>'+ 
   '<p class="muted">SBC calendar only. No automatic invitation or reminder is sent.</p>'+ 
   '<p id="sbcAMBookingError" role="alert" style="color:#b91c1c"></p>'+ 
   '<div style="display:flex;gap:8px;justify-content:end"><button type="button" class="button secondary" id="sbcAMBookingCancel">Cancel</button> '+
   '<button class="button" type="submit">'+(existing?'Save new time':'Confirm booking')+'</button></div></form>';
  dialog.showModal();$('sbcAMBookingCancel').onclick=()=>dialog.close();
  $('sbcAMBookingForm').onsubmit=async event=>{
   event.preventDefault();const form=event.currentTarget,submit=form.querySelector('[type=submit]');submit.disabled=true;
   const inputs=new FormData(form);const value={customerId:String(account.id),title:existing?.title||'10-minute SBC website preview',
    startAt:new Date(String(inputs.get('startAt'))).toISOString(),endAt:new Date(String(inputs.get('endAt'))).toISOString(),
    location:String(inputs.get('location')||''),notes:String(inputs.get('notes')||'')};
   if(existing)value.status=existing.status;
   try{
    const result=await salesJson('/api/appointments'+(existing?'/'+encodeURIComponent(existing.id):''),{method:existing?'PUT':'POST',body:value});
    if(result.durable!==true)throw Error('APPOINTMENT_NOT_CONFIRMED');
    dialog.close();await loadAccountAppointments(account.id);await loadRevenueActions();
    message('Appointment saved in SBC CRM. Add a real Zoom link and confirm it with the customer; reminders are not being sent.');
   }catch(error){$('sbcAMBookingError').textContent='Booking not saved: '+String(error.message||error);}
   finally{submit.disabled=false;}
  };
 }
'''
s=s[:at]+functions+s[at:]
# Add endpoint load after existing renderAccountGrid
at="  renderAccountGrid();\n  $('socialCustomer').innerHTML=accountOptions();"
assert s.count(at)==1
s=s.replace(at,"  renderAccountGrid();void loadRevenueActions();\n  $('socialCustomer').innerHTML=accountOptions();")
# Account detail booking panel and queue visible per open.
at="if(state.role==='account_manager'){void loadAccountHistoryV5(id);void loadAccountResearchV4(id);void loadAccountPlanV5(id);}"
assert s.count(at)==1
s=s.replace(at,"void loadAccountAppointments(id);\n  if(state.role==='account_manager'){void loadAccountHistoryV5(id);void loadAccountResearchV4(id);void loadAccountPlanV5(id);}")
# New actions in existing dispatcher
at="if(name==='open-account'){openAccount(id);return;}if(name==='generate-website'){await openAccountWebsite(id);return;}"
assert s.count(at)==1
s=s.replace(at,"if(name==='open-account'||name==='open-revenue-account'){openAccount(id);return;}if(name==='generate-website'){await openAccountWebsite(id);return;}\n  if(name==='refresh-revenue-actions'){await loadRevenueActions();return;}\n  if(name==='book-zoom'){await openBookingEditor(id);return;}\n  if(name==='reschedule-zoom'){await openBookingEditor(state.selected,id);return;}")
# Clear new state on auth failure to prevent access bleed
at="state.accounts=[];state.handoffs=[];state.channels=[];state.posts=[];"
assert s.count(at)==1
s=s.replace(at,"state.accounts=[];state.handoffs=[];state.channels=[];state.posts=[];state.accountAppointments=[];\n  if($('sbcAMTodayRevenueActions'))$('sbcAMTodayRevenueActions').replaceChildren();\n  if($('sbcAMAppointmentBooking'))$('sbcAMAppointmentBooking').replaceChildren();")
p.write_text(s)
(r/'browser_public/sbc-account-manager-v1.js').write_text(s)
