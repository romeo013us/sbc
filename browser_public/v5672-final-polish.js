/* SBC V56.7.3 — Kim control nexus / DOM remount guard. */
(function(){'use strict';
  const BUTTON_ID='sbcKimTopButton'; // RETIRED: top Kim OS control removed in V58.3.1
  let bodyObserver=null, topObserver=null, observedTop=null;
  function launchKim(prefill){
    try{
      if(typeof window.sbcFlowOpenKim==='function'){ window.sbcFlowOpenKim(prefill); return true; }
      if(typeof window.openSbcAI==='function'){ return window.openSbcAI(prefill)!==false; }
      window.dispatchEvent(new CustomEvent('sbc:kim:open',{detail:{prefill:prefill||''}}));
      return true;
    }catch(e){ console.warn('[SBC KIM] launch failed',e); return false; }
  }
  function bindButton(b){
    if(!b||b.dataset.kimBound==='1')return;
    b.dataset.kimBound='1';
    b.setAttribute('aria-controls','sbcAiDock');
    b.setAttribute('aria-haspopup','dialog');
    const activate=e=>{e.preventDefault();e.stopPropagation();launchKim();};
    b.addEventListener('click',activate,{capture:true});
    b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){activate(e);}}, {capture:true});
  }
  function ensureKimButton(){
    // V58.3.1: the legacy top Kim OS button is permanently removed.
    // Legacy callers are retained as a safe no-op so older scripts cannot remount it.
    document.getElementById(BUTTON_ID)?.remove();
    return null;
  }

  function ensureKimDock(){
    let d=document.getElementById('sbcAiDock');
    if(d && d.querySelector('.sbc-kim-topbar') && d.querySelector('#sbcAiInput')) return d;
    if(!d){ d=document.createElement('div'); d.id='sbcAiDock'; }
    d.className='sbc-kim-dock hidden';
    d.setAttribute('aria-label','Kim Executive Partner');
    d.setAttribute('aria-hidden','true');
    d.innerHTML=`<div class="sbc-kim-topbar"><div class="sbc-kim-brand"><div class="sbc-kim-avatar"><img src="/assets/kim-avatar.png" alt="Kim"></div><div class="sbc-kim-title"><strong>Kim</strong><span>Executive Partner · SBC Operations</span></div><span id="sbcAiStatus" class="sbc-kim-live">● CONNECTING</span><span id="sbcAiContextState" class="sbc-kim-context">○ CONTEXT OFFLINE</span></div><button class="sbc-kim-close" id="sbcKimClose" type="button" aria-label="Close Kim">×</button></div><div class="sbc-kim-hero"><div><div class="sbc-kim-eyebrow">YOUR COMMAND CENTER</div><div class="sbc-kim-headline">What are we solving?</div><div class="sbc-kim-sub">Ask Kim, get a plan, or jump straight into an action.</div></div><div class="sbc-kim-spark">✦</div></div><div id="sbcAiMessages" class="sbc-kim-messages" aria-live="polite"></div><div class="sbc-kim-tools"><button id="sbcAiExplain" class="sbc-kim-tool" type="button">✨ Explain page</button><button id="sbcAiListen" class="sbc-kim-tool" type="button">🔊 Read Aloud</button><button id="sbcAiStop" class="sbc-kim-tool" type="button">🔇 Stop</button><label class="sbc-kim-voice-select"><span>Kim voice</span><select id="sbcKimVoice" aria-label="Kim voice"><option value="coral">Coral</option><option value="shimmer">Shimmer</option><option value="nova">Nova</option><option value="sage">Sage</option><option value="alloy">Alloy</option><option value="ash">Ash</option><option value="ballad">Ballad</option><option value="echo">Echo</option><option value="fable">Fable</option><option value="onyx">Onyx</option><option value="verse">Verse</option></select></label><span id="sbcAiVoiceStatus" class="sbc-kim-voice">Kim voice: coral</span></div><div class="sbc-kim-quick"><button type="button" data-kim-prompt="Give me a quick executive read of what matters right now.">Executive read</button><button type="button" data-kim-prompt="Review this page and tell me the next three useful actions.">Next 3 moves</button><button type="button" data-kim-prompt="Help me troubleshoot the thing that is currently not working.">Troubleshoot</button></div><div class="sbc-kim-composer"><textarea id="sbcAiInput" rows="2" placeholder="Message Kim…" aria-label="Message Kim"></textarea><button id="sbcAiSend" type="button" aria-label="Send message">➤</button></div><div class="sbc-kim-hint">Enter to send · Shift+Enter for a new line</div><div class="sbc-kim-resize-grip" aria-label="Resize Kim"></div>`;
    if(!d.isConnected) document.body.appendChild(d);
    window.initKimDockV50?.();
    window.initSbcInteractionFinal?.();
    return d;
  }
  function boot(){
    ensureKimButton();
    ensureKimDock();
    if(!bodyObserver){
      bodyObserver=new MutationObserver(()=>{
        const current=document.querySelector('.top-actions');
        if(current){
          ensureKimButton();
          observeTop(current);
        }
      });
      bodyObserver.observe(document.body,{childList:true,subtree:true});
    }
    [0,250,750,1500,3000].forEach(ms=>setTimeout(()=>{ensureKimDock();},ms));
  }
  window.sbcEnsureKimControl=ensureKimButton;
  window.sbcOpenKimControl=launchKim;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
