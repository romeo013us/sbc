/* SBC_LEAD_PROFILE: one CRM account record across lead list, research, sales and website production. */
(function(){
'use strict';
if(window.SBC_LEAD_PROFILE)return;
var currentId='',current=null,revision='',busy=false;
function q(s){return document.querySelector(s);}
function E(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function name(v){return String(v==null?'':v).trim();}
function role(){return String(window.state&&state.me&&state.me.role||'');}
function ownerOnly(){return role()==='owner';}
function recovery(){var d=window.state&&state.data||{};return Boolean(d.recovery&&d.recovery.required||d.recoveryRequired||d.readOnly||d.mysqlRecoveryRequired);}
function local(id){return (window.state&&state.data&&state.data.customers||[]).find(function(x){return String(x.id)===String(id);})||null;}
function parseJson(raw){if(raw&&typeof raw==='object'&&!Array.isArray(raw))return raw;try{var obj=JSON.parse(raw||'{}');return obj&&typeof obj==='object'&&!Array.isArray(obj)?obj:{};}catch(_){return {};}}
function link(v){try{var url=new URL(String(v||''));return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch(_){return '';}}
function htmlLink(v){var u=link(v);return u?'<a href="'+E(u)+'" target="_blank" rel="noopener noreferrer">'+E(v)+'</a>':E(v||'Not recorded');}
function detailed(c){var intel=parseJson(c.lead_intelligence_json||c.leadIntelligence||{});var brief=intel.researchBrief&&typeof intel.researchBrief==='object'?intel.researchBrief:{};return {googleBusinessUrl:name(brief.googleBusinessUrl||c.googleBusinessUrl),researchSource:name(brief.researchEvidenceUrl||c.verificationSource||c.source),researchBrief:brief};}
function blocked(c){return Boolean(recovery()||c&&c._recoveryProjection);}
function suppressed(c){return Boolean(c&&(c.doNotContact||c.doNotCall||c.salesSuppressed||c.isSuppressed||['do not call','do not contact','dnc','opt out','unsubscribe'].includes(String(c.status||'').toLowerCase())));}
function cardField(label,v,asLink){return '<div class="sbc-profile-field"><span>'+E(label)+'</span><strong>'+(asLink?htmlLink(v):E(v||'Not recorded'))+'</strong></div>';}
function noteList(c){var account=Array.isArray(c.accountNotes)?c.accountNotes:[];return account.slice(-15).reverse().map(function(n){return '<div class="sbc-profile-event"><strong>'+E(n.authorName||'SBC team')+'</strong><small>'+E(n.createdAt||'')+'</small><p>'+E(n.note||'')+'</p></div>';}).join('')||'<p class="mini">No account notes yet.</p>';}
function eventList(id){var events=(window.state&&state.data&&state.data.activities||[]).filter(function(a){return String(a.meta&&a.meta.customerId||a.customerId||'')===id;});return events.slice(-12).reverse().map(function(a){return '<div class="sbc-profile-event"><strong>'+E(a.type||'Activity')+'</strong><small>'+E(a.createdAt||'')+'</small><p>'+E(a.message||'')+'</p></div>';}).join('')||'<p class="mini">No logged activity in the loaded CRM view.</p>';}
function btn(action,label,disabled,tip){return '<button class="btn'+(action==='edit'?' primary':'')+'" type="button" data-sbc-profile-action="'+action+'"'+(disabled?' disabled':'')+(tip?' title="'+E(tip)+'"':'')+'>'+E(label)+'</button>';}
function render(message){
 var c=current||local(currentId);if(!c)return;
 var d=detailed(c),canEdit=ownerOnly()&&!blocked(c),canContact=!blocked(c)&&!suppressed(c);
 var html='<section id="sbcLeadAccount360" data-sbc-lead-id="'+E(currentId)+'" class="sbc-lead-account"><div class="sbc-profile-head"><div><p class="mini">SBC · ACCOUNT 360 · CRM RECORD '+E(currentId)+'</p><h2>'+E(c.businessName||c.business_name||'Unnamed business')+'</h2><p>'+E(c.industry||c.category||'Industry not recorded')+' · '+E(c.status||'Lead')+' · '+E(c.source||'Source not recorded')+'</p></div><span class="badge '+(suppressed(c)?'red':'blue')+'">'+E(suppressed(c)?'Contact suppressed':blocked(c)?'Recovery read-only':'CRM account')+'</span></div>'+
 '<div role="status" aria-live="polite" class="mini" id="sbcProfileStatus">'+E(message||(!revision?'Display mode — authoritative edit record not verified.':'Account loaded from the authenticated CRM.'))+'</div>'+
 '<div class="sbc-profile-actions">'+btn('call','☎ Call from SBC',!canContact||!c.phone,'Requires a callable phone and no suppression')+btn('edit','✎ Edit Profile',!canEdit||!revision,'Requires owner access and verified CRM revision')+btn('note','＋ Save Note',!canEdit,'Append an account note')+'<details class="sbc-profile-more"><summary>More account actions</summary><div class="sbc-profile-more-buttons">'+btn('email','✉ Email',!canContact||!c.email,'Opens existing SBC email composer')+btn('text','▣ Text',!canContact||!c.phone,'Only send with documented consent')+btn('website','🌐 Build Website',!canEdit,'Existing SBC native website production')+btn('callreport','✓ Log Call',blocked(c),'Submit the call result to the existing sales pipeline')+btn('refresh','↻ Refresh',false)+btn('delete','Delete Lead',!canEdit,'Owner only; requires explicit confirmation')+'</div></details></div>'+
 '<div id="sbcProfileActionSlot"></div>'+
 '<div class="sbc-profile-columns"><section class="sbc-profile-panel"><h3>Business & decision maker</h3><div class="sbc-profile-fields">'+
 cardField('Business name',c.businessName||c.business_name)+cardField('Decision maker',c.contactName||c.contact_name)+cardField('Primary phone',c.phone)+cardField('Email',c.email)+cardField('Street / city / state / ZIP',c.address)+cardField('Industry / business type',c.industry)+cardField('Website',c.website,true)+cardField('Google Business Profile',d.googleBusinessUrl,true)+cardField('Research source',d.researchSource,true)+cardField('Status',c.status)+cardField('Next follow-up',c.followUp||c.follow_up)+cardField('Assigned to',c.assignedTo||c.assigned_to)+'</div></section>'+
 '<section class="sbc-profile-panel"><h3>Research & opportunity</h3><div class="sbc-profile-fields">'+cardField('Website status',c.websiteStatus||c.website_status)+cardField('GBP research check',d.researchBrief.googleBusinessPresence)+cardField('Years in business',d.researchBrief.yearsInBusiness)+cardField('Verified services',d.researchBrief.specificServices)+cardField('Lead notes',c.notes)+'</div><p class="mini">Researcher observations are not automatically verified. Missing information stays marked as not recorded.</p></section>'+
 '<section class="sbc-profile-panel"><h3>Account notes</h3>'+noteList(c)+'</section>'+
 '<section class="sbc-profile-panel"><h3>Activity history</h3>'+eventList(currentId)+'</section></div></section>';
 if(typeof window.openModal==='function')window.openModal('Lead Account 360',html);
 var node=q('#sbcLeadAccount360');if(node)node.addEventListener('click',handleClick);
}
function status(v){var x=q('#sbcProfileStatus');if(x)x.textContent=String(v);}
function actionHtml(markup){var slot=q('#sbcProfileActionSlot');if(slot){slot.innerHTML=markup;slot.scrollIntoView({behavior:'smooth',block:'nearest'});}}
function uiField(key,label,value,attrs){return '<label>'+E(label)+'<input name="'+E(key)+'" value="'+E(value||'')+'" '+(attrs||'maxlength="255"')+'></label>';}
function edit(){
 if(!ownerOnly()||blocked(current)||!revision)return status('Owner access and a verified, writable CRM revision are required.');
 var c=current,d=detailed(c);
 var h='<form id="sbcProfileEdit" class="sbc-profile-form"><h3>Edit account details</h3><p class="mini">This updates the existing CRM lead, not a duplicate. Save is checked against the latest database revision.</p><div class="sbc-profile-editgrid">'+
 uiField('businessName','Business name',c.businessName||c.business_name,'required maxlength="255"')+uiField('contactName','Decision maker',c.contactName||c.contact_name,'maxlength="255"')+
 uiField('phone','Phone',c.phone,'maxlength="80"')+uiField('email','Email',c.email,'type="email" maxlength="255"')+
 uiField('website','Website',c.website,'maxlength="300" placeholder="https://..."')+uiField('address','Business address',c.address,'maxlength="500" placeholder="Street, city, state ZIP"')+
 uiField('industry','Business type / category',c.industry,'maxlength="160"')+uiField('googleBusinessUrl','Google Business Profile URL',d.googleBusinessUrl,'type="url" maxlength="500" placeholder="https://www.google.com/maps/..."')+
 '<label>Status<select name="status">'+['Lead','Prospect','Contacted','Follow Up','Qualified','Interested','Not Interested','Appointment Set','Customer','Not Qualified','Do Not Call','Lost'].map(function(x){return '<option'+(x===c.status?' selected':'')+'>'+E(x)+'</option>';}).join('')+'</select></label>'+
 '<label class="sbc-profile-wide">Research / sales notes<textarea name="notes" maxlength="4000" rows="4">'+E(c.notes||'')+'</textarea></label></div>'+
 '<div class="actions"><button type="submit" class="btn primary">Save verified CRM changes</button><button type="button" class="btn" data-sbc-profile-action="cancel">Cancel</button></div><p class="mini" id="sbcProfileEditStatus" role="status"></p></form>';
 actionHtml(h);q('#sbcProfileEdit')?.addEventListener('submit',save);
}
async function save(event){
 event.preventDefault();if(busy||!ownerOnly()||blocked(current)||!revision)return;
 busy=true;var form=event.currentTarget,submit=form.querySelector('button[type=submit]'),msg=q('#sbcProfileEditStatus');
 if(submit)submit.disabled=true;
 try{
  var payload=Object.fromEntries(new FormData(form).entries());payload.revision=revision;
  var response=await fetch('/api/v6606/crm/leads/'+encodeURIComponent(currentId),{method:'PATCH',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(payload)});
  var result=await response.json().catch(function(){return {};});
  if(!response.ok||result.ok!==true||result.durable!==true)throw Error(response.status===409?'Another team member updated this lead. Refresh before editing again.':result.code||'CRM did not confirm a durable save.');
  var localRow=local(currentId);if(localRow){Object.keys(payload).forEach(function(k){if(k!=='revision'&&k!=='googleBusinessUrl')localRow[k]=payload[k];});localRow.googleBusinessUrl=payload.googleBusinessUrl;}
  await open(currentId,'Profile saved and verified in the authoritative CRM.');
 }catch(err){if(msg)msg.textContent='Not saved: '+String(err.message||err);}
 finally{busy=false;if(submit)submit.disabled=false;}
}
function noteForm(){
 if(!ownerOnly()||blocked(current))return status('Notes are read-only during recovery or for this role.');
 actionHtml('<form id="sbcProfileNoteForm" class="sbc-profile-form"><h3>Append account note</h3><p class="mini">Keep customer history; do not store payment card details, passwords or credentials.</p><textarea name="note" rows="4" maxlength="3000" required placeholder="What happened and what is the next step?"></textarea><div class="actions"><button type="submit" class="btn primary">Save Note</button><button type="button" class="btn" data-sbc-profile-action="cancel">Cancel</button></div><p role="status" id="sbcProfileNoteStatus"></p></form>');
 q('#sbcProfileNoteForm')?.addEventListener('submit',async function(event){event.preventDefault();if(busy)return;busy=true;var box=q('#sbcProfileNoteStatus'),submit=event.currentTarget.querySelector('button[type=submit]');submit.disabled=true;
 try{var body={note:String(new FormData(event.currentTarget).get('note')||'').trim()};if(!body.note)throw Error('Enter a note.');
  var response=await fetch('/api/customers/'+encodeURIComponent(currentId)+'/account-notes',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(body)});
  var result=await response.json().catch(function(){return {};});if(!response.ok||result.error)throw Error(result.error||result.message||'Account note was not saved.');
  var c=local(currentId);if(c){c.accountNotes=Array.isArray(c.accountNotes)?c.accountNotes:[];c.accountNotes.push({authorName:'Owner',createdAt:new Date().toISOString(),note:body.note});}
  current=c||current;render('Note submitted to the existing SBC account.');
 }catch(err){if(box)box.textContent=String(err.message||err);}finally{busy=false;submit.disabled=false;}
 });
}
function callForm(){
 if(blocked(current))return status('Call results cannot be saved during recovery.');
 actionHtml('<form id="sbcProfileCallForm" class="sbc-profile-form"><h3>Log call outcome</h3><p class="mini">Saves to SBC call reports and refreshes the Kim queue. No phone call is placed by logging a result.</p><div class="sbc-profile-editgrid">'+
 uiField('contactName','Who answered?',current.contactName||current.contact_name,'maxlength="255"')+
 '<label>Outcome<select name="outcome">'+['No Answer','Left Voicemail','Interested','Appointment Requested','Call Back','Not Interested','Order Ready','Bad Number','Closed Business','Not Qualified','Duplicate','Do Not Call'].map(function(v){return '<option>'+E(v)+'</option>';}).join('')+'</select></label>'+
 '<label>Callback date & time<input type="datetime-local" name="callbackAt"></label>'+
 '<label class="sbc-profile-wide">Conversation notes / agreed next step<textarea name="notes" rows="4" required maxlength="4000" placeholder="Call disposition and what happens next"></textarea></label></div><div class="actions"><button class="btn primary" type="submit">Save call result</button><button class="btn" type="button" data-sbc-profile-action="cancel">Cancel</button></div><p class="mini" role="status" id="sbcProfileCallStatus"></p></form>');
 q('#sbcProfileCallForm')?.addEventListener('submit',async function(event){event.preventDefault();if(busy)return;busy=true;var submit=event.currentTarget.querySelector('button[type=submit]'),msg=q('#sbcProfileCallStatus');submit.disabled=true;
 try{var data=Object.fromEntries(new FormData(event.currentTarget).entries());data.customerId=currentId;data.services=[];data.appointmentRequested=data.outcome==='Appointment Requested';data.orderReady=data.outcome==='Order Ready';data.paymentGuideRequested=false;
 var response=await fetch('/api/call-reports',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(data)});
 var result=await response.json().catch(function(){return {};});if(!response.ok||result.error)throw Error(result.error||result.message||'Call result not accepted.');
 if(typeof window.loadSalesQueue==='function')window.loadSalesQueue().catch(function(){});
 render('Call result submitted to the SBC owner review pipeline. The queue refresh was requested.');
 }catch(err){if(msg)msg.textContent='Not saved: '+String(err.message||err);}finally{busy=false;submit.disabled=false;}
 });
}
async function open(id,message){
 currentId=name(id);if(!currentId)return;var start=currentId;
 var preliminary=local(start);
 var queue=window.state&&state.salesQueue&&Array.isArray(state.salesQueue.leads)?state.salesQueue.leads:[];
 var fromQueue=queue.find(function(x){return String(x.id)===start;});
 if(!preliminary&&!fromQueue&&!ownerOnly())return window.toast&&window.toast('This account is not assigned to your visible lead list.');
 current={...(preliminary||fromQueue||{id:start,businessName:'Loading business details…'})};revision='';
 render('Loading the latest authenticated CRM record…');
 try{
  var response=await fetch('/api/v6519/crm/leads/'+encodeURIComponent(start),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
  var result=await response.json().catch(function(){return {};});
  if(!response.ok||result.ok!==true||!result.data)throw Error(result.code||'Authoritative CRM detail unavailable.');
  if(start!==currentId||String(result.data.id)!==start)throw Error('Lead identity changed while loading.');
  revision=/^[a-f0-9]{64}$/.test(result.data.revision||'')?result.data.revision:'';
  var d=result.data,currentLocal=local(start)||{};
  current={...currentLocal,...d,businessName:d.business_name,contactName:d.contact_name,phone:d.phone,email:d.email,website:d.website,address:d.address,industry:d.industry,status:d.status,notes:d.notes,source:d.source,followUp:d.follow_up};
  render(message||'Latest CRM details verified; no edits made.');
 }catch(error){revision='';render('Read-only local profile; authoritative CRM refresh failed: '+String(error.message||error));}
}
function deleteLead(){
 if(!ownerOnly()||blocked(current))return status('Only the owner may remove a lead.');
 var label=name(current.businessName||current.business_name||'this lead');
 if(!window.confirm('Remove '+label+' from the SBC CRM? This action may be irreversible.'))return;
 if(window.prompt('Type DELETE to confirm removal of '+label+':')!=='DELETE')return;
 if(typeof window.deleteCustomer==='function')window.deleteCustomer(currentId);
 else status('Existing CRM delete operation is not available; no lead was changed.');
}
function handleClick(event){
 var el=event.target.closest('[data-sbc-profile-action]');if(!el)return;event.preventDefault();
 var a=el.dataset.sbcProfileAction,c=current||local(currentId);
 if(a==='refresh')return open(currentId);
 if(a==='cancel'){var x=q('#sbcProfileActionSlot');if(x)x.innerHTML='';return;}
 if(a==='edit')return edit();
 if(a==='note')return noteForm();
 if(a==='callreport')return callForm();
 if(a==='delete')return deleteLead();
 if(blocked(c)||suppressed(c))return status('Outreach is blocked for a recovered or suppressed account.');
 if(a==='call'){if(c.phone&&typeof window.openSbcDialer==='function')window.openSbcDialer(currentId);else status('No callable number or SBC dialer is available.');}
 if(a==='email'){if(c.email&&typeof window.sendEmailToLead==='function')window.sendEmailToLead(currentId);else status('No customer email or SBC composer is available.');}
 if(a==='text'){if(c.phone&&typeof window.sendSmsToLead==='function')window.sendSmsToLead(currentId);else status('No customer phone or SBC SMS composer is available. Only send with documented consent.');}
 if(a==='website'){
  if(!ownerOnly())return status('Website builds require owner permission.');
  if(window.SBC_WEBSITE_PRODUCTION&&typeof window.SBC_WEBSITE_PRODUCTION.build==='function')window.SBC_WEBSITE_PRODUCTION.build(currentId,'essentials',c);
  else status('SBC Website Production is unavailable. No site was built.');
 }
}
window.SBC_LEAD_PROFILE=Object.freeze({open:open,refresh:function(){return open(currentId);},isOwner:ownerOnly});
// Existing email, SMS, calling, and website actions stay in their own guarded subsystems.
window.sbcOpenLeadProfile=open;
(function style(){var tag=document.createElement('style');tag.id='sbc-lead-profile-style';tag.textContent='.sbc-lead-account{max-width:1150px;color:var(--text,#e7f1ff)}.sbc-profile-head{display:flex;justify-content:space-between;align-items:start;gap:18px;flex-wrap:wrap}.sbc-profile-head h2{font-size:clamp(22px,3vw,30px);margin:7px 0}.sbc-profile-actions{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.sbc-profile-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.sbc-profile-panel,.sbc-profile-form{border:1px solid #526987;border-radius:13px;padding:16px;margin-top:10px;background:rgba(24,47,74,.2)}.sbc-profile-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}.sbc-profile-field{min-width:0;overflow-wrap:anywhere}.sbc-profile-field span{display:block;font-size:12px;opacity:.75;margin-bottom:4px}.sbc-profile-field strong{font-size:14px}.sbc-profile-field a{color:#69b8ff}.sbc-profile-event{padding:10px 0;border-bottom:1px solid #53698750}.sbc-profile-event p{white-space:pre-wrap;margin:6px 0}.sbc-profile-event small{display:block;opacity:.65}.sbc-profile-more{min-width:185px}.sbc-profile-more>summary{cursor:pointer;padding:11px 14px;border:1px solid #7d9eb7;border-radius:9px;font-weight:740}.sbc-profile-more-buttons{display:flex;flex-wrap:wrap;gap:8px;padding:10px 0}.sbc-profile-more-buttons>.btn{flex:1 1 auto}.sbc-profile-more>summary:focus-visible{outline:3px solid #f2a34d;outline-offset:2px}.sbc-profile-editgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.sbc-profile-editgrid label{display:grid;gap:6px}.sbc-profile-editgrid input,.sbc-profile-editgrid textarea,.sbc-profile-editgrid select,.sbc-profile-form textarea{width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #8da9bd;padding:10px;background:#f6f9ff;color:#12243b}.sbc-profile-wide{grid-column:1/-1}#modal:has(.sbc-lead-account) .modal-card{max-width:min(1250px,97vw);max-height:94vh;overflow:auto}body[data-theme="light"] .sbc-profile-panel,body[data-theme="light"] .sbc-profile-form{background:#f5f8fd;color:#16334b}@media(max-width:760px){.sbc-profile-columns,.sbc-profile-editgrid,.sbc-profile-fields{grid-template-columns:1fr}.sbc-profile-wide{grid-column:auto}.sbc-profile-actions .btn{flex:1 1 auto}}';document.head.appendChild(tag);})();
})();