/* SBC V56.13.3 — Ask Kim redesign. Owns the regular Kim experience only. */
(function(){
  'use strict';
  const KEY='sbc.askkim.v56.13.3';
  const $=s=>document.querySelector(s);
  const dock=()=>$('#sbcAiDock');
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  function installMarkup(){
    const d=dock(); if(!d||d.dataset.askKimRedesign==='1')return !!d;
    d.dataset.askKimRedesign='1'; d.classList.add('ask-kim-redesign');
    d.innerHTML=`
      <div class="ak-grid"></div><div class="ak-noise"></div><div class="ak-scan"></div>
      <header class="ak-header" id="akKimDrag">
        <div class="ak-brand">
          <div class="ak-avatar-wrap"><div class="ak-avatar"><img src="/assets/kim-avatar.png" alt="Kim"></div><span class="ak-orbit ak-orbit-a"></span><span class="ak-orbit ak-orbit-b"></span></div>
          <div class="ak-name"><strong>Kim</strong><span>Chief of Staff · Intelligence Core</span><div class="ak-live"><i></i><span id="sbcAiStatus">SYSTEM READY</span></div></div>
        </div>
        <div class="ak-header-meta"><span>CC // LIVE</span><span id="akClock">--:--:--</span><button class="ak-dock" id="akKimDock" type="button" aria-label="Dock Kim">⌗</button><button class="ak-close" id="sbcKimClose" type="button" aria-label="Close Kim">×</button></div>
      </header>
      <section class="ak-command">
        <div class="ak-command-main"><div class="ak-command-kicker">ASK KIM // INCIDENT INTERFACE</div><h2>What happened<span>?</span></h2><p>Drop the situation here. Kim reads the live Command Center context, isolates the signal, explains the cause, and gives you the next move.</p><div class="ak-context"><i></i><span id="sbcAiContextState">LIVE COMMAND CENTER</span><b>›</b><span id="akKimPage">Dashboard</span></div></div>
        <div class="ak-core"><div class="ak-core-ring r1"></div><div class="ak-core-ring r2"></div><div class="ak-core-ring r3"></div><div class="ak-core-dot">✦</div><small>AI</small></div>
      </section>
      <div class="ak-telemetry"><span><b>MODE</b> OPERATIONAL</span><span><b>CONTEXT</b> LIVE</span><span><b>ROUTE</b> KIM/01</span><span><b>LATENCY</b> READY</span></div>
      <div class="ak-chips"><button class="ak-chip" data-ak-prompt="What happened? Give me the clearest explanation based on the current SBC data."><em>01</em><strong>What happened?</strong><small>Read the incident</small></button><button class="ak-chip" data-ak-prompt="What is happening right now in SBC that I should know about?"><em>02</em><strong>What’s happening?</strong><small>Live situation scan</small></button><button class="ak-chip" data-ak-prompt="Why did this happen? Trace the likely cause from the current Command Center context."><em>03</em><strong>Why?</strong><small>Trace the cause</small></button><button class="ak-chip" data-ak-prompt="What should I do next? Give me the top three moves and explain why."><em>04</em><strong>Next move</strong><small>Action priority</small></button></div>
      <div class="ak-mainline"><div class="ak-rail"><span>◈</span><span>01</span><span>02</span><span>03</span><span>◈</span></div><div id="sbcAiMessages" class="sbc-kim-messages" aria-live="polite"></div></div>
      <footer class="ak-composer"><div class="ak-compose-shell"><span class="ak-prompt-mark">›_</span><textarea id="sbcAiInput" rows="2" placeholder="Ask Kim what happened…" aria-label="Ask Kim"></textarea><button class="ak-send" id="sbcAiSend" type="button" aria-label="Ask Kim"><span>↗</span></button></div><div class="ak-hint"><span><kbd>ENTER</kbd> ASK · <kbd>SHIFT+ENTER</kbd> NEW LINE</span><span id="sbcAiVoiceStatus">KIM VOICE // CORAL</span></div></footer>
      <div class="ak-resize" id="akKimResize" aria-label="Resize Kim"></div>`;
    return true;
  }
  function save(d){try{const r=d.getBoundingClientRect();localStorage.setItem(KEY,JSON.stringify({left:r.left,top:r.top,width:r.width,height:r.height}));}catch{}}
  function restore(d){let s={};try{s=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{};const mobile=innerWidth<=650;const w=Number(s.width)|| (mobile?innerWidth-12:520);const h=Number(s.height)|| (mobile?innerHeight-12:700);d.style.width=clamp(w,320,Math.max(320,innerWidth-12))+'px';d.style.height=clamp(h,430,Math.max(430,innerHeight-12))+'px';const r=d.getBoundingClientRect();place(d,Number.isFinite(+s.left)?+s.left:innerWidth-r.width-24,Number.isFinite(+s.top)?+s.top:innerHeight-r.height-24);}
  function place(d,l,t){const r=d.getBoundingClientRect();d.style.right='auto';d.style.bottom='auto';d.style.transform='none';d.style.left=clamp(l,6,Math.max(6,innerWidth-r.width-6))+'px';d.style.top=clamp(t,6,Math.max(6,innerHeight-r.height-6))+'px';}
  function moveGPU(d,l,t){const base=d.getBoundingClientRect();const targetL=clamp(l,6,Math.max(6,innerWidth-base.width-6));const targetT=clamp(t,6,Math.max(6,innerHeight-base.height-6));const baseL=Number.parseFloat(d.style.left)||base.left;const baseT=Number.parseFloat(d.style.top)||base.top;d.style.transform=`translate3d(${targetL-baseL}px,${targetT-baseT}px,0)`;return {left:targetL,top:targetT};}
  function commitGPU(d){const r=d.getBoundingClientRect();d.style.transform='none';d.style.left=clamp(r.left,6,Math.max(6,innerWidth-r.width-6))+'px';d.style.top=clamp(r.top,6,Math.max(6,innerHeight-r.height-6))+'px';save(d);}
  function wireMove(){
    const d=dock(),h=$('#akKimDrag'),g=$('#akKimResize'); if(!d||d.dataset.askKimMove==='1')return; d.dataset.askKimMove='1';
    restore(d); let drag=null,resize=null;
    const undock=()=>{d.classList.remove('ak-docked-left','ak-docked-right','ak-collapsed'); d.style.width='';};
    const dockTo=edge=>{d.classList.remove('ak-docked-left','ak-docked-right');d.classList.add(edge==='left'?'ak-docked-left':'ak-docked-right');d.style.left=edge==='left'?'6px':'auto';d.style.right=edge==='right'?'6px':'auto';d.style.top=clamp(d.getBoundingClientRect().top,6,Math.max(6,innerHeight-150))+'px';d.style.bottom='auto';save(d);};
    h.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;undock();const r=d.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,l:r.left,t:r.top};try{h.setPointerCapture(e.pointerId)}catch{}e.preventDefault();},{passive:false});
    h.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;moveGPU(d,drag.l+e.clientX-drag.x,drag.t+e.clientY-drag.y);if(e.clientX<30) d.dataset.edge='left'; else if(e.clientX>innerWidth-30)d.dataset.edge='right'; else delete d.dataset.edge;e.preventDefault();},{passive:false});
    h.addEventListener('pointerup',e=>{if(drag&&e.pointerId===drag.id){const edge=d.dataset.edge;drag=null;delete d.dataset.edge;if(edge){d.style.transform='none';dockTo(edge);}else commitGPU(d);}});
    g.addEventListener('pointerdown',e=>{if(e.button!==0)return;undock();const r=d.getBoundingClientRect();resize={id:e.pointerId,x:e.clientX,y:e.clientY,w:r.width,h:r.height};try{g.setPointerCapture(e.pointerId)}catch{}e.preventDefault();},{passive:false});
    g.addEventListener('pointermove',e=>{if(!resize||e.pointerId!==resize.id)return;d.style.width=clamp(resize.w+e.clientX-resize.x,360,Math.max(360,innerWidth-12))+'px';d.style.height=clamp(resize.h+e.clientY-resize.y,500,Math.max(500,innerHeight-12))+'px';place(d,d.getBoundingClientRect().left,d.getBoundingClientRect().top);e.preventDefault();},{passive:false});
    g.addEventListener('pointerup',e=>{if(resize&&e.pointerId===resize.id){resize=null;save(d);}});
    addEventListener('resize',()=>{if(!d.classList.contains('hidden')){place(d,d.getBoundingClientRect().left,d.getBoundingClientRect().top);save(d)}},{passive:true});
    $('#akKimDock')?.addEventListener('click',()=>{d.classList.toggle('ak-collapsed');if(d.classList.contains('ak-collapsed'))save(d);});
  }
  function launcher(){if($('#sbcKimLauncher'))return;document.body.insertAdjacentHTML('beforeend',`<button id="sbcKimLauncher" type="button" aria-label="Open Ask Kim"><span class="ak-launch-orbit"></span><span class="ak-orb">✦</span><span class="ak-copy"><span class="ak-label">ASK KIM</span><span class="ak-title">What happened?</span></span><span class="ak-pulse"></span></button>`);$('#sbcKimLauncher').addEventListener('click',()=>window.openSbcAI?.());}
  function clock(){const e=$('#akClock');if(e)e.textContent=new Date().toLocaleTimeString([], {hour12:false});}
  function context(){const p=$('#akKimPage');if(p)p.textContent=document.querySelector('#viewTitle')?.textContent||window.state?.view||'Command Center';}
  function send(prompt){const input=$('#sbcAiInput');const text=String(prompt||input?.value||'').trim();if(!text)return;if(typeof window.askSbcAI==='function')window.askSbcAI(text);}
  function init(){const d=dock();if(!d)return false;installMarkup();launcher();wireMove();context();clock();setInterval(clock,1000);const close=$('#sbcKimClose');close.onclick=()=>window.closeSbcAI?.();$('#sbcAiSend').onclick=()=>send();$('#sbcAiInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});document.querySelectorAll('[data-ak-prompt]').forEach(b=>b.addEventListener('click',()=>send(b.dataset.akPrompt)));document.addEventListener('click',e=>{const b=e.target.closest('[data-v56-action="kim"],[data-kim-prompt],[data-auto-kim]');if(!b)return;const prompt=b.dataset.kimPrompt||b.dataset.autoKim||'What happened?';e.preventDefault();e.stopImmediatePropagation();send(prompt);},true);const oldOpen=window.openSbcAI,oldClose=window.closeSbcAI;window.openSbcAI=function(prefill){installMarkup();launcher();context();d.classList.remove('hidden','ak-collapsed');d.hidden=false;d.style.display='flex';d.setAttribute('aria-hidden','false');const status=$('#sbcAiStatus');if(status)status.textContent='SYSTEM READY';if(prefill){const i=$('#sbcAiInput');i.value=String(prefill);i.focus();}else setTimeout(()=>$('#sbcAiInput')?.focus(),60);try{window.loadSbcKimLiveContext?.()}catch{}return true;};window.closeSbcAI=function(){d.classList.add('hidden');d.hidden=true;d.style.display='none';d.setAttribute('aria-hidden','true');};if(oldOpen&&oldOpen!==window.openSbcAI){}if(oldClose&&oldClose!==window.closeSbcAI){}return true;}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
