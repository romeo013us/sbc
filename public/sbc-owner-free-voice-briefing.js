'use strict';
/* SBC owner-only briefing: opt-in, local browser speech, no AI, no writes, no polling. */
(function(){
 if(window.__sbcFreeVoiceBriefing)return;window.__sbcFreeVoiceBriefing=true;
 const doc=document,app=doc.getElementById('app'),title=doc.getElementById('viewTitle');
 if(!app||!title)return;
 const Speech=window.SpeechSynthesisUtterance,tts=window.speechSynthesis;
 if(!Speech||!tts)return;
 const words="Welcome back to Successful By Choice. Your Command Center is your private home base for leads, customer relationships, quotes, sales, production, and follow-ups. Start with your leads and today's priorities. Review open orders and customer commitments before taking action. Use the training and team tools to keep everyone working from the same process, and remember that high-value approvals and protected financial decisions stay under your control. Kim and your automation tools are here to support the work, but this briefing does not start jobs, change records, or make sales calls. Your next step is simple: choose a priority, take action, and keep building. Because Why Not?";
 const key='sbc-free-briefing-autoplay-v1';
 const optIn=()=>{try{return localStorage.getItem(key)==='yes'}catch(_){return false}};
 const setOpt=v=>{try{localStorage.setItem(key,v?'yes':'no')}catch(_){}};
 let widget=null,playedThisLogin=false,authorized=false,verifying=false,utterance=null,run=0;
 const escapeVoice=(v)=>String(v&&v.name||'').trim();
 const preferred=/\b(jenny|aria|ava|samantha|zira|victoria|karen|moira|fiona|serena|allison|joanna|salli|nicky|tessa|susan|female|grace)\b/i;
 function stop(){run++;try{tts.cancel()}catch(_){}utterance=null;}
 function voice(){
  let list=[];try{list=tts.getVoices().filter(v=>/^en(?:[-_]|$)/i.test(v.lang||''))}catch(_){}
  return list.find(v=>preferred.test(escapeVoice(v)))||list.find(v=>String(v.lang).toLowerCase()==='en-us')||list[0]||null;
 }
 function status(message){const n=doc.getElementById('sbcVoiceBriefStatus');if(n)n.textContent=message}
 function speak(){
  if(!authorized||app.classList.contains('hidden'))return;
  stop();
  const u=new Speech(words),v=voice(),token=run;
  u.lang=v&&v.lang||'en-US';if(v)u.voice=v;
  u.rate=.93;u.pitch=1.06;u.volume=1;
  u.onstart=()=>{if(token===run)status('Speaking your briefing')};
  u.onend=()=>{if(token===run){utterance=null;status('Briefing complete')}};
  u.onerror=()=>{if(token===run){utterance=null;status('Voice not available on this device. You can read the briefing.')}};
  utterance=u;status('Starting briefing…');
  try{tts.speak(u)}catch(_){status('Voice not available. Read the briefing instead.')}
 }
 function unmount(){stop();if(widget)widget.remove();widget=null;authorized=false;playedThisLogin=false}
 function mount(){
  if(widget||!authorized||app.classList.contains('hidden'))return;
  const header=title.parentElement;if(!header)return;
  widget=doc.createElement('div');widget.id='sbcOwnerVoiceBrief';
  widget.setAttribute('role','group');widget.setAttribute('aria-label','SBC owner voice briefing');
  widget.innerHTML='<button type="button" id="sbcVoiceBriefPlay" class="sbc-vb-action">▶ Hear my briefing</button><button type="button" id="sbcVoiceBriefStop" class="sbc-vb-action">■ Stop</button><label class="sbc-vb-opt"><input id="sbcVoiceBriefAuto" type="checkbox"> Auto on sign-in</label><details class="sbc-vb-transcript"><summary>Read</summary><p></p></details><span id="sbcVoiceBriefStatus" aria-live="polite" class="sbc-vb-status"></span>';
  header.appendChild(widget);
  widget.querySelector('details p').textContent=words;
  const check=widget.querySelector('#sbcVoiceBriefAuto');
  check.checked=optIn();
  check.addEventListener('change',()=>{setOpt(check.checked);status(check.checked?'Auto briefing enabled on this device when browser audio permits':'Auto briefing disabled')});
  widget.querySelector('#sbcVoiceBriefPlay').addEventListener('click',()=>{playedThisLogin=true;speak()});
  widget.querySelector('#sbcVoiceBriefStop').addEventListener('click',()=>{stop();status('Stopped')});
  if(optIn()&&!playedThisLogin){playedThisLogin=true;speak()}
 }
 async function verifyOwner(){
  if(verifying||authorized||app.classList.contains('hidden'))return;
  verifying=true;
  try{
   const result=await fetch('/api/me',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
   if(!result.ok)return;
   const data=await result.json();
   if(data&&data.authenticated===true&&data.user&&data.user.role==='owner'&&!app.classList.contains('hidden')){authorized=true;mount()}
  }catch(_){}finally{verifying=false}
 }
 const css=doc.createElement('style');css.id='sbcOwnerVoiceStyles';
 css.textContent='#sbcOwnerVoiceBrief{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:7px;font:12px/1.35 system-ui,sans-serif;max-width:100%;color:inherit}#sbcOwnerVoiceBrief .sbc-vb-action{background:#144979;color:#fff;border:1px solid #4281b3;border-radius:8px;padding:7px 9px;cursor:pointer;font:600 12px system-ui}#sbcOwnerVoiceBrief .sbc-vb-opt{display:inline-flex;align-items:center;gap:5px;font-size:12px;cursor:pointer}#sbcOwnerVoiceBrief .sbc-vb-opt input{accent-color:#eb7c34}#sbcOwnerVoiceBrief .sbc-vb-transcript{max-width:100%;font-size:12px}#sbcOwnerVoiceBrief .sbc-vb-transcript summary{cursor:pointer;text-decoration:underline}#sbcOwnerVoiceBrief .sbc-vb-transcript p{max-width:55ch;line-height:1.5;white-space:normal;margin:5px 0}#sbcOwnerVoiceBrief .sbc-vb-status{font-size:11px;opacity:.75}#sbcOwnerVoiceBrief button:focus-visible,#sbcOwnerVoiceBrief summary:focus-visible{outline:2px solid #f99542;outline-offset:3px}@media(max-width:650px){#sbcOwnerVoiceBrief{gap:5px}#sbcOwnerVoiceBrief .sbc-vb-action{padding:8px}}';
 doc.head.appendChild(css);
 function sync(){if(app.classList.contains('hidden')){if(widget||authorized)unmount()}else if(!authorized)verifyOwner();else mount()}
 if(window.MutationObserver)new MutationObserver(sync).observe(app,{attributes:true,attributeFilter:['class']});
 doc.getElementById('logoutBtn')?.addEventListener('click',unmount);
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden&&utterance){stop();status('Paused when you left the page')}});
 window.addEventListener('pagehide',stop);
 sync();
})();