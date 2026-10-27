/* SBC V66.0.6 — tenant-scoped lead editor. Only reports success after server confirms commit. */
(function(){
 'use strict';
 if(window.__SBC_V6606_EDITOR__)return;
 window.__SBC_V6606_EDITOR__=true;
 function boot(){
  if(document.getElementById('sbc-v6606-editor'))return;
  const css=document.createElement('style');css.id='sbc-v6606-editor-css';
  css.textContent='#sbc-v6606-editor{width:min(94vw,560px);max-height:90vh;border-radius:14px;border:1px solid #4b88bd;background:#101b2a;color:#fff;padding:20px;box-shadow:0 20px 60px #0009}#sbc-v6606-editor::backdrop{background:#000a}#sbc-v6606-editor form{display:grid;gap:12px}#sbc-v6606-editor label{display:grid;gap:4px;font:600 13px system-ui}#sbc-v6606-editor input,#sbc-v6606-editor select,#sbc-v6606-editor textarea{box-sizing:border-box;width:100%;background:#f5f8fd;color:#10243b;padding:10px;border:1px solid #9ab4ce;border-radius:8px;font:14px system-ui}#sbc-v6606-editor .actions{display:flex;gap:8px;flex-wrap:wrap}#sbc-v6606-editor button{padding:10px 14px;color:#fff;background:#0b69b2;border:1px solid #4c8cc3;border-radius:8px;font-weight:700;cursor:pointer}#sbc-v6606-editor button[type=button]{background:#283e55}#sbc-v6606-editor button:disabled{opacity:.5;cursor:wait}#sbc-v6606-editor p{margin:0;font:12px system-ui;color:#b6cde0}#sbc-lead-workspace [data-sbc-lead-edit-id]{padding:5px 8px;margin-top:4px;font-size:11px}';
  document.head.appendChild(css);
  const dlg=document.createElement('dialog');dlg.id='sbc-v6606-editor';
  dlg.innerHTML='<form id="sbc-v6606-edit-form"><h2 style="margin:0">Edit CRM lead</h2><p id="sbc-v6606-title"></p><label>Contact name<input name="contactName" maxlength="255"></label><label>Phone<input name="phone" maxlength="80"></label><label>Email<input name="email" type="email" maxlength="255"></label><label>Status<select name="status"><option>Lead</option><option>Prospect</option><option>Contacted</option><option>Follow Up</option><option>Qualified</option><option>Interested</option><option>Not Interested</option><option>Appointment Set</option><option>Customer</option><option>Not Qualified</option><option>Do Not Call</option><option>Lost</option></select></label><label>Notes<textarea name="notes" rows="5" maxlength="4000"></textarea></label><p id="sbc-v6606-message" role="status" aria-live="polite"></p><div class="actions"><button type="submit">Save changes</button><button type="button" id="sbc-v6606-cancel">Cancel</button></div></form>';
  document.body.appendChild(dlg);
  const form=dlg.querySelector('form'),submit=form.querySelector('button[type=submit]'),msg=dlg.querySelector('#sbc-v6606-message'),title=dlg.querySelector('#sbc-v6606-title');
  let activeId=null,activeRevision=null,openSequence=0;
  // SBC_V6611_LEAD_EDITOR_LOAD_GUARD: disable editable fields until a verified lead fetch completes.
  const enableFields=value=>{for(const input of form.querySelectorAll('input,select,textarea'))input.disabled=!value;};
  const note=value=>{msg.textContent=String(value||'')};
  dlg.querySelector('#sbc-v6606-cancel').addEventListener('click',()=>dlg.close());
  dlg.addEventListener('close',()=>{if(!dlg.open){openSequence++;activeId=null;activeRevision=null;}});
  document.addEventListener('click',async event=>{
   const button=event.target.closest?.('button[data-sbc-lead-edit-id]');
   if(!button)return;
   event.preventDefault();
   activeId=button.dataset.sbcLeadEditId;activeRevision=null;const thisOpen=++openSequence;
   if(!activeId)return;
   form.reset();enableFields(false);submit.disabled=true;title.textContent='Loading lead…';note('Checking the current CRM record.');
   dlg.showModal();
   const requestedId=activeId;
   try{
    const response=await fetch('/api/v6519/crm/leads/'+encodeURIComponent(requestedId),{credentials:'include',cache:'no-store',headers:{Accept:'application/json'}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.ok||!data.data)throw Error(data.code||'CRM_READ_FAILED');
    if(thisOpen!==openSequence||activeId!==requestedId||String(data.data.id)!==requestedId)throw Error('CRM_IDENTITY_MISMATCH');
    if(typeof data.data.revision!=='string'||!(/^[a-f0-9]{64}$/).test(data.data.revision))throw Error('CRM_REVISION_MISSING');
    activeRevision=data.data.revision;
    title.textContent=String(data.data.business_name||data.data.id);
    for(const [key,column] of Object.entries({contactName:'contact_name',phone:'phone',email:'email',status:'status',notes:'notes'})){
     if(form.elements[key])form.elements[key].value=String(data.data[column]||(key==='status'?'Lead':''));
    }
    enableFields(true);submit.disabled=false;note('Save changes to update the authoritative CRM record.');
   }catch(err){if(thisOpen===openSequence)note('Unable to load lead: '+String(err.message||err));}
  });
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(!activeId)return;
   submit.disabled=true;note('Saving to MySQL…');
   try{
    if(!activeRevision)throw Error('CRM_REVISION_MISSING');
    const response=await fetch('/api/v6606/crm/leads/'+encodeURIComponent(activeId),{
     method:'PATCH',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json',Accept:'application/json'},
     body:JSON.stringify({...Object.fromEntries(new FormData(form).entries()),revision:activeRevision})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result.ok||result.durable!==true)throw Error(response.status===423?'RECOVERY_LOCK_ACTIVE — record was not saved.':response.status===409?'This lead changed elsewhere. Close and reopen to refresh; newer notes have not been overwritten.':result.code||'SAVE_FAILED');
    note('Saved and verified');dlg.close();
    document.getElementById('slw-refresh')?.click();
   }catch(err){note('Not saved: '+String(err.message||err));}finally{submit.disabled=false;}
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
