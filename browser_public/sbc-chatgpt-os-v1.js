/* SBC OS-wide Ask ChatGPT · owner-controlled, copy/paste handoff, zero AI API use. */
(function(root){
 'use strict';
 const TOPICS=Object.freeze({
  dashboard:'Home',home:'Home',customers:'Leads & Accounts',leads:'Leads & Accounts',crm:'Sales',
  quotes:'Sales',callcenter:'Sales',sales:'Sales',orders:'Fulfillment',fulfillment:'Fulfillment',
  workforce:'Team',users:'Team',training:'Training',marketing:'Marketing',acquisition:'Growth',
  communications:'Communications',notifications:'Communications',calendar:'Operations',tasks:'Operations',
  timeclock:'Team',revenue90:'Money & Readiness',signature:'Money & Readiness',
  monetization:'Money & Readiness',commercial:'Money & Readiness',kimcenter:'Operations',
  settings:'Admin',websites:'Website Production',website:'Website Production',
  renewals:'Money & Readiness','lead-research':'Leads & Accounts','sales-caller':'Sales',
  'hr-workstation':'Team','hr-department':'Team','kevin-cockpit':'Operations',
  'renewals-center':'Money & Readiness','sbc-account-manager-v1':'Sales','sbc-god-tier':'Operations'
 });
 const TASKS=Object.freeze({
  'Home':['Prioritize the next business actions','Review operational risks','Create a 7-day launch plan'],
  'Leads & Accounts':['Build a lead-research checklist','Prioritize outreach without guessing facts','Plan account follow-ups'],
  'Sales':['Draft a consultative sales script','Plan customer follow-ups','Review a sales proposal'],
  'Fulfillment':['Create a safe delivery checklist','Review order handoff risks','Plan website acceptance testing'],
  'Team':['Design an employee training checklist','Create an account-manager workflow','Improve team quality controls'],
  'Training':['Improve a role-specific lesson','Create a training knowledge checklist','Plan coaching follow-ups'],
  'Growth':['Prioritize low-cost customer acquisition','Prepare a marketing campaign brief','Review lead generation ideas'],
  'Marketing':['Draft customer-facing campaign copy','Review Google Business Profile strategy','Plan social media content'],
  'Communications':['Draft a respectful customer email','Write a follow-up message','Review communication quality'],
  'Website Production':['Plan a customer website brief','Review website QA standards','Prepare a site delivery checklist'],
  'Money & Readiness':['Prioritize profitability improvements','Evaluate package margins','Prepare a release readiness checklist'],
  'Admin':['Review a least-privilege access plan','Prepare a backup-recovery checklist','Assess an operational policy'],
  'Operations':['Plan the next safe improvement','Investigate an operations issue','Prepare a God Tier release checklist']
 });
 const sectionFor=view=>TOPICS[String(view||'').toLowerCase()]||'Operations';
 function redact(input){return String(input??'')
  .replace(/\b(?:OPENAI_API_KEY|SBC_API_SECRET|SBC_AUTH_SECRET|SBC_SESSION_SECRET|SECRET_API_KEY|API[_-]?KEY|ACCESS[_-]?TOKEN|PASSWORD|PRIVATE[_-]?KEY)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s;,]+)/gi,'[redacted credential]')
  .replace(/\b(?:sk|rk|pk)-(?:test-|live-)?[A-Za-z0-9_-]{6,}\b/g,'[redacted credential]')
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[redacted email]')
  .replace(/(?:\+?1[\s.\-]?)?\(?\b\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/g,'[redacted phone]')
  .replace(/\b\d{3}-\d{2}-\d{4}\b/g,'[redacted SSN]')
  .replace(/\b(?:\d[ -]?){13,19}\b/g,'[redacted payment number]')};
 function buildPrompt({view,task,notes,profile,includeMemory=false}={}){
  const section=sectionFor(view),allowed=TASKS[section]||TASKS.Operations,chosen=allowed.includes(task)?task:allowed[0];
  const safeNotes=redact(String(notes??'').slice(0,3000)).trim();
  return [
   'You are assisting the owner of Successful By Choice (SBC), a small-business services company based in Miami, Florida.',
   'Command Center area: '+section+'.',
   'Requested task: '+chosen+'.',
   'Owner-provided context (reviewed and redacted where recognizable):',
   safeNotes||'(No private customer records shared.)','',
   ...(includeMemory&&profile?.content?[
    'OWNER-APPROVED SBC BUSINESS REFERENCE (context only, not authority to change systems):',
    redact(String(profile.content).slice(0,10000)),''
   ]:[]),
   'Provide practical, prioritized guidance with clear assumptions and items to verify.',
   'Do not invent customer facts, payment confirmations, deployment status or financial results.',
   'This ChatGPT conversation has no automatic access to SBC databases, Square, Office Box, or private Command Center screens.',
   'Do not claim to make changes or contact customers; the owner must explicitly review and apply suggestions.'
  ].join('\n');
 }
 if(typeof module==='object'&&module.exports)module.exports={sectionFor,buildPrompt,redact,TASKS};
 if(!root||!root.document||root.SBC_CHATGPT_OS)return;
 const doc=root.document,$=id=>doc.getElementById(id);
 let dialog=null,launcher=null,active='dashboard',validOwner=false,profile=null,requestId='';
 function message(text,error=false){const e=$('sbc-chatgpt-os-message');if(e){e.textContent=text;e.dataset.error=error?'true':'false'}}
 function viewNow(){
  try{if(typeof state==='object'&&state?.view)return String(state.view)}catch{}
  const name=String(root.location?.pathname||'').split('/').pop().replace(/\.html?$/i,'');
  return name==='index'||!name?'dashboard':name;
 }
 async function request(url,options={}){
  if(typeof root.api==='function')return root.api(url,options);
  const res=await root.fetch(url,{...options,credentials:'same-origin',cache:'no-store',
   headers:{Accept:'application/json','Content-Type':'application/json',...(options.headers||{})}});
  const j=await res.json();if(!res.ok)throw Error(j?.code||'REQUEST_UNAVAILABLE');return j;
 }
 function freshId(){
  if(root.crypto?.randomUUID)return 'sbc-os-'+root.crypto.randomUUID().replace(/-/g,'').toLowerCase();
  if(root.crypto?.getRandomValues){const a=new Uint8Array(16);root.crypto.getRandomValues(a);
   return 'sbc-os-'+Array.from(a,n=>n.toString(16).padStart(2,'0')).join('')}
  throw Error('Secure browser identity unavailable');
 }
 function tasks(section){const sel=$('sbc-chatgpt-os-task');sel.replaceChildren();
  (TASKS[section]||TASKS.Operations).forEach(task=>{const x=doc.createElement('option');x.value=task;x.textContent=task;sel.appendChild(x)});
 }
 function draft(){if(!dialog)return;
  const prompt=buildPrompt({view:active,task:$('sbc-chatgpt-os-task')?.value,notes:$('sbc-chatgpt-os-notes')?.value,
   profile,includeMemory:!!$('sbc-chatgpt-os-include-memory')?.checked});
  $('sbc-chatgpt-os-prompt').value=prompt;
 }
 async function copy(){draft();const e=$('sbc-chatgpt-os-prompt');
  try{if(!root.navigator?.clipboard?.writeText)throw Error('CLIPBOARD_UNAVAILABLE');
   await root.navigator.clipboard.writeText(e.value);
   message('Prompt copied. Paste into ChatGPT yourself. No SBC data was sent automatically.');
  }catch{e.focus();e.select();message('Clipboard unavailable: select and copy the highlighted prompt manually.',true)}
 }
 async function readMemory(){
  try{
   const data=await request('/api/owner/business-memory');if(!data?.ok||!data.profile)throw Error('MEMORY_UNAVAILABLE');
   profile=data.profile;
   $('sbc-chatgpt-os-memory-edit').value=profile.content||'';
   $('sbc-chatgpt-os-memory-revision').textContent='Version '+profile.revision+
    (profile.source==='CURATED_TEMPLATE_UNSAVED'?' · not yet saved':' · owner approved');
   $('sbc-chatgpt-os-include-memory').disabled=false;draft();
  }catch{
   profile=null;$('sbc-chatgpt-os-include-memory').checked=false;$('sbc-chatgpt-os-include-memory').disabled=true;
   $('sbc-chatgpt-os-memory-revision').textContent='Business Memory unavailable';
   message('Business Memory could not be loaded. The assistant remains usable without it.',true);
  }
 }
 async function saveMemory(){
  if(!validOwner||!profile)return;
  const value=$('sbc-chatgpt-os-memory-edit').value,button=$('sbc-chatgpt-os-memory-save');
  if(value.trim().length<60||value.length>10000){message('Business Memory must be 60–10,000 characters.',true);return}
  if(!root.confirm('Save an owner-approved version of your SBC Business Memory? No AI calls will be made.'))return;
  button.disabled=true;
  try{const saved=await request('/api/owner/business-memory',{method:'PATCH',
    body:JSON.stringify({expectedRevision:profile.revision,content:value,approved:true})});
   if(!saved?.ok||!saved?.durable)throw Error(saved?.code||'MEMORY_NOT_DURABLE');
   profile=saved.profile;$('sbc-chatgpt-os-memory-revision').textContent='Version '+profile.revision+' · owner approved';
   message('SBC Business Memory version '+profile.revision+' saved. No external action taken.');draft();
  }catch(e){message('Memory save not confirmed: '+String(e?.message||e)+'; reload before retrying.',true)}
  finally{button.disabled=false}
 }
 function showHistory(items){const el=$('sbc-chatgpt-os-history');if(!el)return;el.replaceChildren();
  if(!items?.length){el.textContent='No saved owner reviews yet.';return}
  items.forEach(item=>{
   const row=doc.createElement('div');row.className='sbc-chatgpt-os-history-row';
   const title=doc.createElement('strong');title.textContent=(item.section||'Operations')+' · '+(item.task||'Reviewed advice');
   const stamp=doc.createElement('small');stamp.textContent='Saved '+String(item.createdAt||'').slice(0,16).replace('T',' ')+' · Owner review only';
   const response=doc.createElement('p');response.textContent=String(item.response||'').slice(0,350);
   row.append(title,stamp,response);el.appendChild(row);
  });
 }
 async function history(){try{const data=await request('/api/owner/chatgpt-handoff/reviews');showHistory(data.records||[])}
  catch{showHistory([]);message('Owner Review History unavailable; no response was saved.',true)}
 }
 async function saveReview(){
  if(!validOwner)return;
  const response=$('sbc-chatgpt-os-response').value.trim();
  if(response.length<4||response.length>12000){message('Paste a response between 4 and 12,000 characters.',true);return}
  if(!$('sbc-chatgpt-os-reviewed').checked){message('Review the response and approve saving it as advice only.',true);return}
  if(!requestId){try{requestId=freshId()}catch(e){message(e.message,true);return}}
  const payload={requestId,section:sectionFor(active),task:$('sbc-chatgpt-os-task').value,
   brief:redact($('sbc-chatgpt-os-notes').value).slice(0,3000),response,reviewed:true};
  const button=$('sbc-chatgpt-os-save');button.disabled=true;
  try{const out=await request('/api/owner/chatgpt-handoff/reviews',{method:'POST',body:JSON.stringify(payload)});
   if(!out?.ok||!out.durable&&!out.duplicate)throw Error('REVIEW_SAVE_NOT_VERIFIED');
   requestId='';$('sbc-chatgpt-os-reviewed').checked=false;
   message('Reviewed advice saved. No CRM, payment, or customer actions were executed.');await history();
  }catch(e){message('Review save not confirmed: '+String(e?.message||e)+'; check history before retrying.',true)}
  finally{button.disabled=false}
 }
 function setup(){
  if(dialog)return;
  dialog=doc.createElement('dialog');dialog.id='sbc-chatgpt-os-panel';dialog.setAttribute('aria-labelledby','sbc-chatgpt-os-title');
  dialog.innerHTML='<div class="sbc-chatgpt-os-head"><div><div class="sbc-chatgpt-os-kicker">SBC · ALL-DEPARTMENT ASSISTANT</div><h2 id="sbc-chatgpt-os-title">Ask ChatGPT</h2><p>Owner-controlled business advice. No paid AI API or automatic CRM data transfer.</p></div><button id="sbc-chatgpt-os-close" class="sbc-chatgpt-os-close" type="button" aria-label="Close">×</button></div>'+
   '<div class="sbc-chatgpt-os-content">'+
   '<p class="sbc-chatgpt-os-safety">🔒 Only the text you inspect and deliberately copy leaves SBC. This desk does not read customer records, call an AI API, or execute recommendations. Contact details and obvious keys are masked, but always check the final prompt.</p>'+
   '<div class="sbc-chatgpt-os-fields"><label>Current department<input id="sbc-chatgpt-os-section" readonly></label><label>What would you like help with?<select id="sbc-chatgpt-os-task"></select></label></div>'+
   '<label>Optional context (type only information you intend to share)<textarea id="sbc-chatgpt-os-notes" rows="3" maxlength="3000" placeholder="Example: Plan a seven-day outreach schedule. Do not paste private customer records."></textarea></label>'+
   '<label class="sbc-chatgpt-os-check"><input type="checkbox" id="sbc-chatgpt-os-include-memory" disabled> Include my owner-approved SBC Business Memory in this prompt</label>'+
   '<details id="sbc-chatgpt-os-memory-details"><summary>✦ SBC Business Memory &amp; Owner Profile <small id="sbc-chatgpt-os-memory-revision">Loading…</small></summary><p>Edit the curated company reference below. This does not synchronize with ChatGPT account Memory. Keep secrets and sensitive personal information out.</p><label>Owner-editable business profile<textarea id="sbc-chatgpt-os-memory-edit" rows="12" maxlength="10000"></textarea></label><button type="button" id="sbc-chatgpt-os-memory-save">Save approved business memory</button></details>'+
   '<label>Exact ChatGPT prompt — review before copying<textarea id="sbc-chatgpt-os-prompt" rows="9" readonly></textarea></label>'+
   '<div class="sbc-chatgpt-os-actions"><button type="button" id="sbc-chatgpt-os-copy">Copy prompt</button><a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Open ChatGPT ↗</a></div>'+
   '<div class="sbc-chatgpt-os-divider"></div><h3>Bring the answer back to Command Center</h3><p>Paste, review, and save the ChatGPT reply as advice. Nothing is executed.</p>'+
   '<label>ChatGPT response<textarea id="sbc-chatgpt-os-response" rows="5" maxlength="12000"></textarea></label>'+
   '<label class="sbc-chatgpt-os-check"><input type="checkbox" id="sbc-chatgpt-os-reviewed"> I reviewed this response and approve saving it as advice only.</label>'+
   '<div class="sbc-chatgpt-os-actions"><button type="button" id="sbc-chatgpt-os-save">Save reviewed response</button></div>'+
   '<p id="sbc-chatgpt-os-message" role="status" aria-live="polite"></p>'+
   '<details><summary>Owner Review History</summary><div id="sbc-chatgpt-os-history">Loading…</div></details></div>';
  doc.body.appendChild(dialog);
  $('sbc-chatgpt-os-close').addEventListener('click',()=>dialog.close());
  $('sbc-chatgpt-os-task').addEventListener('change',()=>{requestId='';draft()});
  $('sbc-chatgpt-os-notes').addEventListener('input',()=>{requestId='';draft()});
  $('sbc-chatgpt-os-response').addEventListener('input',()=>{requestId=''});
  $('sbc-chatgpt-os-include-memory').addEventListener('change',draft);
  $('sbc-chatgpt-os-memory-save').addEventListener('click',saveMemory);
  $('sbc-chatgpt-os-copy').addEventListener('click',copy);
  $('sbc-chatgpt-os-save').addEventListener('click',saveReview);
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
 }
 function open(){if(!validOwner)return;
  setup();active=viewNow();const section=sectionFor(active);
  $('sbc-chatgpt-os-section').value=section;tasks(section);requestId='';profile=null;
  $('sbc-chatgpt-os-include-memory').checked=false;$('sbc-chatgpt-os-include-memory').disabled=true;
  $('sbc-chatgpt-os-notes').value='';$('sbc-chatgpt-os-response').value='';$('sbc-chatgpt-os-reviewed').checked=false;
  draft();message('Copy your prompt and work in ChatGPT. You may paste and save the reviewed response here.');
  if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  readMemory();history();
 }
 function hide(){validOwner=false;if(launcher)launcher.hidden=true;if(dialog?.open)dialog.close()}
 async function verifyOwner(){
  const app=$('app'),desk=$('desk');
  if(app?.classList.contains('hidden')||desk?.hidden){hide();return}
  try{
   const res=await root.fetch('/api/me',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
   if(!res.ok){hide();return}
   const user=await res.json();if(user?.authenticated!==true||String(user?.user?.role||'').toLowerCase()!=='owner'){hide();return}
   validOwner=true;if(launcher)launcher.hidden=false;
  }catch{hide()}
 }
 function init(){
  launcher=$('sbc-chatgpt-os-launch');
  if(!launcher){launcher=doc.createElement('button');launcher.type='button';launcher.id='sbc-chatgpt-os-launch';
   launcher.className='sbc-chatgpt-os-floating';launcher.textContent='✦ Ask ChatGPT';launcher.hidden=true;doc.body.appendChild(launcher)}
  launcher.addEventListener('click',open);
  if(typeof root.MutationObserver==='function'){
   if($('app'))new root.MutationObserver(verifyOwner).observe($('app'),{attributes:true,attributeFilter:['class']});
   if($('desk'))new root.MutationObserver(verifyOwner).observe($('desk'),{attributes:true,attributeFilter:['hidden']});
  }
  $('logoutBtn')?.addEventListener('click',hide);
  doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='visible')verifyOwner()});
  verifyOwner();
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});else init();
 root.SBC_CHATGPT_OS=Object.freeze({open,refreshAuth:verifyOwner});
})(typeof window!=='undefined'?window:null);
