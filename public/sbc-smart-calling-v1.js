/* SBC Smart Calling V1 — private, website-first manual sales workflow.
 * Research evidence and preview approval come only from authenticated backend data.
 * This UI never initiates outreach, books, bills, or changes consent on its own.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SBC_SMART_CALLING=api;
})(typeof window!=='undefined'?window:{},function(){
 'use strict';
 const TYPES=['CONNECTED','NO_ANSWER','FOLLOW_UP_REQUESTED','BAD_NUMBER','DO_NOT_CONTACT'];
 const limited=(x,n=140)=>String(x??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n);
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function suppressed(c){
  return !!(c?.doNotCall||c?.doNotContact||c?.salesSuppressed||c?.isSuppressed||
   ['do not call','do not contact','dnc','opt out','unsubscribe','lost'].includes(String(c?.status||'').toLowerCase().trim()));
 }
 function project(customer,row,settings={}){
  const c=customer||{},r=row&&String(row.customerId)===String(c.id)?row:null;
  const role=String(settings.role||'owner'),locked=!!(settings.readOnly||settings.recoveryRequired);
  const verified=r?.verifiedResearch===true;
  const hasVerifiedDemo=!!(r?.websiteId&&/^\/demo\/[a-zA-Z0-9%._~-]+$/.test(String(r.websiteUrl||''))&&
   !['REVIEW_WEBSITE','BUILD_WEBSITE','RESEARCH_REQUIRED'].includes(r.stage));
  const canOpenCall=!!(!locked&&!suppressed(c)&&['owner','manager','caller','account_manager'].includes(role)&&
   r?.callAllowed===true&&limited(c.phone||r?.phone));
  const canLog=!!(!locked&&!suppressed(c)&&['owner','account_manager'].includes(role)&&c.id);
  return {
   hasVerifiedDemo,canOpenCall,canLog,canBuild:role==='owner'&&!locked,
   canSchedule:['owner','manager','caller','account_manager'].includes(role)&&!locked&&!suppressed(c),
   stage:r?.stage||'UNVERIFIED',demoUrl:hasVerifiedDemo?r.websiteUrl:'',
   nextAction:r?.nextAction||'Confirm research and website approval in SBC before making claims.',
   scriptOptions:{businessName:limited(c.businessName||c.business_name||r?.businessName||'your business'),
    contactName:limited(c.contactName||c.contact_name||r?.contactName||'',80),
    ownerVerified:verified&&r?.ownerContactVerified===true,
    googleVerified:verified&&r?.googleBusinessVerified===true,
    websitePresence:verified&&['found','not_found'].includes(r?.websitePresence)?r.websitePresence:'not_checked',
    approved:hasVerifiedDemo,callerName:'John'}
  };
 }
 function outcomeData(outcome,note,dueDate){
  const kind=String(outcome||''),clean=limited(note,1000);
  if(!TYPES.includes(kind))throw Error('Choose a valid outcome.');
  if(clean.length<12)throw Error('Enter a useful note (at least 12 characters).');
  if(clean.length>1000)throw Error('The note is too long.');
  const result={outcome:kind,note:clean};
  if(kind==='FOLLOW_UP_REQUESTED'||(kind==='CONNECTED'&&dueDate)){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate||''))||!Number.isFinite(Date.parse(dueDate+'T12:00:00Z')))
    throw Error('Choose a valid follow-up date.');
   result.dueDate=dueDate;
  }
  return result;
 }
 function installStyle(doc){
  if(doc.getElementById('sbcSmartCallStyle'))return;
  const css=doc.createElement('style');css.id='sbcSmartCallStyle';
  css.textContent='.sbc-smart-call{background:#12263c!important;color:#f3f8ff!important;border:1px solid #6b90b0!important;grid-column:1/-1}' +
   '.sbc-smart-call :is(h3,h4,p,strong,label,small){color:#f3f8ff!important}.sbc-smart-call .sbc-sc-muted{color:#c7d9ee!important}' +
   '.sbc-sc-bar{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}' +
   '.sbc-sc-tools{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}' +
   '.sbc-smart-call .sbc-sc-script{background:#071829;color:#f4f9ff;border:1px solid #6a8aa8;border-radius:10px;padding:16px;white-space:pre-wrap;line-height:1.65;font:13px/1.65 system-ui,sans-serif;max-height:340px;overflow:auto;overflow-wrap:anywhere}' +
   '.sbc-sc-form{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}' +
   '.sbc-sc-form label{display:flex;flex-direction:column;gap:6px;font-weight:650}' +
   '.sbc-sc-form select,.sbc-sc-form textarea,.sbc-sc-form input{box-sizing:border-box;width:100%;background:#f8fbff!important;color:#12263c!important;border:1px solid #809bb4!important;border-radius:8px;padding:10px}' +
   '.sbc-sc-form .sbc-sc-wide{grid-column:1/-1}.sbc-sc-form .btn{width:max-content;max-width:100%}' +
   '.sbc-sc-status{min-height:20px;font-weight:650}.sbc-sc-status[data-error="true"]{color:#ffb7bb!important}' +
   '@media(max-width:740px){.sbc-sc-form{grid-template-columns:1fr}.sbc-sc-form .sbc-sc-wide{grid-column:auto}}';
  doc.head.appendChild(css);
 }
 function requestId(win){
  const crypto=win.crypto;if(typeof crypto?.randomUUID==='function')return 'sbc-action-'+crypto.randomUUID().replace(/-/g,'');
  if(typeof crypto?.getRandomValues==='function'){
   const b=new Uint8Array(16);crypto.getRandomValues(b);return 'sbc-action-'+Array.from(b,v=>v.toString(16).padStart(2,'0')).join('');
  }
  throw Error('Secure browser identifier unavailable. Update your browser.');
 }
 async function mount(host,customer,settings={}){
  if(!host||!customer?.id)return;
  const win=host.ownerDocument?.defaultView;if(!win)return;
  const doc=host.ownerDocument;installStyle(doc);
  host.querySelector('.sbc-smart-call')?.remove();
  const panel=doc.createElement('section');panel.className='sbc-profile-panel sbc-smart-call';
  panel.setAttribute('aria-label','SBC Smart Calling — website-first sales');
  panel.innerHTML='<h3>☎ SBC Smart Calling</h3><p class="sbc-sc-muted" role="status">Checking verified research and website approval…</p>';
  const target=host.querySelector('#sbcProfileActionSlot');
  if(target)target.insertAdjacentElement('afterend',panel);else host.prepend(panel);
  let row=null,loadError='',isSaving=false,terminal=false;
  const active=()=>panel.isConnected&&String(host.dataset.sbcLeadId||'')===String(customer.id);
  const status=(message,error=false)=>{const el=panel.querySelector('.sbc-sc-status');if(el){el.textContent=message;el.dataset.error=String(error);}};
  try{
   const response=await win.fetch('/api/website-production/call-desk?customerId='+encodeURIComponent(customer.id)+'&limit=1',
    {credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
   const body=await response.json().catch(()=>({}));
   if(!response.ok||body.ok!==true||!Array.isArray(body.rows))throw Error('Verified call desk unavailable.');
   row=body.rows.find(x=>String(x.customerId)===String(customer.id))||null;
  }catch(error){loadError=String(error?.message||'Readiness check unavailable.');}
  if(!active())return;
  const ctx=project(customer,row,{...settings,readOnly:settings.readOnly||terminal});
  const library=win.SBC_WEBSITE_SALES_SCRIPT;
  const script=library&&typeof library.build==='function'?library.build(ctx.scriptOptions):
   'Sales script unavailable. Refresh the Command Center before making calls.';
  const hasNumber=!!limited(customer.phone||row?.phone);
  panel.innerHTML='<div class="sbc-sc-bar"><div><h3>☎ SBC Smart Calling</h3><p class="sbc-sc-muted">One account · verified website · human call · dated next step</p></div>' +
   '<strong>'+esc(ctx.stage.replace(/_/g,' '))+'</strong></div>' +
   '<p class="sbc-sc-muted">'+esc(loadError||ctx.nextAction)+'</p>' +
   '<div class="sbc-sc-tools">' +
   '<button type="button" class="btn primary" data-sc-action="call" '+(!ctx.canOpenCall?'disabled':'')+'>☎ Call from SBC</button>' +
   '<button type="button" class="btn" data-sc-action="preview" '+(!ctx.hasVerifiedDemo?'disabled':'')+'>↗ Show approved website</button>' +
   '<button type="button" class="btn" data-sc-action="build" '+(!ctx.canBuild?'disabled':'')+'>Build private $199 concept</button>' +
   '<button type="button" class="btn" data-sc-action="appointment" '+(!ctx.canSchedule?'disabled':'')+'>📅 Book 10-minute demo</button>' +
   '<button type="button" class="btn" data-sc-action="copy">Copy script</button></div>' +
   '<p class="sbc-sc-muted">'+(ctx.hasVerifiedDemo?'Approved website preview verified in SBC.':'No approved website preview confirmed; do not say it is built.') +
   (!ctx.canOpenCall?(hasNumber?' Calling requires verified readiness and authorization.':' Verify a working phone before calling.'):' Calling still requires server-side Twilio clearance.')+'</p>' +
   '<pre class="sbc-sc-script" id="sbcSmartCallScript">'+esc(script)+'</pre>' +
   (ctx.canLog?'<form class="sbc-sc-form" id="sbcSmartCallOutcome"><label>What happened?' +
    '<select name="outcome" required><option value="CONNECTED">Spoke to owner (connected)</option>' +
    '<option value="NO_ANSWER">No answer</option><option value="FOLLOW_UP_REQUESTED">Requested callback</option>' +
    '<option value="BAD_NUMBER">Bad number</option><option value="DO_NOT_CONTACT">Do not contact</option></select></label>' +
    '<label>Agreed follow-up date (required for callback)<input type="date" name="dueDate"></label>' +
    '<label class="sbc-sc-wide">Conversation notes and next step<textarea name="note" minlength="12" maxlength="1000" rows="3" required placeholder="Who answered, what they asked, and the next action"></textarea></label>' +
    '<button type="submit" class="btn primary">Save outcome & follow-up</button></form>':
    '<p class="sbc-sc-muted">Outcome logging requires an active owner or assigned Account Manager in writable mode.</p>') +
   '<p class="sbc-sc-status" role="status" aria-live="polite"></p>' +
   '<p class="sbc-sc-muted"><small>Manual, permission-gated calling only. No automatic calls, texts, emails, AI voice outreach, bookings or payments. Respect opt-outs and applicable solicitation laws.</small></p>';
  panel.addEventListener('click',async event=>{
   const btn=event.target.closest('[data-sc-action]');if(!btn||btn.disabled)return;
   const action=btn.dataset.scAction;
   if(action==='copy'){
    try{await win.navigator.clipboard.writeText(script);status('Script copied. No outreach sent.');}
    catch{status('Clipboard blocked. Select the script text above to copy it.',true);}
   }
   if(action==='call'){
    if(!ctx.canOpenCall)return status('Calling readiness is not verified.',true);
    if(typeof win.openSbcDialer==='function')win.openSbcDialer(customer.id);
    else status('SBC dialer unavailable; no call placed.',true);
   }
   if(action==='preview'){
    if(!ctx.hasVerifiedDemo)return status('No approved preview is ready.',true);
    if(typeof win.SBC_WEBSITE_PRODUCTION?.openExisting==='function')win.SBC_WEBSITE_PRODUCTION.openExisting(customer.id,customer);
    else status('Approved preview exists, but the SBC viewer is unavailable.',true);
   }
   if(action==='build'){
    if(!ctx.canBuild)return;
    if(typeof win.SBC_WEBSITE_PRODUCTION?.build==='function')win.SBC_WEBSITE_PRODUCTION.build(customer.id,'starter',customer);
    else status('Website Studio unavailable. No website was created.',true);
   }
   if(action==='appointment'){
    if(!ctx.canSchedule)return;
    if(typeof win.sbcBookWebsiteDemo==='function')win.sbcBookWebsiteDemo(customer.id);
    else status('Appointment editor unavailable. No meeting booked.',true);
   }
  });
  panel.querySelector('#sbcSmartCallOutcome')?.addEventListener('submit',async event=>{
   event.preventDefault();if(isSaving||terminal)return;
   const form=event.currentTarget,button=form.querySelector('button[type=submit]');
   try{
    const fields=new win.FormData(form),kind=String(fields.get('outcome')||'');
    const data=outcomeData(kind,fields.get('note'),fields.get('dueDate'));
    if(kind==='DO_NOT_CONTACT'&&!win.confirm('Suppress all further SBC sales contact for this account?'))return;
    if(!active())return;
    isSaving=true;button.disabled=true;status('Saving to the authoritative account record…');
    const response=await win.fetch('/api/v6606/crm/account-portfolios/'+encodeURIComponent(customer.id)+'/interaction',{
     method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',Accept:'application/json'},
     body:JSON.stringify({...data,requestId:requestId(win)})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result.ok!==true||result.durable!==true)throw Error(result.code||result.message||'CRM did not confirm a durable save.');
    terminal=kind==='DO_NOT_CONTACT'||kind==='BAD_NUMBER';
    if(terminal){form.querySelectorAll('input,textarea,select,button').forEach(el=>el.disabled=true);
     panel.querySelector('[data-sc-action="call"]')?.setAttribute('disabled','');}
    status('Saved to SBC account history'+(data.dueDate?' with follow-up '+data.dueDate:'')+'. No contact was sent.');
    // Existing account and calendar refresh remain user controlled.
   }catch(error){status('Not saved: '+String(error?.message||error),true);}
   finally{isSaving=false;if(!terminal&&active())button.disabled=false;}
  });
 }
 return Object.freeze({project,outcomeData,mount});
});
