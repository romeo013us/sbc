/* SBC V49 — Kim chat redesign. CSP-safe single owner for the dock UI. */
(function(){
  'use strict';
  const KEY='sbc.kim.dock.v49';
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  const $=(sel)=>document.querySelector(sel);
  function init(){
    const d=$('#sbcAiDock'); if(!d || d.dataset.v49Ready==='1') return !!d;
    d.dataset.v49Ready='1'; d.hidden=false;
    const head=d.querySelector('.sbc-kim-topbar'), input=$('#sbcAiInput'), send=$('#sbcAiSend'), close=$('#sbcKimClose'), grip=d.querySelector('.sbc-kim-resize-grip');
    const saved=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}})();
    const restore=()=>{const r=d.getBoundingClientRect();const w=clamp(Number(saved.width)||Math.max(390,r.width||430),360,Math.max(360,innerWidth-16));const h=clamp(Number(saved.height)||Math.min(700,r.height||680),420,Math.max(420,innerHeight-16));d.style.width=w+'px';d.style.height=h+'px';const rr=d.getBoundingClientRect();d.style.left=clamp(Number(saved.left)||innerWidth-rr.width-20,8,Math.max(8,innerWidth-rr.width-8))+'px';d.style.top=clamp(Number(saved.top)||innerHeight-rr.height-20,8,Math.max(8,innerHeight-rr.height-8))+'px';d.style.right='auto';d.style.bottom='auto';};
    const save=()=>{const r=d.getBoundingClientRect();try{localStorage.setItem(KEY,JSON.stringify({left:Math.round(r.left),top:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height)}))}catch{}};
    const keep=()=>{const r=d.getBoundingClientRect();d.style.left=clamp(r.left,8,Math.max(8,innerWidth-r.width-8))+'px';d.style.top=clamp(r.top,8,Math.max(8,innerHeight-r.height-8))+'px'};
    restore(); addEventListener('resize',keep,{passive:true});
    close?.addEventListener('click',()=>window.closeSbcAI?.());
    send?.addEventListener('click',()=>{const text=input?.value||''; if(text.trim() && typeof window.askSbcAI==='function') window.askSbcAI(text); input?.focus();});
    input?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.stopPropagation();send?.click();}});
    input?.addEventListener('click',e=>e.stopPropagation());
    input?.addEventListener('pointerdown',e=>e.stopPropagation());
    input?.addEventListener('mousedown',e=>e.stopPropagation());
    d.querySelectorAll('[data-kim-prompt]').forEach(b=>b.addEventListener('click',()=>window.askSbcAI?.(b.getAttribute('data-kim-prompt')||'')));
    let drag=null;
    head?.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;const r=d.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};try{head.setPointerCapture(e.pointerId)}catch{}e.preventDefault();});
    head?.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;d.style.left=clamp(drag.left+e.clientX-drag.x,8,Math.max(8,innerWidth-d.offsetWidth-8))+'px';d.style.top=clamp(drag.top+e.clientY-drag.y,8,Math.max(8,innerHeight-d.offsetHeight-8))+'px';});
    const end=e=>{if(drag&&(!e||e.pointerId===drag.id)){drag=null;save()}}; head?.addEventListener('pointerup',end);head?.addEventListener('pointercancel',end);
    let resize=null;
    grip?.addEventListener('pointerdown',e=>{const r=d.getBoundingClientRect();resize={id:e.pointerId,x:e.clientX,y:e.clientY,w:r.width,h:r.height};try{grip.setPointerCapture(e.pointerId)}catch{}e.preventDefault();e.stopPropagation();});
    grip?.addEventListener('pointermove',e=>{if(!resize||e.pointerId!==resize.id)return;d.style.width=clamp(resize.w+e.clientX-resize.x,360,Math.max(360,innerWidth-16))+'px';d.style.height=clamp(resize.h+e.clientY-resize.y,420,Math.max(420,innerHeight-16))+'px';e.stopPropagation();});
    grip?.addEventListener('pointerup',e=>{if(resize&&e.pointerId===resize.id){resize=null;save()}});
    return true;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.initKimDockV49=init;
})();
