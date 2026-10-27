/* SBC V56.13.2 — Kim dock free-move interaction hotfix.
 * The dock is independently draggable/resizable. Input/buttons remain interactive.
 * Position is persisted locally and always clamped inside the viewport.
 */
(function(){
  'use strict';
  const KEY='sbc.kim.dock.v56.13.2';
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  let ready=false, drag=null, resize=null;
  const get=()=>document.getElementById('sbcAiDock');
  const save=d=>{try{const r=d.getBoundingClientRect();localStorage.setItem(KEY,JSON.stringify({left:Math.round(r.left),top:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height)}));}catch{}};
  function place(d,left,top){
    const r=d.getBoundingClientRect();
    const maxLeft=Math.max(8,innerWidth-r.width-8), maxTop=Math.max(8,innerHeight-r.height-8);
    d.style.right='auto'; d.style.bottom='auto';
    d.style.left=clamp(left,8,maxLeft)+'px';
    d.style.top=clamp(top,8,maxTop)+'px';
  }
  function fit(d){
    const mobile=innerWidth<=650;
    const width=mobile?Math.max(280,innerWidth-16):Math.min(450,innerWidth-16);
    const height=mobile?Math.min(Math.floor(innerHeight*.76),innerHeight-16):Math.min(700,innerHeight-16);
    d.style.width=width+'px'; d.style.height=Math.max(320,height)+'px';
    const r=d.getBoundingClientRect();
    place(d,r.left || innerWidth-width-20,r.top || innerHeight-height-20);
  }
  function restore(d){
    let s={}; try{s=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}
    const mobile=innerWidth<=650;
    const width=clamp(Number(s.width)|| (mobile?Math.max(280,innerWidth-16):Math.min(450,innerWidth-16)),280,Math.max(280,innerWidth-16));
    const height=clamp(Number(s.height)|| (mobile?Math.min(Math.floor(innerHeight*.76),innerHeight-16):Math.min(700,innerHeight-16)),320,Math.max(320,innerHeight-16));
    d.style.width=width+'px'; d.style.height=height+'px';
    const r=d.getBoundingClientRect();
    const left=Number.isFinite(Number(s.left))?Number(s.left):innerWidth-r.width-20;
    const top=Number.isFinite(Number(s.top))?Number(s.top):innerHeight-r.height-20;
    place(d,left,top);
  }
  function init(){
    const d=get(); if(!d)return false;
    if(ready){return true;}
    ready=true;
    d.style.position='fixed';
    d.style.zIndex='2147483000';
    d.style.right='auto'; d.style.bottom='auto';
    restore(d);
    const head=d.querySelector('.sbc-kim-topbar');
    const grip=d.querySelector('.sbc-kim-resize-grip');
    head?.style.setProperty('cursor','move','important');
    head?.style.setProperty('touch-action','none','important');
    head?.addEventListener('pointerdown',e=>{
      if(e.button!==0 || e.target.closest('button,input,textarea,select,a'))return;
      const r=d.getBoundingClientRect();
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false};
      try{head.setPointerCapture(e.pointerId)}catch{}
      e.preventDefault(); e.stopPropagation();
    },{passive:false});
    head?.addEventListener('pointermove',e=>{
      if(!drag||e.pointerId!==drag.id)return;
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;
      place(d,drag.left+dx,drag.top+dy);
      e.preventDefault(); e.stopPropagation();
    },{passive:false});
    const end=e=>{if(drag&&e.pointerId===drag.id){drag=null;save(d);}};
    head?.addEventListener('pointerup',end); head?.addEventListener('pointercancel',end);
    grip?.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      const r=d.getBoundingClientRect();
      resize={id:e.pointerId,x:e.clientX,y:e.clientY,w:r.width,h:r.height};
      try{grip.setPointerCapture(e.pointerId)}catch{}
      e.preventDefault(); e.stopPropagation();
    },{passive:false});
    grip?.addEventListener('pointermove',e=>{
      if(!resize||e.pointerId!==resize.id)return;
      d.style.width=clamp(resize.w+e.clientX-resize.x,280,Math.max(280,innerWidth-16))+'px';
      d.style.height=clamp(resize.h+e.clientY-resize.y,320,Math.max(320,innerHeight-16))+'px';
      place(d,d.getBoundingClientRect().left,d.getBoundingClientRect().top);
      e.preventDefault(); e.stopPropagation();
    },{passive:false});
    const rend=e=>{if(resize&&e.pointerId===resize.id){resize=null;save(d);}};
    grip?.addEventListener('pointerup',rend); grip?.addEventListener('pointercancel',rend);
    addEventListener('resize',()=>{if(!d.classList.contains('hidden')){const r=d.getBoundingClientRect();fit(d);place(d,r.left,r.top);save(d);}}, {passive:true});
    return true;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
  window.initKimDockV56132=init;
})();
