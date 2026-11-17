/* SBC Lorna Research handoff: optional additive panel, no replacement of research tools.
 * Only mounts when this script is intentionally added to verified research HTML.
 * All tenant/user/role authority remains with the authenticated server API.
 */
(()=>{'use strict';
 const ROOT_ID='sbc-lorna-handoff-v1';if(document.getElementById(ROOT_ID))return;
 const apiRoot='/api/account-social/v1/research';
 const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const root=document.createElement('section');root.id=ROOT_ID;root.hidden=true;
 root.setAttribute('aria-label','SBC Research Handoff');root.innerHTML=`<div class="sbc-handoff-shell"><header><div><small>SUCCESSFUL BY CHOICE · RESEARCH</small><h2>Lead Handoff &amp; Corrections</h2><p>Verified leads move into account management without losing your original records.</p></div><button type="button" id="sbc-handoff-close" aria-label="Close handoff panel">✕</button></header><p id="sbc-handoff-status" aria-live="polite"></p><section><h3>Send a verified lead</h3><p>Use <strong>Send for owner review</strong> beside an auto-verified business in My Submitted Leads. The correct account is selected for you. No CRM ID copying needed.</p><p id="sbc-handoff-selected" role="status">Or enter an existing verified CRM lead ID below.</p><form id="sbc-handoff-submit"><label>Selected CRM lead ID<input name="customerId" maxlength="120" required></label><label>Verification summary<textarea name="summary" maxlength="2000" rows="3" required></textarea></label><button type="submit">Send for owner review</button></form></section><section><h3>Returned research requests</h3><div id="sbc-handoff-feedback">Open to load your corrections.</div><button type="button" id="sbc-handoff-refresh">Refresh corrections</button></section></div>`;
 document.body.appendChild(root);

 const $=id=>document.getElementById(id),status=(s)=>{$('sbc-handoff-status').textContent=s};
 function openForLead(lead){
  const id=String(lead?.id||'').trim(),name=String(lead?.businessName||'Business name not recorded').trim().slice(0,160);
  if(!id||id.length>120)return false;
  const form=$('sbc-handoff-submit');
  if(!form?.elements?.customerId||!form?.elements?.summary)return false;
  root.hidden=false;
  form.elements.customerId.value=id;
  form.elements.customerId.readOnly=true;
  form.elements.summary.value='';
  $('sbc-handoff-selected').textContent='Selected from My Submitted Leads: '+name+' · CRM ID: '+id;
  status('Review the selected business and write a short factual verification summary. Nothing is sent until you select Send for owner review.');
  form.elements.summary.focus();
  return true;
 }
 // This is a convenience selector, not an authorization or verification bypass.
 // The server still checks the signed-in researcher, tenant and current CRM state.
 window.SBCLornaHandoff=Object.freeze({openForLead});
 async function api(path,opts){const r=await fetch(apiRoot+path,{credentials:'same-origin',headers:{Accept:'application/json',...(opts?.body?{'Content-Type':'application/json'}:{})},method:opts?.method||'GET',...(opts?.body?{body:JSON.stringify(opts.body)}:{})});const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw Error(data.error||'REQUEST_UNAVAILABLE');return data.data;}
 async function refresh(){try{const rows=await api('/feedback'),list=$('sbc-handoff-feedback');list.innerHTML=rows.length?rows.map(x=>`<article class="sbc-handoff-row"><strong>${e(x.businessName||'Business name not recorded')}</strong><p>Research issue: ${e(x.issue)} · CRM ID: ${e(x.customerId)}</p><p>${e(x.reason)}</p>${x.retryNotBefore?`<p>Phone outreach on hold until ${e(x.retryNotBefore)}. Research is permitted now.</p>`:''}<form data-feedback="${e(x.id)}"><label>Research outcome<select name="action"><option value="RESOLVED">Verified correction available</option><option value="ESCALATED">No verified alternative — owner review</option></select></label><label>Evidence / investigation details<textarea name="note" maxlength="2000" rows="3" required></textarea></label><label>Evidence URL (optional)<input name="evidenceUrl" type="url" placeholder="https://"></label><button type="submit">Submit research result</button></form></article>`).join(''):'<p>No research corrections waiting for you.</p>';status(rows.length+' open research correction'+(rows.length===1?'':'s')+' loaded.');}catch(err){status('Corrections unavailable: '+err.message)}}
 $('sbc-handoff-close').addEventListener('click',()=>{root.hidden=true});$('sbc-handoff-refresh').addEventListener('click',refresh);
 let submitting=false;
 $('sbc-handoff-submit').addEventListener('submit',async ev=>{
  ev.preventDefault();if(submitting)return;
  const form=ev.target,button=form.querySelector?.('button[type="submit"]');
  submitting=true;if(button)button.disabled=true;
  try{
   const saved=await api('/handoffs',{method:'POST',body:{
    customerId:form.elements.customerId.value,summary:form.elements.summary.value
   }});
   if(!saved?.id||!saved?.status)throw Error('Handoff was not confirmed by SBC.');
   form.reset();form.elements.customerId.readOnly=false;
   $('sbc-handoff-selected').textContent='Ready for another verified business.';
   status('Saved for owner review. No lead was deleted and no customer was contacted.');
  }catch(err){status('Handoff not saved: '+err.message)}
  finally{submitting=false;if(button)button.disabled=false}
 });
 root.addEventListener('submit',async ev=>{if(!ev.target.matches('[data-feedback]'))return;ev.preventDefault();try{const f=ev.target;await api('/feedback/'+encodeURIComponent(f.dataset.feedback)+'/resolve',{method:'POST',body:{action:f.elements.action.value,note:f.elements.note.value,evidenceUrl:f.elements.evidenceUrl.value}});await refresh();status('Research feedback recorded; no CRM lead was deleted.');}catch(err){status('Feedback not saved: '+err.message)}});
 function mountButton(){const nav=document.querySelector('nav[aria-label="Research navigation"]');if(!nav)return false;const b=document.createElement('button');b.className='sbc-handoff-nav-button';b.type='button';b.textContent='⇢ Research Handoff';b.addEventListener('click',()=>{
  root.hidden=false;
  const f=$('sbc-handoff-submit');
  if(f?.elements?.customerId){f.elements.customerId.readOnly=false;f.elements.customerId.value='';}
  $('sbc-handoff-selected').textContent='Choose a verified business from My Submitted Leads, or enter its existing CRM ID.';
  refresh();
 });nav.appendChild(b);return true;}
 if(!mountButton()){window.addEventListener('DOMContentLoaded',mountButton,{once:true})}
})();
