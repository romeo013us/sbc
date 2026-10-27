/* SBC V50 — Kim interaction isolation.
 * One controller for close, drag, resize, typing and send.
 * Uses a top-level z-index and capture-safe direct targets so legacy document
 * listeners cannot freeze the chat surface.
 */
(function(){
  'use strict';
  const KEY='sbc.kim.dock.v50';
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  let ready=false, drag=null, resize=null;
  const qs=s=>document.querySelector(s);
  function dock(){return document.getElementById('sbcAiDock')}
  function input(){return document.getElementById('sbcAiInput')}
  function send(){return document.getElementById('sbcAiSend')}
  function close(){return document.getElementById('sbcKimClose')}
  function grip(){return document.querySelector('#sbcAiDock .sbc-kim-resize-grip')}
  function save(d){const r=d.getBoundingClientRect();try{localStorage.setItem(KEY,JSON.stringify({left:Math.round(r.left),top:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height)}))}catch{} }
  function restore(d){let s={};try{s=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}
    const w=clamp(Number(s.width)||Math.min(450,innerWidth-28),360,Math.max(360,innerWidth-16));
    const h=clamp(Number(s.height)||Math.min(700,innerHeight-40),420,Math.max(420,innerHeight-16));
    d.style.width=w+'px'; d.style.height=h+'px'; d.style.right='auto'; d.style.bottom='auto';
    const r=d.getBoundingClientRect();
    d.style.left=clamp(Number(s.left)||innerWidth-r.width-20,8,Math.max(8,innerWidth-r.width-8))+'px';
    d.style.top=clamp(Number(s.top)||innerHeight-r.height-20,8,Math.max(8,innerHeight-r.height-8))+'px';
  }
  function enforce(d){
    d.style.setProperty('pointer-events','auto','important');
    d.style.setProperty('z-index','2147483000','important');
    d.style.setProperty('isolation','isolate','important');
    d.querySelectorAll('button,input,textarea,select,a').forEach(el=>el.style.setProperty('pointer-events','auto','important'));
    const r=d.getBoundingClientRect(); if(!r.width||!r.height)return;
    d.style.left=clamp(r.left,8,Math.max(8,innerWidth-r.width-8))+'px';
    d.style.top=clamp(r.top,8,Math.max(8,innerHeight-r.height-8))+'px';
    d.style.right='auto'; d.style.bottom='auto';
  }
  function doSend(){const i=input();const text=i?.value?.trim()||'';if(!text)return;i?.blur();if(typeof window.askSbcAI==='function')window.askSbcAI(text);}
  function init(){
    const d=dock(); if(!d)return false;
    if(!ready){
      ready=true;
      const c=close(), s=send(), i=input(), g=grip(), head=d.querySelector('.sbc-kim-topbar');
      restore(d); enforce(d);
      c?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();window.closeSbcAI?.();},{capture:true});
      s?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();doSend();},{capture:true});
      i?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.stopPropagation();doSend();}},{capture:true});
      i?.addEventListener('pointerdown',e=>{e.stopPropagation();i.focus({preventScroll:true});},{capture:true});
      i?.addEventListener('mousedown',e=>{e.stopPropagation();},{capture:true});
      ['copy','cut','paste'].forEach(type=>i?.addEventListener(type,e=>{e.stopPropagation();},{capture:true}));
      i?.addEventListener('beforeinput',e=>{e.stopPropagation();},{capture:true});
      d.querySelectorAll('[data-kim-prompt]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();window.askSbcAI?.(b.getAttribute('data-kim-prompt')||'')},{capture:true}));
      head?.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;const r=d.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};try{head.setPointerCapture(e.pointerId)}catch{}e.preventDefault();e.stopPropagation();});
      g?.addEventListener('pointerdown',e=>{const r=d.getBoundingClientRect();resize={id:e.pointerId,x:e.clientX,y:e.clientY,w:r.width,h:r.height};try{g.setPointerCapture(e.pointerId)}catch{}e.preventDefault();e.stopPropagation();});
      addEventListener('pointermove',e=>{if(drag&&e.pointerId===drag.id){d.style.left=clamp(drag.left+e.clientX-drag.x,8,Math.max(8,innerWidth-d.offsetWidth-8))+'px';d.style.top=clamp(drag.top+e.clientY-drag.y,8,Math.max(8,innerHeight-d.offsetHeight-8))+'px';e.preventDefault();}else if(resize&&e.pointerId===resize.id){d.style.width=clamp(resize.w+e.clientX-resize.x,360,Math.max(360,innerWidth-16))+'px';d.style.height=clamp(resize.h+e.clientY-resize.y,420,Math.max(420,innerHeight-16))+'px';e.preventDefault();}},{capture:true,passive:false});
      addEventListener('pointerup',e=>{if(drag&&e.pointerId===drag.id){drag=null;save(d)}if(resize&&e.pointerId===resize.id){resize=null;save(d)}},{capture:true});
      addEventListener('pointercancel',e=>{if(drag&&e.pointerId===drag.id){drag=null;save(d)}if(resize&&e.pointerId===resize.id){resize=null;save(d)}},{capture:true});
      addEventListener('resize',()=>{if(!d.classList.contains('hidden')){enforce(d);save(d)}},{passive:true});
      addEventListener('keydown',e=>{if(e.key==='Escape'&&!d.classList.contains('hidden')){window.closeSbcAI?.();}},{capture:true});
    }
    enforce(d); return true;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.initKimDockV50=init;
  window.initKimDockV49=init;
})();
