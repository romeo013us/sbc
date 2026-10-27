/* SBC V56.25.3 — Kim Google-style chat controller.
 * Single UI owner for the visible Kim dock. Backend/API behavior is unchanged.
 */
(function(){
  'use strict';
  const KEY='sbc.kim.google-chat.v56.25.3';
  const MIN_W=360, MIN_H=480;
  const qs=s=>document.querySelector(s);
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  let drag=null, resize=null, wired=false;

  function dock(){return document.getElementById('sbcAiDock')}
  function save(d){try{const r=d.getBoundingClientRect();localStorage.setItem(KEY,JSON.stringify({left:Math.round(r.left),top:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height)}));}catch{}}
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
  function ensureMarkup(){
    let d=dock();
    if(!d){d=document.createElement('div');d.id='sbcAiDock';document.body.appendChild(d)}
    if(d.dataset.kimGoogleMarkup==='1')return d;
    d.dataset.kimGoogleMarkup='1';
    d.className='sbc-kim-dock sbc-kim-google hidden';
    d.setAttribute('aria-label','Kim AI Chief of Staff');
    d.setAttribute('aria-hidden','true');
    d.innerHTML=`
      <header class="gk-header" id="gkKimDrag">
        <div class="gk-brand">
          <div class="gk-avatar"><img src="/assets/kim-avatar.png" alt="Kim"></div>
          <div class="gk-title"><strong>Kim</strong><span>AI Chief of Staff · SBC Operations</span><span class="gk-status" id="sbcAiStatus">● READY</span></div>
        </div>
        <div class="gk-actions"><button class="gk-icon" id="gkMinimize" type="button" title="Minimize Kim" aria-label="Minimize Kim">−</button><button class="gk-icon" id="sbcKimClose" type="button" title="Close Kim" aria-label="Close Kim">×</button></div>
      </header>
      <div class="gk-body">
        <section class="gk-welcome"><h2>How can I help?</h2><p>Ask Kim about the Command Center, sales, leads, customers, operations, or a problem you need diagnosed.</p><div class="gk-context"><i class="gk-dot"></i><span id="sbcAiContextState">Live Command Center context</span><span>·</span><span id="gkKimPage">Dashboard</span></div></section>
        <section id="sbcAiMessages" class="sbc-kim-messages" aria-live="polite"></section>
        <div class="gk-suggestions"><button class="gk-suggestion" data-kim-prompt="Give me a quick executive read of what matters right now.">Executive read</button><button class="gk-suggestion" data-kim-prompt="Review the current Command Center and give me the next three useful actions.">Next 3 moves</button><button class="gk-suggestion" data-kim-prompt="Troubleshoot the thing currently not working and tell me exactly what to do.">Troubleshoot</button></div>
        <div class="gk-composer-wrap"><div class="gk-composer"><textarea id="sbcAiInput" rows="1" placeholder="Message Kim…" aria-label="Message Kim"></textarea><button class="gk-send" id="sbcAiSend" type="button" aria-label="Send message">➤</button></div><div class="gk-hint">Enter to send · Shift+Enter for a new line</div></div>
      </div>
      <div class="gk-resize" id="gkKimResize" aria-label="Resize Kim" title="Resize Kim"></div>`;
    return d;
  }
  function restore(d){
    const s=read();
    const mobile=innerWidth<=650;
    if(mobile){d.style.left='6px';d.style.top='6px';d.style.width=Math.max(300,innerWidth-12)+'px';d.style.height=Math.max(480,innerHeight-12)+'px';return;}
    const w=clamp(Number(s.width)||520,MIN_W,Math.max(MIN_W,innerWidth-24));
    const h=clamp(Number(s.height)||700,MIN_H,Math.max(MIN_H,innerHeight-24));
    d.style.width=w+'px';d.style.height=h+'px';d.style.right='auto';d.style.bottom='auto';
    const left=Number.isFinite(Number(s.left))?Number(s.left):innerWidth-w-24;
    const top=Number.isFinite(Number(s.top))?Number(s.top):innerHeight-h-24;
    place(d,left,top);
  }
  function place(d,left,top){
    const r=d.getBoundingClientRect();
    d.style.right='auto';d.style.bottom='auto';d.style.left=clamp(left,6,Math.max(6,innerWidth-r.width-6))+'px';d.style.top=clamp(top,6,Math.max(6,innerHeight-r.height-6))+'px';
  }
  function send(){const i=qs('#sbcAiInput');const t=String(i?.value||'').trim();if(!t)return;i.value='';if(typeof window.askSbcAI==='function')window.askSbcAI(t);}
  function bind(d){
    if(wired)return;wired=true;
    const h=qs('#gkKimDrag'),g=qs('#gkKimResize'),close=qs('#sbcKimClose'),min=qs('#gkMinimize'),input=qs('#sbcAiInput'),sendBtn=qs('#sbcAiSend');
    restore(d);
    h?.addEventListener('pointerdown',e=>{
      if(e.button!==0||e.target.closest('button'))return;
      const r=d.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};
      try{h.setPointerCapture(e.pointerId)}catch{} e.preventDefault();e.stopPropagation();
    },{passive:false});
    g?.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      const r=d.getBoundingClientRect();resize={id:e.pointerId,x:e.clientX,y:e.clientY,w:r.width,h:r.height};
      try{g.setPointerCapture(e.pointerId)}catch{} e.preventDefault();e.stopPropagation();
    },{passive:false});
    addEventListener('pointermove',e=>{
      if(drag&&e.pointerId===drag.id){place(d,drag.left+e.clientX-drag.x,drag.top+e.clientY-drag.y);e.preventDefault();}
      if(resize&&e.pointerId===resize.id){
        const w=clamp(resize.w+e.clientX-resize.x,MIN_W,Math.max(MIN_W,innerWidth-12));
        const hgt=clamp(resize.h+e.clientY-resize.y,MIN_H,Math.max(MIN_H,innerHeight-12));
        d.style.width=w+'px';d.style.height=hgt+'px';place(d,d.getBoundingClientRect().left,d.getBoundingClientRect().top);e.preventDefault();
      }
    },{capture:true,passive:false});
    addEventListener('pointerup',e=>{if(drag&&e.pointerId===drag.id){drag=null;save(d)}if(resize&&e.pointerId===resize.id){resize=null;save(d)}},{capture:true});
    addEventListener('pointercancel',e=>{if(drag&&e.pointerId===drag.id){drag=null;save(d)}if(resize&&e.pointerId===resize.id){resize=null;save(d)}},{capture:true});
    close?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();window.closeSbcAI?.();},{capture:true});
    min?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();d.classList.toggle('gk-minimized');},{capture:true});
    sendBtn?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();send();},{capture:true});
    input?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.stopPropagation();send();}},{capture:true});
    input?.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,120)+'px';});
    input?.addEventListener('pointerdown',e=>e.stopPropagation(),{capture:true});
    document.querySelectorAll('#sbcAiDock .gk-suggestion').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const p=b.dataset.kimPrompt||'';if(p)window.askSbcAI?.(p);},{capture:true}));
    addEventListener('resize',()=>{if(!d.classList.contains('hidden')){if(innerWidth<=650){d.style.left='6px';d.style.top='6px';d.style.width=Math.max(300,innerWidth-12)+'px';d.style.height=Math.max(480,innerHeight-12)+'px';}else{const r=d.getBoundingClientRect();place(d,r.left,r.top);save(d);}}},{passive:true});
  }
  function syncLauncher(){const b=document.getElementById('sbcKimBottomButton');if(!b)return;const d=dock();b.classList.toggle('gk-hidden',!!d&&!d.classList.contains('hidden')&&!d.hidden);}
  function open(prefill){
    if(typeof navigator!=='undefined'&&navigator.userActivation&&!navigator.userActivation.isActive){console.info('[KIM] automatic UI launch blocked');return false;}
    const d=ensureMarkup();bind(d);restoreIfNeeded(d);d.classList.remove('hidden','gk-minimized');d.hidden=false;d.style.display='flex';d.setAttribute('aria-hidden','false');syncLauncher();
    const status=qs('#sbcAiStatus');if(status)status.textContent='● READY';
    if(prefill){const i=qs('#sbcAiInput');if(i){i.value=String(prefill);i.focus();}}
    else setTimeout(()=>qs('#sbcAiInput')?.focus(),50);
  }
  function restoreIfNeeded(d){if(!d.dataset.kimGoogleRestored){d.dataset.kimGoogleRestored='1';restore(d)}}
  function close(){const d=dock();if(!d)return;d.classList.add('hidden');d.hidden=true;d.style.display='none';d.setAttribute('aria-hidden','true');syncLauncher()}
  function boot(){
    const d=ensureMarkup();bind(d);restoreIfNeeded(d);
    const oldOpen=window.openSbcAI,oldClose=window.closeSbcAI;
    window.openSbcAIOld=oldOpen;
    window.openSbcAI=function(prefill){open(prefill);try{window.initKimVoicePicker?.();window.loadSbcKimLiveContext?.();}catch{}return true};
    window.closeSbcAI=function(){close()};
    document.getElementById('sbcKimTopButton')?.remove();
    const bottom=document.getElementById('sbcKimBottomButton');bottom?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();open();},{capture:true});
    syncLauncher();
    new MutationObserver(()=>{syncLauncher();}).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
