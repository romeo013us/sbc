(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SBCCallCommand=api;
})(typeof window!=='undefined'?window:{},function(){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const cleanPhone=value=>{
  let s=String(value??'').trim().replace(/[\s().-]/g,'');
  if(/^\d{10}$/.test(s))s='+1'+s;
  else if(/^1\d{10}$/.test(s))s='+'+s;
  return /^\+[1-9]\d{7,14}$/.test(s)?s:'';
 };
 const isSuppressed=a=>Boolean(a?.doNotContact===true||a?.doNotCall===true||a?.salesSuppressed===true||a?.isSuppressed===true||
  /^(?:do not call|do not contact|dnc|opt[ -]?out|unsubscribe|bad number|wrong number|deleted|lost)$/i.test(String(a?.status||'').trim()));
 const validTimeZone=tz=>{
  if(typeof tz!=='string'||tz.length>65)return false;
  try{new Intl.DateTimeFormat('en-US',{timeZone:tz}).format(new Date());return true}catch{return false}
 };
 function localHour(now,timeZone){
  try{return Number(new Intl.DateTimeFormat('en-US',{timeZone,hour:'2-digit',hourCycle:'h23'}).format(now))}
  catch{return -1}
 }
 function callEligibility(account,now=new Date()){
  if(!account||isSuppressed(account))return {allowed:false,reason:'Contact is suppressed. Do not call.'};
  const phone=cleanPhone(account.phone);
  if(!phone)return {allowed:false,reason:'A valid phone number is required.'};
  if(account.phoneVerified!==true||account.dncChecked!==true||account.callingAuthorized!==true)
   return {allowed:false,reason:'Permission not yet verified. Confirm phone, DNC screening, and outreach authorization.'};
  if(!validTimeZone(account.prospectTimeZone))return {allowed:false,reason:'Prospect time zone must be verified.'};
  const hour=localHour(now,account.prospectTimeZone);
  if(hour<9||hour>=20)return {allowed:false,reason:'Outside SBC calling window (9 AM–8 PM prospect local time).'};
  return {allowed:true,phone,reason:'Verified for manual device calling only. Does not use Twilio or create a call log.'};
 }
 function reviewQueue(accounts,now=new Date()){
  if(!Array.isArray(accounts))return [];
  const seen=new Set();
  return accounts.filter(a=>{
   const id=String(a?.id||'');
   if(!id||seen.has(id)||isSuppressed(a)||!cleanPhone(a.phone))return false;
   seen.add(id);return true;
  }).sort((a,b)=>{
   const due=x=>{const s=String(x?.followUp||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?Date.parse(s+'T00:00:00Z'):Infinity};
   const da=due(a),db=due(b);
   if(da!==db)return da-db;
   return String(a.businessName||'').localeCompare(String(b.businessName||''))||String(a.id).localeCompare(String(b.id));
  });
 }
 function nextAccountId(accounts,currentId,now=new Date()){
  const rows=reviewQueue(accounts,now);
  if(rows.length<2)return '';
  const idx=rows.findIndex(x=>String(x.id)===String(currentId));
  return String(rows[(idx+1)%rows.length].id);
 }
 function createSaveCoordinator(){
  let armed='';
  return {
   arm(id){armed=String(id||'')},
   confirm(id){if(!armed||String(id)!==armed)return false;armed='';return true},
   clear(){armed=''},
   isArmed(){return Boolean(armed)}
  };
 }
 const words={
  en:{eyebrow:'SBC / CALL COMMAND',title:'Your next conversation, prepared',lead:'One account. One workflow. No unnecessary tabs.',
   ready:'Manual call preflight passed',review:'Calling preflight required',phone:'CRM phone',status:'Account stage',follow:'Next follow-up',manager:'Account owner',
   opener:'Conversation starter',script:'Hi, is this the person who handles the website or online presence for',scriptEnd:'? I’m calling from Successful By Choice. Would you have a minute for a quick question about your business website?',
   copy:'Copy opener',copyPhone:'Copy CRM phone',outcome:'Go to call outcome',save:'Save outcome & next account',next:'Next account',reviewNote:'These account details are not proof of consent. Use only approved calling tools after verification.',
   device:'Manual device calling requires verified server preflight',queue:'Accounts available for review',nextUp:'Next in queue',none:'No other eligible review account',manual:'A manual call is not automatically tracked. Save the real outcome below.',
   pending:'Save a factual outcome below; no call will be placed by this panel.'},
  es:{eyebrow:'SBC / CENTRO DE LLAMADAS',title:'Su próxima conversación, preparada',lead:'Una cuenta. Un flujo. Sin pestañas innecesarias.',
   ready:'Verificación para llamada manual aprobada',review:'Falta verificar el permiso',phone:'Teléfono en CRM',status:'Estado de cuenta',follow:'Próximo seguimiento',manager:'Responsable',
   opener:'Inicio de conversación',script:'Hola, ¿hablo con la persona que se encarga de la página web o la presencia digital de',scriptEnd:'? Le llamo de Successful By Choice. ¿Tiene un minuto para una pregunta sobre la página web de su negocio?',
   copy:'Copiar guion',copyPhone:'Copiar teléfono del CRM',outcome:'Ir al resultado',save:'Guardar resultado y siguiente cuenta',next:'Siguiente cuenta',reviewNote:'Los datos del CRM no prueban consentimiento. Utilice llamadas autorizadas solo después de la verificación.',
   device:'La llamada requiere autorización del servidor',queue:'Cuentas para revisar',nextUp:'Siguiente cuenta',none:'No hay otra cuenta para revisar',manual:'La llamada manual no se registra automáticamente. Guarde el resultado real abajo.',
   pending:'Guarde el resultado real abajo. Este panel no realiza llamadas.'}
 };
 function render(a,accounts,lang='en',now=new Date()){
  const w=words[lang==='es'?'es':'en'],elig=callEligibility(a,now),queue=reviewQueue(accounts,now),next=nextAccountId(accounts,a?.id,now);
  const nextName=next?queue.find(x=>String(x.id)===next)?.businessName||next:w.none;
  const name=String(a?.businessName||'the business').slice(0,220);
  const opener=w.script+' '+name+w.scriptEnd;
  const phone=cleanPhone(a?.phone);
  return `<div class="sbc-cc-top"><div><p class="sbc-cc-eyebrow">${w.eyebrow}</p><h3>${w.title}</h3><p>${w.lead}</p></div><span class="sbc-cc-badge ${elig.allowed?'sbc-cc-ready':'sbc-cc-review'}">${elig.allowed?w.ready:w.review}</span></div>
   <div class="sbc-cc-grid"><div class="sbc-cc-main"><dl class="sbc-cc-facts"><div><dt>${w.phone}</dt><dd>${esc(a?.phone||'Not provided')}</dd></div><div><dt>${w.status}</dt><dd>${esc(a?.status||'Not verified')}</dd></div><div><dt>${w.follow}</dt><dd>${esc(a?.followUp||'Not scheduled')}</dd></div><div><dt>${w.manager}</dt><dd>${esc(a?.managerId||'Not assigned')}</dd></div></dl>
    <div class="sbc-cc-preflight" role="note"><strong>${esc(elig.reason)}</strong><p>${w.reviewNote}</p></div>
    <h4>${w.opener}</h4><blockquote class="sbc-cc-script">${esc(opener)}</blockquote>
    <div class="sbc-cc-actions"><button type="button" data-sbc-cc="copy-script">${w.copy}</button>
      <button type="button" data-sbc-cc="copy-phone" ${!phone||isSuppressed(a)?'disabled':''}>${w.copyPhone}</button>
      <button type="button" data-sbc-cc="outcome">${w.outcome}</button></div>
    <p class="sbc-cc-small">${elig.allowed?w.manual:w.pending}</p></div>
   <aside class="sbc-cc-side" aria-label="Account workflow"><strong>${w.queue}: ${queue.length}</strong><p>${w.nextUp}</p><p class="sbc-cc-next-name">${esc(nextName)}</p>
    <button type="button" class="sbc-cc-save" data-sbc-cc="save-next" ${next?'':'disabled'}>${w.save}</button>
    <button type="button" data-sbc-cc="next" ${next?'':'disabled'}>${w.next}</button><p class="sbc-cc-small">${w.pending}</p>
   </aside></div><p id="sbcCallCommandStatus" role="status" aria-live="polite" class="sbc-cc-status"></p>`;
 }
 let current=null;
 const coordinator=createSaveCoordinator();
 function mount(){
  const doc=window.document,detail=doc.getElementById('accountDetail');if(!detail)return null;
  let host=doc.getElementById('sbcCallCommandV1');
  if(!host){host=doc.createElement('section');host.id='sbcCallCommandV1';host.className='sbc-call-command';host.setAttribute('aria-label','SBC Call Command');
   detail.insertBefore(host,doc.getElementById('sbcManagerQuickActions')||detail.firstChild);
   host.addEventListener('click',onClick);
  }
  return host;
 }
 function notice(msg){const el=window.document.getElementById('sbcCallCommandStatus');if(el)el.textContent=msg}
 async function clipboard(text,success){
  try{if(!window.isSecureContext||!window.navigator?.clipboard?.writeText)throw Error('Clipboard requires HTTPS');
   await window.navigator.clipboard.writeText(text);notice(success)}
  catch{notice('Clipboard unavailable. Select and copy the text manually. No outbound action occurred.')}
 }
 function next(){
  if(!current)return;
  const nextId=nextAccountId(current.accounts,current.account.id);
  if(!nextId){notice('No other account available in the review queue.');return}
  const form=window.document.getElementById('sbcManagerOutcomeForm');
  if(form&&!form.closest('[hidden]')&&(String(form.elements.note.value||'').trim()||form.elements.outcome.value)){
   notice('Unsaved outcome detected. Save or clear it before switching accounts.');return;
  }
  coordinator.clear();current.onNext(nextId);
 }
 function onClick(e){
  if(!current)return;
  const b=e.target.closest('[data-sbc-cc]');if(!b)return;
  const a=current.account,act=b.dataset.sbcCc;
  if(act==='copy-script'){
   const w=words[current.lang==='es'?'es':'en'];return void clipboard(w.script+' '+String(a.businessName||'the business')+w.scriptEnd,'Conversation starter copied.');
  }
  if(act==='copy-phone'&&!isSuppressed(a)&&cleanPhone(a.phone))return void clipboard(cleanPhone(a.phone),'CRM phone copied. Confirm outreach eligibility before calling.');
  if(act==='outcome'){const field=window.document.querySelector('#sbcManagerOutcomeForm select[name="outcome"]');
   field?.scrollIntoView({behavior:'smooth',block:'center'});field?.focus();return}
  if(act==='next')return void next();
  if(act==='save-next'){
   const form=window.document.getElementById('sbcManagerOutcomeForm');
   if(!form||form.closest('[hidden]'))return void notice('Outcome form is unavailable. Nothing was saved.');
   if(!form.reportValidity())return void notice('Complete the required outcome and notes before saving.');
   const id=String(a.id);
   if(!nextAccountId(current.accounts,id))return void notice('No next account available. Use Save Outcome below.');
   coordinator.arm(id);notice('Saving in authoritative CRM. Next account opens only after confirmed persistence.');
   form.requestSubmit();
  }
 }
 function open({account,accounts,role,lang='en',onNext}={}){
  if(!account||!['owner','account_manager'].includes(role)||typeof onNext!=='function')return clear();
  const id=String(account.id||'');if(!id||!Array.isArray(accounts))return clear();
  coordinator.clear();current={account,accounts,lang,onNext};
  const host=mount();if(host){host.hidden=false;host.innerHTML=render(account,accounts,lang)}
 }
 function saved(id){
  if(!current||String(current.account.id)!==String(id))return;
  if(!coordinator.confirm(id)){notice('Outcome saved in CRM.');return}
  const target=nextAccountId(current.accounts,id);
  if(target){current.onNext(target)}else notice('Outcome saved. No next account is ready for review.');
 }
 function failed(id){if(current&&String(current.account.id)===String(id)){coordinator.clear();notice('Save was not confirmed. Stay on this account and retry; no automatic navigation.')}}
 function clear(){current=null;coordinator.clear();if(typeof window!=='undefined'){const host=window.document.getElementById('sbcCallCommandV1');if(host){host.hidden=true;host.replaceChildren()}}}
 return Object.freeze({cleanPhone,isSuppressed,callEligibility,reviewQueue,nextAccountId,createSaveCoordinator,render,open,saved,failed,clear});
});
