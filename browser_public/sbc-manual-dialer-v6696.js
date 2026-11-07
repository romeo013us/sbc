/* SBC V66.96. No automatic outbound calls, no lead creation. */
(function(root,factory){
'use strict';const lib=factory();
if(typeof module==='object'&&module.exports)module.exports=lib;
else{root.SBCManualDialer=lib;lib.install(root);}
})(typeof window!=='undefined'?window:{},function(){
'use strict';
const roles=new Set(['owner','manager','caller']);
const cleanPhone=v=>{let v0=String(v||'').trim().replace(/[().\s-]/g,'');if(/^\d{10}$/.test(v0))v0='+1'+v0;else if(/^1\d{10}$/.test(v0))v0='+'+v0;return /^\+[1-9]\d{7,14}$/.test(v0)?v0:'';};
const suppressed=(rows,num)=>Array.isArray(rows)&&rows.some(c=>cleanPhone(c.phone)===num&&(c.doNotContact===true||c.salesSuppressed===true||c.isSuppressed===true||['do not call','do not contact','dnc','opt out','unsubscribe'].includes(String(c.status||'').trim().toLowerCase())));
const payload=(s,status)=>({manualDial:true,customerId:'',sessionId:s.id,to:s.to,status,startedAt:s.startedAt,endedAt:['completed','ended','failed','busy','no-answer','canceled'].includes(status)?new Date().toISOString():'',durationSec:Math.max(0,Math.round((Date.now()-Date.parse(s.startedAt))/1000)),callSid:String(s.conn?.parameters?.CallSid||''),notes:String(s.notes||'').slice(0,12000),outcome:s.outcome,nextAction:String(s.nextAction||'').slice(0,1000),followUpAt:String(s.followUpAt||'').slice(0,40)});
let W=null,call=null,working=false,finishing=false,cancel=false,connected=false,saving=false,timer=null;
const $=id=>W?.document?.getElementById(id);
const owner=()=>{try{return typeof state!=='undefined'&&roles.has(String(state.me?.role||'').toLowerCase())&&Array.isArray(state.data?.customers)}catch{return false}};
const isBusy=()=>working;
function say(msg,error=false){const p=$('sbcManualStatus');if(p){p.textContent=String(msg);p.dataset.error=String(Boolean(error));}const b=$('sbcManualActiveLabel');if(b)b.textContent=String(msg);}
function controls(){
 const number=$('sbcManualNumber');if(number)number.disabled=working;
 const btn=$('sbcManualCall');if(btn)btn.disabled=working||!cleanPhone(number?.value);
 const end=$('sbcManualEnd');if(end)end.disabled=!working;
 const save=$('sbcManualSave');if(save)save.disabled=!call;
 for(const n of W?.document?.querySelectorAll('#sbcManualKeypad button')||[]){n.disabled=working&&!connected;if(n.dataset.digit==='+')n.disabled=working;}
 for(const id of ['sbcManualClear','sbcManualBackspace']){const n=$(id);if(n)n.disabled=working;}
 const b=$('sbcManualActiveBar');if(b)b.hidden=!working;
 const tip=$('sbcManualKeyTip');if(tip)tip.textContent=connected?'Keypad digits now send tones to your live call.':'Enter ten US digits or a + international number.';
}
function fields(){
 if(!call)return;
 for(const [id,key] of [['sbcManualNotes','notes'],['sbcManualOutcome','outcome'],['sbcManualNext','nextAction'],['sbcManualFollow','followUpAt']]){
  const n=$(id);if(n)call[key]=n.value;
 }
}
async function log(status,manual=false){
 if(!call)return false;
 fields();
 if(saving)return false;
 saving=true;
 try{
  const d=await api('/api/voice/log',{method:'POST',body:JSON.stringify(payload(call,status))});
  if(d?.ok!==true||d?.durable!==true)throw Error('MySQL did not confirm the call log.');
  if(manual)say('Call notes saved in SBC.');return true;
 }catch(e){say('Call log unavailable: '+String(e?.message||'not saved'),true);return false}
 finally{saving=false;}
}
async function history(){
 const target=$('sbcManualHistory');if(!target)return;
 target.textContent='Loading…';
 try{
  const d=await api('/api/voice/logs?manual=1');
  if(!Array.isArray(d?.rows))throw Error('Unexpected history response.');
  target.replaceChildren();
  if(!d.rows.length){target.textContent='No manual calls logged yet.';return;}
  d.rows.slice(0,12).forEach(r=>{
   const el=W.document.createElement('div');
   el.textContent=[r.to,r.status,(r.startedAt||'').slice(0,19),r.outcome,r.notes].filter(Boolean).join(' · ');
   target.append(el);
  });
 }catch(e){target.textContent='Manual history unavailable: '+String(e.message||'Try again.');}
}
async function stop(status='ended'){
 cancel=true;
 if(!working&&!call)return;
 if(finishing)return;
 if(working&&!call?.conn&&call?.stage==='preparing'){say('Cancel requested. No outbound call will be placed.');return;}
 finishing=true;clearTimeout(timer);
 const s=call;
 try{s?.conn?.disconnect?.()}catch{}
 connected=false;
 // A failure here is visible; no fabricated "saved" claim.
 const saved=s?await log(status):false;
 call=null;working=false;finishing=false;controls();
 say('Manual call '+status+'. '+(saved?'Call log saved to SBC.':'Call log needs review.'),!saved);
 history().catch(()=>{});
}
async function start(){
 if(working)return;
 const to=cleanPhone($('sbcManualNumber')?.value);
 if(!to){say('Enter a valid phone number before calling.',true);return}
 if(!owner()){say('Caller permissions are unavailable.',true);return}
 if(typeof sbcVoiceStartedAt!=='undefined'&&sbcVoiceStartedAt){say('End the active lead call first.',true);return}
 if(suppressed(state.data.customers,to)){say('Do Not Call: number is suppressed in the CRM. Blocked.',true);return}
 working=true;cancel=false;finishing=false;connected=false;
 call={id:'sbcmanual_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12),to,startedAt:new Date().toISOString(),stage:'preparing',conn:null,notes:$('sbcManualNotes')?.value||'',outcome:$('sbcManualOutcome')?.value||'Pending',nextAction:$('sbcManualNext')?.value||'',followUpAt:$('sbcManualFollow')?.value||''};
 controls();say('Checking Twilio and durable CRM call log…');
 try{
  const st=await sbcVoiceStatus();
  if(!st?.configured||st.webhookSignatureReady!==true)throw Error('Twilio Voice and signed callback must be ready.');
  if(cancel){await stop('canceled');return;}
  const saved=await log('connecting');
  if(!saved)throw Error('Call blocked: the CRM did not confirm a durable call log. No call was placed.');
  call.stage='logged';
  if(cancel){await stop('canceled');return;}
  const device=await ensureSbcVoice();
  if(cancel){await stop('canceled');return;}
  call.stage='dialing';
  const conn=await device.connect({params:{To:to}});
  call.conn=conn;
  if(cancel){await stop('canceled');return;}
  say('Calling '+to+'…');
  if(typeof conn.on==='function'){
   conn.on('accept',()=>{connected=true;controls();say('Live call to '+to+'. Enter notes as you talk.');log('in-progress').catch(()=>{});});
   conn.on('disconnect',()=>{stop('completed').catch(()=>{});});
   conn.on('error',e=>{say('Twilio call error: '+String(e?.message||'provider failure').slice(0,130),true);stop('failed').catch(()=>{});});
  }
 }catch(e){
  const msg=String(e?.message||'Call could not start.');
  if(call?.stage!=='preparing'&&call?.stage!=='logged'&&call?.stage!=='dialing'){}
  if(call?.stage==='preparing'){call=null;working=false;controls();say(msg,true);}
  else{await stop('failed');say(msg,true);}
 }
}
function install(win){
 if(!win?.document||!win.MutationObserver)return;W=win;
 function bar(){
  if($('sbcManualActiveBar'))return;
  const div=win.document.createElement('div');div.id='sbcManualActiveBar';div.hidden=true;
  div.innerHTML='<strong id="sbcManualActiveLabel">Manual call in progress</strong><button type="button" id="sbcManualBack">Dial Pad</button><button type="button" id="sbcManualGlobalEnd">End Call</button>';
  win.document.body.append(div);
  $('sbcManualBack').onclick=()=>{if(typeof state!=='undefined'){state.view='callcenter';render();}mount();};
  $('sbcManualGlobalEnd').onclick=()=>stop();
 }
 function mount(){
  if(!owner())return;
  const target=win.document.querySelector('.sbc-phone-system-card .card-body');
  if(!target||$('sbcManualDialer'))return;
  const wrapper=win.document.createElement('section');wrapper.id='sbcManualDialer';wrapper.setAttribute('aria-label','Manual call dial pad');
  wrapper.innerHTML='<div class="md-columns"><div><h3>☎ Open Dial Pad</h3><p>Enter a number and call directly — no saved lead needed.</p><label for="sbcManualNumber">Phone number</label><input id="sbcManualNumber" type="tel" inputmode="tel" autocomplete="off" maxlength="18" placeholder="(305) 555-0123"><div class="md-keys" id="sbcManualKeypad">'+['1','2','3','4','5','6','7','8','9','*','0','#','+'].map(n=>'<button type="button" data-digit="'+n+'" aria-label="Digit '+n+'">'+n+'</button>').join('')+'</div><div class="md-buttons"><button type="button" class="btn" id="sbcManualBackspace">⌫ Delete</button><button type="button" class="btn" id="sbcManualClear">Clear</button></div><p class="md-note" id="sbcManualKeyTip">US 10 digits or + international number.</p><div class="md-buttons"><button type="button" class="md-call" id="sbcManualCall" disabled>☎ Call from SBC</button><button type="button" class="md-end" id="sbcManualEnd" disabled>■ End Call</button></div><p class="md-note">No automatic dialing. Twilio voice charges and Do Not Call rules apply. Nothing is added to CRM Leads automatically.</p></div><div><h3>Call Notes</h3><div id="sbcManualStatus" role="status" aria-live="polite">Ready for manual number.</div><label for="sbcManualNotes">Conversation notes</label><textarea id="sbcManualNotes" rows="4" maxlength="12000" placeholder="What was discussed? No payment card details."></textarea><div class="md-pair"><div><label for="sbcManualOutcome">Outcome</label><select id="sbcManualOutcome">'+['Pending','Interested','Follow-up requested','Appointment booked','No answer','Left voicemail','Not interested','Do Not Call','Order ready','Bad number'].map(v=>'<option>'+v+'</option>').join('')+'</select></div><div><label for="sbcManualFollow">Follow-up</label><input id="sbcManualFollow" type="datetime-local"></div></div><label for="sbcManualNext">Next action</label><input id="sbcManualNext" maxlength="1000" placeholder="Follow up tomorrow"><div class="md-buttons"><button type="button" class="btn" id="sbcManualSave" disabled>Save Notes</button><button type="button" class="btn" id="sbcManualRefresh">Refresh History</button></div><h3 style="margin-top:16px">Recent Manual Calls</h3><div id="sbcManualHistory">Loading…</div><p class="md-note">Manual calls are stored in your SBC call log, without creating a fake customer record.</p></div></div>';
  target.prepend(wrapper);
  const number=$('sbcManualNumber');if(call)number.value=call.to;
  number.addEventListener('input',controls);
  wrapper.querySelectorAll('#sbcManualKeypad [data-digit]').forEach(button=>button.onclick=()=>{
   const n=button.dataset.digit;
   if(connected&&n!=='+'){try{call.conn.sendDigits(n);say('Key tone sent.')}catch(e){say('Tone unavailable: '+String(e.message),true)}return;}
   if(working)return;
   if(n==='+'&&number.value)return;
   if(number.value.length>=18)return;
   number.value+=n;controls();number.focus();
  });
  $('sbcManualBackspace').onclick=()=>{number.value=number.value.slice(0,-1);controls();number.focus();};
  $('sbcManualClear').onclick=()=>{number.value='';controls();number.focus();};
  $('sbcManualCall').onclick=start;
  $('sbcManualEnd').onclick=()=>stop();
  $('sbcManualSave').onclick=()=>{if(call)log(connected?'in-progress':'connecting',true).catch(()=>{});};
  $('sbcManualRefresh').onclick=history;
  for(const id of ['sbcManualNotes','sbcManualOutcome','sbcManualFollow','sbcManualNext']){
   const e=$(id);
   e.addEventListener('input',()=>{fields();clearTimeout(timer);if(call&&!finishing)timer=setTimeout(()=>log(connected?'in-progress':'connecting').catch(()=>{}),1000);});
  }
  controls();history();
 }
 const ready=()=>{bar();mount();};
 if(win.document.readyState==='loading')win.document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
 new win.MutationObserver(mount).observe(win.document.documentElement,{childList:true,subtree:true});
}
return {cleanPhone,suppressed,payload,isBusy,install};
});
