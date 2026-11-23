/* SBC bilingual handoff inbox for the certified Account Manager workstation.
 * Displays only server-authorized tenant records; never auto-dials. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const host=()=> $('sbcSpanishAmQueue');
 async function request(url,options={}){
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',
   headers:{'Accept':'application/json',...(options.body?{'Content-Type':'application/json'}:{})},...options});
  const body=await response.json().catch(()=>({}));
  if(!response.ok||body.ok!==true)throw Error(String(body.error||body.code||'Request unavailable'));
  return body;
 }
 async function reload(){
  const node=host();if(!node)return;
  node.innerHTML='<h3>🇪🇸 Cola de llamadas en español · Spanish Callback Queue</h3><p>Loading assigned and available Spanish callbacks…</p>';
  try{
   const d=await request('/api/sales/spanish-callbacks');
   const rows=Array.isArray(d.rows)?d.rows:[];
   node.innerHTML='<h3>🇪🇸 Cola de llamadas en español · Spanish Callback Queue ('+rows.length+')</h3>'+
    '<p>Review the existing call notes and SBC calling eligibility before a human callback. Claiming does not place a call.</p>'+
    '<button type="button" class="button secondary" id="sbcSpanishAmRefresh">↻ Refresh</button>'+
    (rows.length?rows.map(c=>'<article class="panel"><strong>'+esc(c.businessName||'Account')+'</strong>'+
      '<p>'+esc(c.contactName||'Decision maker unverified')+' · '+esc(c.phone||'No phone recorded')+'</p>'+
      '<p>Last attempt: '+esc(c.lastCalledAt||'Unknown')+' · '+esc(c.lastOutcome||'Not classified')+'</p>'+
      '<p style="white-space:pre-wrap">'+esc(c.lastNotes||'No call notes')+'</p>'+
      '<p>'+ (c.dnc?'Do Not Call — no callback permitted.':c.assignedTo?'Assigned to a bilingual Account Manager.':'Unassigned — bilingual review needed.')+'</p>'+
      (!c.assignedTo&&!c.dnc?'<button type="button" class="button secondary" data-sbc-spanish-claim="'+esc(c.id)+'">Claim Spanish Callback</button>':'')+
      (c.assignedTo&&!c.dnc?'<button type="button" class="button secondary" data-sbc-spanish-open="'+esc(c.id)+'">Open My Accounts / Call</button>':'')+
      (c.assignedTo&&!c.dnc?'<form data-sbc-spanish-resolve="'+esc(c.id)+'" style="display:grid;gap:8px;margin-top:10px">'+
       '<label>Outcome <select name="outcome" required><option value="Interested">Interested</option><option value="Appointment booked">Appointment booked</option><option value="Follow-up requested">Follow-up requested</option><option value="No answer">No answer</option><option value="Not interested">Not interested</option><option value="Do Not Call">Do Not Call</option></select></label>'+
       '<label>Actual conversation notes<textarea name="notes" minlength="12" maxlength="1200" required rows="3" placeholder="Document what happened in the Spanish callback"></textarea></label>'+
       '<label>Agreed follow-up date/time (required if follow-up requested)<input name="followUpAt" type="datetime-local"></label>'+
       '<button type="submit" class="button secondary">Save Account Outcome</button></form>':'')+
    '</article>').join(''):'<p>No Spanish-language handoffs are waiting.</p>');
  }catch(e){
   const denied=/APPROVAL|CERTIFICATION|WORKSPACE_ONLY|403/i.test(String(e.message||e));
   node.innerHTML='<h3>🇪🇸 Spanish Callback Queue</h3><p>'+
    (denied?'This section requires Academy clearance and the owner’s explicit bilingual-calling approval.':'Unable to load the Spanish callback queue: '+esc(String(e.message||e)))+'</p>'+
    '<button type="button" class="button secondary" id="sbcSpanishAmRefresh">Retry</button>';
  }
 }
 document.addEventListener('click',async event=>{
  if(event.target?.id==='sbcSpanishAmRefresh')return void reload();
  const claim=event.target?.closest('[data-sbc-spanish-claim]');
  if(claim&&host()?.contains(claim)){
   const id=claim.dataset.sbcSpanishClaim;
   claim.disabled=true;
   try{await request('/api/sales/spanish-callbacks/'+encodeURIComponent(id)+'/claim',{method:'POST',body:'{}'});
    await reload();$('refresh')?.click();
   }catch(e){claim.disabled=false;alert('Spanish callback claim failed: '+String(e.message||e))}
   return;
  }
  const open=event.target?.closest('[data-sbc-spanish-open]');
  if(open&&host()?.contains(open)){
   window.location.assign('/sbc-account-manager-v1.html?account='+encodeURIComponent(open.dataset.sbcSpanishOpen));
  }
 });

 document.addEventListener('submit',async event=>{
  const form=event.target?.closest('[data-sbc-spanish-resolve]');
  if(!form||!host()?.contains(form))return;
  event.preventDefault();
  const customerId=form.dataset.sbcSpanishResolve,button=form.querySelector('button[type=submit]');
  if(!form.reportValidity())return;
  const outcome=String(form.elements.outcome.value),notes=String(form.elements.notes.value).trim();
  const local=String(form.elements.followUpAt.value||'');
  if(outcome==='Follow-up requested'&&!local)return alert('Enter the follow-up date/time agreed with the customer.');
  let followUpAt='';if(local){const dt=new Date(local);if(!Number.isFinite(+dt))return alert('Choose a valid follow-up date.');followUpAt=dt.toISOString();}
  button.disabled=true;
  try{
   const result=await request('/api/sales/spanish-callbacks/'+encodeURIComponent(customerId)+'/resolve',{
    method:'POST',body:JSON.stringify({outcome,notes,followUpAt})});
   if(result?.durable!==true)throw Error('Outcome was not confirmed durable.');
   await reload();$('refresh')?.click();
  }catch(e){button.disabled=false;alert('Spanish callback outcome not saved: '+String(e.message||e))}
 });
 document.addEventListener('DOMContentLoaded',()=>{if(host())reload();});
 window.SBCSpanishCallbacks=Object.freeze({reload});
})();
