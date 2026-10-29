'use strict';
/* SBC owner-only rotating briefings: free browser speech, no AI, no writes, no polling. */
(function(){
 if(window.__sbcFreeVoiceBriefing)return;window.__sbcFreeVoiceBriefing=true;
 const doc=document,app=doc.getElementById('app'),title=doc.getElementById('viewTitle');
 if(!app||!title)return;
 const Speech=window.SpeechSynthesisUtterance,tts=window.speechSynthesis;
 if(!Speech||!tts)return;
 const themes=[
  {title:'Sales and leads',text:"Today's sales focus is simple: start with the people who are ready for a conversation. Review new and verified leads, check the last contact date, and make a useful next step for each opportunity. When a prospect needs a quote, keep the details clear and the follow-up specific. An organized pipeline helps turn consistent conversations into real customers. Remember, dashboards and targets are a guide; only verified payments count as collected revenue."},
  {title:'Customer commitments',text:"Your customers are the heart of this company. Review quotes that need attention, orders already paid, and fulfillment commitments coming due. Check the status of business cards, printing, websites, domains, and other services before promising delivery. A customer should know what happens next and when to expect an update. Keep the work documented in the Command Center so it can be followed through reliably."},
  {title:'Team and training',text:"Today is a good opportunity to strengthen the team. Check the lead research queue, confirm that new prospects have useful contact information, and review training or onboarding progress. Give each team member a clear task and the access their role requires. Protect private owner information and sensitive decisions. Strong processes help your people work independently without making your operation hard to manage."},
  {title:'Growth and visibility',text:"Think about the businesses that would benefit most from Successful By Choice. Barbershops, salons, restaurants, and local stores may need better online visibility, a website, professional business email, printed marketing materials, or reliable ongoing support. Review your best-qualified prospects and tailor the conversation to a real business need. Focus on follow-through, value, and sustainable growth rather than sending more activity into the system."},
  {title:'Owner priorities',text:"Before you add new work, review what is already in motion. Check outstanding leads, customer follow-ups, renewals, orders, and important approvals. Watch for tasks that are waiting on payment confirmation or require your personal authorization. Kevin's protection rules and your recovery safeguards are designed to keep sensitive actions under owner control. Use Kim and the operating tools to help organize decisions, without treating an automated suggestion as a completed transaction."},
  {title:'Daily operating rhythm',text:"Keep today's plan practical. Begin with the highest-priority customer commitments, then work your most promising leads. Review your appointments, production tasks, and open follow-ups. Leave room for one improvement to your process and one action that brings real value to a customer. A good workday is not measured by how many screens you open. It is measured by the work you finish and the relationships you build."}
 ];
 const rotationKey='sbc-free-briefing-topic-v2';
 function nextBriefing(){
   const hour=new Date().getHours();
   const greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
   let previous=-1;
   try{const stored=localStorage.getItem(rotationKey);if(stored!==null&&/^\\d+$/.test(stored))previous=Number(stored)%themes.length;}catch(_){}
   const index=(previous+1)%themes.length;
   try{localStorage.setItem(rotationKey,String(index))}catch(_){}
   const topic=themes[index];
   return {title:topic.title,text:greeting+'. Welcome back to Successful By Choice. '+topic.text+' This is your private owner briefing, not a live database report. No records, calls, payments, or approvals are changed by listening. Stay focused, keep building, and remember: Because Why Not?'};
 }
 const key='sbc-free-briefing-autoplay-v1';
 const optIn=()=>{try{return localStorage.getItem(key)!=='no'}catch(_){return true}}; // Auto is on by default; owner can disable
 const setOpt=v=>{try{localStorage.setItem(key,v?'yes':'no')}catch(_){}};
 let widget=null,playedThisLogin=false,authorized=false,verifying=false,utterance=null,run=0,currentBriefing=null;
 const escapeVoice=(v)=>String(v&&v.name||'').trim();
 const preferred=/\b(jenny|aria|ava|samantha|zira|victoria|karen|moira|fiona|serena|allison|joanna|salli|nicky|tessa|susan|siri|female|grace|catherine|nora)\b|google us english/i;
 function stop(){run++;try{tts.cancel()}catch(_){}utterance=null;}
 function voice(){
  let list=[];try{list=tts.getVoices().filter(v=>/^en(?:[-_]|$)/i.test(v.lang||''))}catch(_){}
  const score=v=>(preferred.test(escapeVoice(v))?100:0)
    +(String(v.lang||'').toLowerCase()==='en-us'?30:12)+(v.localService?4:0);
  list.sort((a,b)=>score(b)-score(a)||String(a.name).localeCompare(String(b.name)));
  return list[0]||null;
 }
 function status(message){const n=doc.getElementById('sbcVoiceBriefStatus');if(n)n.textContent=message}
 function speak(){
  if(!authorized||app.classList.contains('hidden')||!currentBriefing)return;
  stop();
  const u=new Speech(currentBriefing&&currentBriefing.text||''),v=voice(),token=run;
  u.lang=v&&v.lang||'en-US';if(v)u.voice=v;
  u.rate=.92;u.pitch=1.07;u.volume=1; // Match Office Box's consistent friendly SBC narrator
  u.onstart=()=>{if(token===run)status('Speaking your briefing')};
  u.onend=()=>{if(token===run){utterance=null;status('Briefing complete')}};
  u.onerror=()=>{if(token===run){utterance=null;status('Automatic audio may be blocked by your browser. Press Hear my briefing to listen, or read the transcript.')}};
  utterance=u;status('Starting briefing…');
  try{tts.speak(u)}catch(_){status('Voice not available. Read the briefing instead.')}
 }
 function unmount(){stop();if(widget)widget.remove();widget=null;currentBriefing=null;authorized=false;playedThisLogin=false}
 function mount(){
  if(widget||!authorized||app.classList.contains('hidden'))return;
  const header=title.parentElement;if(!header)return;
  widget=doc.createElement('div');widget.id='sbcOwnerVoiceBrief';
  widget.setAttribute('role','group');widget.setAttribute('aria-label','SBC owner voice briefing');
  widget.innerHTML='<button type="button" id="sbcVoiceBriefPlay" class="sbc-vb-action">▶ Hear my briefing</button><button type="button" id="sbcVoiceBriefStop" class="sbc-vb-action">■ Stop</button><label class="sbc-vb-opt"><input id="sbcVoiceBriefAuto" type="checkbox"> Auto on sign-in</label><details class="sbc-vb-transcript"><summary>Read</summary><p></p></details><span id="sbcVoiceBriefStatus" aria-live="polite" class="sbc-vb-status"></span>';
  header.appendChild(widget);
  currentBriefing=nextBriefing();
  widget.querySelector('details p').textContent=currentBriefing.text;
  widget.querySelector('details summary').textContent='Read: '+currentBriefing.title;
  const check=widget.querySelector('#sbcVoiceBriefAuto');
  check.checked=optIn();
  check.addEventListener('change',()=>{setOpt(check.checked);status(check.checked?'Auto briefing enabled on this device when browser audio permits':'Auto briefing disabled')});
  widget.querySelector('#sbcVoiceBriefPlay').addEventListener('click',()=>{playedThisLogin=true;speak()});
  widget.querySelector('#sbcVoiceBriefStop').addEventListener('click',()=>{stop();status('Stopped')});
  if(optIn()&&!playedThisLogin){playedThisLogin=true;speak()} // one rotating message each owner login/reload
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