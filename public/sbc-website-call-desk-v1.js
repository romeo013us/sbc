/* SBC Website Call Desk: Lorna-verified leads → full sites → human call → appointment.
 * AI call coach is a deterministic drafting assistant; it never places calls. */
(function(){
 'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const role=()=>String((typeof state!=='undefined'&&state?.me?.role)||'');
 const allowed=()=>['owner','manager','caller'].includes(role());
 const fmt=x=>x?new Date(x).toLocaleString():'—';
 let desk=null,selectedId='',loading=false;
 const labels={READY_TO_CALL:'Ready to call',INTERESTED:'Interested',APPOINTMENT_BOOKED:'Meeting booked',
  REVIEW_WEBSITE:'Owner review',BUILD_WEBSITE:'Build full website',RESEARCH_REQUIRED:'Return to Lorna',
  CONTACT_UNVERIFIED:'Verify contact',NUMBER_COOLDOWN:'Bad number · 15-day hold',
  DECLINED:'Declined',SUPPRESSED:'Do not contact'};
 const statuses={
  NO_ANSWER:'No answer',INTERESTED:'Interested',CALLBACK_REQUESTED:'Asked for a callback',
  NOT_INTERESTED:'Not interested',BAD_NUMBER:'Bad number · 15-day research hold',
  DO_NOT_CALL:'Do not contact (suppression)',ALREADY_HAS_WEBSITE:'Already has website',
  APPOINTMENT_REQUESTED:'Requested walkthrough'
 };
 function notice(msg,isError=false){
  const el=document.getElementById('sbcCallDeskNotice');
  if(el){el.textContent=msg;el.style.color=isError?'#a11f33':'#1b6e58'}
 }
 const current=()=>desk?.rows?.find(x=>x.customerId===selectedId);
 function leader(){
  const m=desk?.summary||{};
  const stats=[['Ready for human calling',m.readyToCall],['Websites to build',m.needsBuild],['Awaiting owner review',m.awaitingReview],
   ['Return to research',m.requiresResearch],['Meetings booked',m.booked],['Suppressed',m.suppressed]];
  return '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 22px">'+stats.map(([name,value])=>
   '<div style="min-width:125px;flex:1;border:1px solid #dde8e4;background:#f6fbfa;border-radius:12px;padding:15px">'+
   '<div style="font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#475569">'+esc(name)+'</div>'+
   '<strong style="font-size:25px;display:block;margin-top:8px">'+esc(value||0)+'</strong></div>').join('')+'</div>';
 }
 function leadCards(){
  return (desk?.rows||[]).map(x=>
   '<button type="button" data-sbc-webcall-lead="'+esc(x.customerId)+'" style="display:block;text-align:left;width:100%;background:'+
   (x.customerId===selectedId?'#e8f4ef':'#fff')+';border:1px solid '+(x.customerId===selectedId?'#16846d':'#dfe5e8')+
   ';border-radius:12px;padding:13px;margin:0 0 9px;cursor:pointer;color:#132534">'+
   '<strong style="display:block;font-size:13px">'+esc(x.businessName)+'</strong>'+
   '<span style="display:block;font-size:11px;margin:6px 0;color:#586679">'+esc(labels[x.stage]||x.stage)+'</span>'+
   '<small style="font-size:10px">'+esc(x.websiteTier==='starter'?'$199 one-page site':x.websiteTier==='essentials'?'$349 four-page site':'No website created yet')+'</small></button>'
  ).join('')||'<p>No visible assigned leads. Research, verification or assignment may still be needed.</p>';
 }
 function detail(){
  const x=current();
  if(!x)return '<div style="padding:20px">Select a verified business to see the completed site and calling plan.</div>';
  const ready=x.callAllowed===true;
  const script='<pre id="sbcWebcallScript" style="white-space:pre-wrap;word-break:break-word;font:13px/1.7 system-ui,Arial,sans-serif;background:#f7fafb;border:1px solid #e0e8ea;border-radius:12px;padding:17px">'+esc(x.script)+'</pre>';
  const phone=ready&&x.phone?'<span style="font-weight:800">'+esc(x.phone)+'</span> · <button type="button" class="btn" id="sbcWebcallCopyPhone">Copy Number</button>':'<strong>No outbound call is authorized from this screen.</strong>';
  const site=x.websiteId
   ?'<button type="button" id="sbcWebcallOpenSite" class="btn primary">Open Complete Website</button>'
   :'<button type="button" id="sbcWebcallBuildSite" class="btn primary">Build Complete Website</button>';
  const presentation=x.websiteUrl?'<a href="'+esc(x.websiteUrl)+'" target="_blank" rel="noopener noreferrer" class="btn">View Approved Website ↗</a>':'<span style="font-size:12px;color:#6e7581">Private, pending approval or not yet built</span>';
  const opts=Object.entries(statuses).map(([key,label])=>'<option value="'+esc(key)+'">'+esc(label)+'</option>').join('');
  const outcomes=ready||x.stage==='APPOINTMENT_BOOKED'||x.stage==='INTERESTED'
   ?'<section style="border:1px solid #d7e5df;padding:18px;border-radius:12px;margin-top:18px;background:#f6fbf7"><strong>Record human call outcome</strong>'+
    '<p style="font-size:12px">Choose only what actually happened. Recording an outcome does not place a call or send a message.</p>'+
    '<label>Call result <select id="sbcWebcallOutcome" style="display:block;width:100%;padding:10px;margin:9px 0">'+opts+'</select></label>'+
    '<button type="button" id="sbcWebcallSaveOutcome" class="btn primary">Save Outcome</button></section>'
   :'<p style="background:#fff6e9;border-radius:9px;padding:13px;font-size:12px">This lead is not ready for a new sales call. '+esc(x.nextAction)+'</p>';
  const coach=Object.entries(x.coach||{}).map(([k,text])=>'<details style="border-bottom:1px solid #d5dcdf;padding:11px"><summary style="font-weight:700;cursor:pointer">'+esc({
   busy:"I'm busy",website:'I already have a site',price:'How much?',send:'Send me the link',notInterested:'Not interested'}[k]||k)+'</summary><p style="white-space:pre-wrap;font-size:13px;line-height:1.65">'+esc(text)+'</p></details>').join('');
  return '<div><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">'+
   '<div><p style="text-transform:uppercase;font-size:11px;font-weight:800;color:#17725e;margin:0">SBC / LIVE SALES WORKFLOW</p><h3 style="font-size:25px;margin:6px 0">'+esc(x.businessName)+'</h3>'+
   '<p style="color:#586679;font-size:13px;margin:0">'+esc(x.industry||'Industry not verified')+' · '+esc(labels[x.stage]||x.stage)+'</p></div>'+
   '<div>'+site+' '+presentation+'</div></div>'+
   '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:17px 0">'+
    '<div style="padding:13px;background:#f6f8fb;border-radius:10px"><strong>Research</strong><p style="font-size:12px">'+(x.verifiedResearch?'Lorna verified CRM record':'Further research required')+'</p>'+
    '<p style="font-size:12px">Google profile: '+(x.googleBusinessVerified?'verified':'not confirmed')+'</p><p style="font-size:12px">Website: '+esc(x.websitePresence.replace('_',' '))+'</p></div>'+
    '<div style="padding:13px;background:#f6f8fb;border-radius:10px"><strong>Manual call</strong><p style="font-size:12px">'+phone+'</p><p style="font-size:11px;color:#64748b">The salesperson initiates any permitted call manually.</p></div>'+
    '<div style="padding:13px;background:#f6f8fb;border-radius:10px"><strong>Next action</strong><p style="font-size:12px">'+esc(x.nextAction)+'</p><p style="font-size:11px">'+(x.appointmentAt?'Booked: '+esc(fmt(x.appointmentAt)):(x.cooldownUntil?'Hold until: '+esc(fmt(x.cooldownUntil)):'No appointment on this record'))+'</p></div>'+
   '</div>'+
   '<h4 style="margin:20px 0 8px">Truthful, personalized sales opening</h4>'+script+
   '<button type="button" class="btn" id="sbcWebcallCopyScript">Copy Calling Script</button>'+
   '<h4 style="margin:22px 0 5px">AI call coach · objection playbook</h4><p style="font-size:12px;color:#64748b">Uses existing SBC knowledge without paid AI calls or voice generation.</p>'+coach+
   outcomes+'<p style="font-size:12px;color:#586679;line-height:1.6;margin:20px 0 5px"><strong>AI voice outbound:</strong> disabled. Separate written consent, do-not-call screening, disclosure requirements and legal review are mandatory before considering any autonomous AI calling.</p></div>';
 }
 function panel(){
  return '<div style="max-width:1240px"><div style="display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap">'+
   '<div><p style="font-size:11px;letter-spacing:.12em;font-weight:850;color:#15836e;margin:0">SUCCESSFUL BY CHOICE · VERIFIED LEAD → ACTUAL WEBSITE → SALE</p>'+
   '<h2 style="font-size:28px;margin:5px 0">SBC Website Call Desk</h2><p style="font-size:13px;color:#52667a">Lorna researches and imports. SBC builds a real website. The assigned human caller books the presentation.</p></div>'+
   '<button type="button" class="btn" id="sbcWebcallRefresh">Refresh</button></div>'+leader()+
   '<div style="display:grid;grid-template-columns:minmax(190px,260px) minmax(0,1fr);gap:16px;align-items:start" id="sbcWebcallLayout">'+
   '<div style="max-height:620px;overflow:auto;padding:4px" aria-label="Assigned website leads">'+leadCards()+'</div>'+
   '<div style="border:1px solid #e2e8f0;border-radius:14px;padding:18px;min-width:0">'+detail()+'</div></div>'+
   '<p id="sbcCallDeskNotice" role="status" style="margin:14px 0;font-size:13px;color:#1b6e58"></p>'+
   '<p style="font-size:11px;color:#748092;margin:0">Lead-level controls are enforced by the server. No contact is initiated when viewing a lead, copying a script, or recording a result.</p></div>';
 }
 async function copyText(str){
  try{await navigator.clipboard.writeText(String(str||''));notice('Copied for human use. No message or call sent.')}
  catch{notice('Clipboard permission denied. Select and copy the text manually.',true)}
 }
 function wire(){
  document.getElementById('sbcWebcallRefresh')?.addEventListener('click',open);
  document.querySelectorAll('[data-sbc-webcall-lead]').forEach(el=>el.addEventListener('click',()=>{
   selectedId=el.dataset.sbcWebcallLead;if(typeof openModal==='function'){openModal('SBC Website Call Desk',panel());wire();}
  }));
  document.getElementById('sbcWebcallCopyPhone')?.addEventListener('click',()=>copyText(current()?.phone));
  document.getElementById('sbcWebcallCopyScript')?.addEventListener('click',()=>copyText(current()?.script));
  document.getElementById('sbcWebcallOpenSite')?.addEventListener('click',()=>{
   const id=current()?.customerId;if(id&&window.SBC_WEBSITE_PRODUCTION?.openExisting)window.SBC_WEBSITE_PRODUCTION.openExisting(id);
  });
  document.getElementById('sbcWebcallBuildSite')?.addEventListener('click',()=>{
   const id=current()?.customerId;if(id&&window.SBC_WEBSITE_PRODUCTION?.build)window.SBC_WEBSITE_PRODUCTION.build(id);
  });
  document.getElementById('sbcWebcallSaveOutcome')?.addEventListener('click',saveOutcome);
 }
 async function saveOutcome(){
  const c=current(),kind=document.getElementById('sbcWebcallOutcome')?.value;
  if(!c||!statuses[kind])return notice('Select a recognized call result.',true);
  if(kind==='DO_NOT_CALL'&&!confirm('Mark this prospect Do Not Contact and suppress further SBC calls?'))return;
  if(!confirm('Record "'+statuses[kind]+'" for '+c.businessName+'? This only saves your completed human-call notes.'))return;
  const btn=document.getElementById('sbcWebcallSaveOutcome');if(btn)btn.disabled=true;
  try{
   if(typeof api!=='function')throw Error('CRM API not available');
   const r=await api('/api/website-production/call-desk/'+encodeURIComponent(c.customerId)+'/outcome',
    {method:'POST',body:JSON.stringify({kind})});
   if(!r?.ok)throw Error(r?.code||'Outcome save was not confirmed');
   const previous=c.customerId;await load(previous);
   notice('Call result saved. No outbound call, email, or text was triggered.');
  }catch(e){notice(e.message||'Could not save call result',true);if(btn)btn.disabled=false}
 }
 async function load(preferId=''){
  if(typeof api!=='function')throw Error('Command Center API unavailable');
  const d=await api('/api/website-production/call-desk?limit=200');
  if(!d?.ok||!Array.isArray(d.rows))throw Error(d?.code||'Website Call Desk could not load');
  desk=d;selectedId=d.rows.some(x=>x.customerId===(preferId||selectedId))?(preferId||selectedId):(d.rows[0]?.customerId||'');
  if(typeof openModal==='function'){openModal('SBC Website Call Desk',panel());wire()}
 }
 async function open(){
  if(!allowed()||loading)return;
  loading=true;if(typeof openModal==='function')openModal('SBC Website Call Desk','<p style="padding:22px">Loading verified leads, completed websites, and manual call guidance…</p>');
  try{await load()}catch(e){if(typeof openModal==='function')openModal('SBC Website Call Desk','<p role="alert">'+esc(e.message||'Call desk unavailable')+'</p>')}
  finally{loading=false}
 }
 function install(){
  const anchor=document.getElementById('sbcBuildVersion');if(!anchor)return;
  let button=document.getElementById('sbc-website-call-desk-topbar');
  if(!button){
   button=document.createElement('button');button.id='sbc-website-call-desk-topbar';button.type='button';
   button.textContent='Website Call Desk';button.className='btn';
   button.style.cssText='background:#0f735d;border:1px solid #0a5947;color:#fff;font-weight:800';
   button.addEventListener('click',open);anchor.insertAdjacentElement('afterend',button);
  }
  button.hidden=!allowed();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
 const timer=setInterval(()=>{install();if(++timerCount>=120)clearInterval(timer)},1500);
 let timerCount=0;
 window.SBC_WEBSITE_CALL_DESK=Object.freeze({open});
})();
