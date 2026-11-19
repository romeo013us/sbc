/* SBC Call Command V3 — human-initiated browser phone, no autonomous dialing.
 * Client-side UI is not a compliance authority. The server authenticates,
 * authorizes, locks and binds every outbound Twilio attempt.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SBCCallCommandLiveV3=api;
})(typeof window!=='undefined'?window:{},function(){
 'use strict';
 let W=null,host=null,current=null,call=null,device=null,busy=false,connecting=false,muted=false,
  timer=null,startedAt=0,requestId='',readiness=null;
 const $=id=>W?.document?.getElementById(id);
 const escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function note(s,error=false){const n=$('sbcCcV3Status');if(n){n.textContent=String(s);n.dataset.error=String(Boolean(error));}}
 function clearTimer(){if(timer){clearInterval(timer);timer=null;}}
 function controls(){
  const allowed=readiness?.liveCallAvailable===true;
  for(const [id,disabled] of [['sbcCcV3Call',busy||!allowed],['sbcCcV3End',!busy],
   ['sbcCcV3Mute',!call],['sbcCcV3History',busy]]){
   const el=$(id);if(el)el.disabled=disabled;
  }
  const active=$('sbcCcV3Active');if(active)active.hidden=!busy;
  const mute=$('sbcCcV3Mute');if(mute)mute.textContent=muted?'Unmute microphone':'Mute microphone';
  const keypad=$('sbcCcV3Digits');if(keypad)keypad.hidden=!call;
  const clock=$('sbcCcV3Timer');if(clock){clock.textContent='00:00'}
 }
 function statusText(payload){
  if(!payload?.ok)return 'Calling readiness could not be verified.';
  if(payload.liveCallAvailable)return 'Ready for an approved manual call. Press Call Now when you are ready.';
  const reasons=(payload.reasons||[]).join(' · ');
  return 'Calling is unavailable: '+(reasons||'owner verification or provider setup required')+'.';
 }
 function render({account,role,lang}){
  const es=lang==='es';
  return '<section class="sbc-cc-v3" aria-label="SBC verified live calling">'+
   '<div class="sbc-cc-v3-head"><div><p class="sbc-cc-v3-kicker">SBC CALL COMMAND / TWILIO</p>'+
   '<h4>'+(es?'Llamar desde la cuenta':'Live account calling')+'</h4>'+
   '<p>'+(es?'Verificación del servidor antes de cada llamada.':'One deliberate click. Server-verified permission before every call.')+'</p></div>'+
   '<span class="sbc-cc-v3-pill" id="sbcCcV3Pill">CHECKING</span></div>'+
   '<div class="sbc-cc-v3-control"><button type="button" id="sbcCcV3Call" disabled class="sbc-cc-v3-start">'+(es?'Llamar ahora':'Call Now')+'</button>'+
   '<button type="button" id="sbcCcV3Mute" disabled>Mute microphone</button>'+
   '<button type="button" id="sbcCcV3End" disabled class="sbc-cc-v3-end">'+(es?'Finalizar llamada':'End Call')+'</button>'+
   '<span id="sbcCcV3Timer" aria-live="off">00:00</span></div>'+
   '<div id="sbcCcV3Digits" hidden><p>During-call keypad</p><div class="sbc-cc-v3-keys">'+
    ['1','2','3','4','5','6','7','8','9','*','0','#'].map(n=>'<button type="button" data-sbc-v3-digit="'+n+'" aria-label="Send '+n+' tone">'+n+'</button>').join('')+
   '</div></div>'+
   '<p id="sbcCcV3Status" role="status" aria-live="polite">Checking the authenticated CRM record…</p>'+
   '<p class="sbc-cc-v3-disclaimer">No automated dialing or recording. Twilio charges apply only if a permitted call is placed. Follow applicable calling, DNC and recording rules.</p>'+
   '<div id="sbcCcV3Active" hidden><strong>Live call in progress</strong><p>Finish this call before switching accounts.</p></div>'+
   (role==='owner'?'<details class="sbc-cc-v3-owner"><summary>Owner: verify or revoke calling permission</summary>'+
    '<p>Only record verification after independently checking the phone, applicable Do Not Call rules and lawful outreach basis. This is a seven-day, phone-specific owner attestation—not automated legal verification.</p>'+
    '<form id="sbcCcV3OwnerForm"><label>Prospect time zone<input name="prospectTimeZone" value="America/New_York" required></label>'+
    '<label>Verification evidence and source<textarea name="evidence" minlength="24" maxlength="1200" required placeholder="Document when and where DNC screening, phone verification and lawful basis were checked."></textarea></label>'+
    '<label class="sbc-cc-v3-checkbox"><input type="checkbox" name="phoneVerified" required> I verified this phone number.</label>'+
    '<label class="sbc-cc-v3-checkbox"><input type="checkbox" name="dncChecked" required> I checked the applicable Do Not Call restrictions.</label>'+
    '<label class="sbc-cc-v3-checkbox"><input type="checkbox" name="callingAuthorized" required> This contact is authorized for the intended manual call.</label>'+
    '<label class="sbc-cc-v3-checkbox"><input type="checkbox" name="basis" required> The lawful outreach basis is documented.</label>'+
    '<label class="sbc-cc-v3-checkbox"><input type="checkbox" name="policyReviewed" required> I reviewed applicable calling requirements.</label>'+
    '<div class="sbc-cc-v3-control"><button type="submit" id="sbcCcV3Verify">Save verification</button>'+
    '<button type="button" id="sbcCcV3Revoke" class="sbc-cc-v3-end">Revoke permission</button></div></form></details>':'')+
   '<details class="sbc-cc-v3-history"><summary>Provider-verified call history</summary>'+
    '<button type="button" id="sbcCcV3History">Refresh call history</button><div id="sbcCcV3HistoryRows">No provider history loaded.</div></details>'+
   '</section>';
 }
 async function api(url,init={}){
  const res=await W.fetch(url,{credentials:'same-origin',cache:'no-store',
   headers:{Accept:'application/json',...(init.body?{'Content-Type':'application/json'}:{})},...init});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||data.ok!==true)throw Error(String(data.code||data.error||'SERVER_NOT_CONFIRMED'));
  return data;
 }
 async function refresh(){
  if(!current)return;
  const id=String(current.account.id);
  readiness=null;controls();
  const pill=$('sbcCcV3Pill');if(pill)pill.textContent='CHECKING';
  try{
   const d=await api('/api/v6606/crm/account-portfolios/'+encodeURIComponent(id)+'/call-readiness');
   if(!current||String(current.account.id)!==id)return;
   readiness=d;note(statusText(d),!d.liveCallAvailable);
   if(pill){pill.textContent=d.liveCallAvailable?'READY':'REVIEW REQUIRED';pill.dataset.ready=String(Boolean(d.liveCallAvailable));}
   controls();
  }catch(e){if(current&&String(current.account.id)===id){note('Cannot verify call readiness: '+e.message,true);if(pill)pill.textContent='BLOCKED';controls();}}
 }
 async function history(){
  if(!current)return;
  const id=String(current.account.id),target=$('sbcCcV3HistoryRows');
  if(!target)return;target.textContent='Loading authenticated provider events…';
  try{
   const d=await api('/api/v6606/crm/account-portfolios/'+encodeURIComponent(id)+'/call-history');
   if(!current||String(current.account.id)!==id)return;
   target.replaceChildren();
   if(!d.history?.length){target.textContent='No verified Twilio call attempts for this account yet.';return}
   for(const item of d.history){
    const div=W.document.createElement('div');div.className='sbc-cc-v3-history-row';
    div.textContent=[item.startedAt,item.status,item.providerStatus,item.callSid?'Provider ID: '+item.callSid:'Pending provider confirmation'].filter(Boolean).join(' · ');
    target.appendChild(div);
   }
  }catch(e){if(current&&String(current.account.id)===id)target.textContent='Call history unverified: '+e.message}
 }
 function cleanupCall(){
  clearTimer();try{call?.disconnect?.()}catch{}
  try{device?.destroy?.()}catch{}
  call=null;device=null;busy=false;connecting=false;muted=false;
  controls();
 }
 async function start(){
  if(!current||busy||readiness?.liveCallAvailable!==true)return;
  if(!W.isSecureContext||!W.crypto?.randomUUID||!W.Twilio?.Device){
   return note('Secure HTTPS, browser microphone access and the Twilio Voice SDK are required.',true);
  }
  const id=String(current.account.id);
  busy=true;connecting=true;controls();note('Preparing a one-use, server-authorized call…');
  try{
   if(!requestId)requestId=W.crypto.randomUUID().replace(/-/g,'');
   const d=await api('/api/v6606/crm/account-portfolios/'+encodeURIComponent(id)+'/call-start',
    {method:'POST',body:JSON.stringify({requestId})});
   if(!current||String(current.account.id)!==id)throw Error('ACCOUNT_CHANGED');
   note('Connecting to Twilio. Allow microphone access when prompted.');
   device=new W.Twilio.Device(d.token,{logLevel:'warn'});
   const active=await device.connect({params:{AttemptId:d.attemptId}});
   if(!busy||!current||String(current.account.id)!==id){try{active?.disconnect?.()}catch{}throw Error('CALL_ABORTED')}
   call=active;connecting=false;startedAt=Date.now();muted=false;
   controls();note('Connecting to the requested business…');
   timer=setInterval(()=>{const el=$('sbcCcV3Timer');if(!el)return;
    const s=Math.floor((Date.now()-startedAt)/1000);
    el.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
   },1000);
   call.on?.('accept',()=>note('Connected. You may speak now. Notes and outcomes are saved separately below.'));
   call.on?.('disconnect',()=>{cleanupCall();requestId='';note('Call ended locally. Refresh provider history to confirm the final status.');history().catch(()=>{})});
   call.on?.('error',e=>{cleanupCall();note('Twilio call error: '+String(e?.message||'Unknown error'),true);history().catch(()=>{})});
  }catch(e){cleanupCall();note('Call was not established: '+String(e?.message||e)+'. The server may hold this attempt briefly to prevent duplicate calling.',true);refresh().catch(()=>{})}
 }
 function end(){if(!busy)return;note('Ending the call…');if(call)try{call.disconnect()}catch{}else if(device){try{device.disconnectAll()}catch{}}cleanupCall();requestId='';history().catch(()=>{})}
 function mute(){if(!call)return;muted=!muted;try{call.mute(muted);controls();note(muted?'Microphone muted.':'Microphone active.')}catch{muted=!muted;note('Mute not available.',true)}}
 async function saveVerification(event){
  event.preventDefault();
  if(!current||current.role!=='owner'||busy)return;
  const f=event.currentTarget;
  if(!f.reportValidity())return;
  const id=String(current.account.id),button=$('sbcCcV3Verify');
  button.disabled=true;note('Saving owner verification in MySQL…');
  try{
   await api('/api/v6606/crm/account-portfolios/'+encodeURIComponent(id)+'/call-authorization',
    {method:'POST',body:JSON.stringify({prospectTimeZone:String(f.elements.prospectTimeZone.value),
     evidence:String(f.elements.evidence.value).trim(),phoneVerified:true,dncChecked:true,
     callingAuthorized:true,consentOrLegalBasisVerified:true,policyReviewed:true})});
   f.reset();note('Owner verification saved. Refreshing server-side calling eligibility…');
   await refresh();
  }catch(e){note('Authorization was not saved: '+e.message,true)}
  finally{button.disabled=false}
 }
 async function revoke(){
  if(!current||current.role!=='owner'||busy)return;
  if(!W.confirm('Revoke account calling authorization immediately?'))return;
  const id=String(current.account.id);
  try{await api('/api/v6606/crm/account-portfolios/'+encodeURIComponent(id)+'/call-revoke',
    {method:'POST',body:'{}'});readiness=null;note('Permission revoked and recorded.');await refresh()}
  catch(e){note('Revocation not confirmed: '+e.message,true);readiness=null;controls()}
 }
 function onClick(e){
  const el=e.target.closest('button');if(!el||!host?.contains(el))return;
  if(el.id==='sbcCcV3Call')return void start();
  if(el.id==='sbcCcV3End')return void end();
  if(el.id==='sbcCcV3Mute')return void mute();
  if(el.id==='sbcCcV3History')return void history();
  if(el.id==='sbcCcV3Revoke')return void revoke();
  const digit=el.dataset.sbcV3Digit;
  if(digit&&call){try{call.sendDigits(digit);note('Keypad tone sent.')}catch{note('Keypad tone unavailable.',true)}}
 }
 function open({account,role,lang='en'}={}){
  if(!account||!['owner','account_manager'].includes(role)||typeof window==='undefined')return;
  if(busy&&String(current?.account?.id)!==String(account.id))return;
  W=window;current={account,role,lang};
  const target=$('sbcCallCommandV1');if(!target)return;
  host=$('sbcCallCommandLiveV3');
  if(!host){host=W.document.createElement('div');host.id='sbcCallCommandLiveV3';target.appendChild(host);
   host.addEventListener('click',onClick);
  }
  host.innerHTML=render(current);
  host.querySelector('#sbcCcV3OwnerForm')?.addEventListener('submit',saveVerification);
  controls();refresh().catch(()=>{});
 }
 function close(){if(busy)end();current=null;readiness=null;requestId='';if(host)host.replaceChildren();host=null}
 const isBusy=()=>busy;
 return Object.freeze({open,close,isBusy,render,statusText});
});
