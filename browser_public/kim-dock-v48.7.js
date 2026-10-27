/* SBC V48.7 — Kim dock interaction isolation hotfix
   UI-only: isolates chat input/actions from global document handlers and keeps the dock draggable. */
(function(){
  'use strict';
  const KEY='sbc.kim.dock.v48.7';
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  function init(){
    const d=document.getElementById('sbcAiDock');
    if(!d || d.dataset.v487Ready==='1') return;
    d.dataset.v487Ready='1';
    const head=d.querySelector('.sbc-ai-head');
    const input=d.querySelector('#sbcAiInput');
    const send=d.querySelector('#sbcAiSend');
    const actions=d.querySelector('.sbc-ai-actions');
    const saved=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}})();
    const applySaved=()=>{
      const maxW=Math.max(320,innerWidth-16), maxH=Math.max(360,innerHeight-16);
      if(Number.isFinite(Number(saved.width))) d.style.width=clamp(Number(saved.width),320,maxW)+'px';
      if(Number.isFinite(Number(saved.height))) d.style.height=clamp(Number(saved.height),360,maxH)+'px';
      requestAnimationFrame(()=>{
        const r=d.getBoundingClientRect();
        const left=saved.left==null?null:clamp(Number(saved.left)||4,4,Math.max(4,innerWidth-r.width-4));
        const top=saved.top==null?null:clamp(Number(saved.top)||4,4,Math.max(4,innerHeight-r.height-4));
        if(left!=null){d.style.left=left+'px';d.style.right='auto';}
        if(top!=null){d.style.top=top+'px';d.style.bottom='auto';}
        if(left!=null||top!=null)d.classList.add('v487-positioned');
      });
    };
    applySaved();
    const save=()=>{const r=d.getBoundingClientRect();try{localStorage.setItem(KEY,JSON.stringify({left:Math.round(r.left),top:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height)}))}catch{}};
    const clampPosition=()=>{
      const r=d.getBoundingClientRect();
      if(!d.classList.contains('v487-positioned')) return;
      d.style.left=clamp(r.left,4,Math.max(4,innerWidth-r.width-4))+'px';
      d.style.top=clamp(r.top,4,Math.max(4,innerHeight-r.height-4))+'px';
      d.style.right='auto'; d.style.bottom='auto';
    };
    addEventListener('resize',clampPosition,{passive:true});

    // Critical: isolate the chat controls from document-level click/keydown/pointer handlers.
    [input,send,actions].filter(Boolean).forEach(el=>{
      ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','click'].forEach(type=>el.addEventListener(type,e=>e.stopPropagation(),{capture:true}));
    });
    if(input){
      ['keydown','keyup','keypress','input','beforeinput','focus','blur'].forEach(type=>input.addEventListener(type,e=>e.stopPropagation(),{capture:true}));
      input.addEventListener('pointerdown',()=>{input.focus({preventScroll:true});},{capture:false});
      input.addEventListener('keydown',e=>{
        if(e.key==='Enter' && (e.ctrlKey||e.metaKey)){
          e.preventDefault();
          if(typeof window.askSbcAI==='function') window.askSbcAI(input.value);
        }
      });
    }

    let drag=null;
    head?.addEventListener('pointerdown',e=>{
      if(e.target.closest('button,input,textarea,select,a')) return;
      const r=d.getBoundingClientRect();
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};
      d.classList.add('v487-dragging');
      try{head.setPointerCapture(e.pointerId)}catch{}
      e.preventDefault(); e.stopPropagation();
    });
    head?.addEventListener('pointermove',e=>{
      if(!drag || e.pointerId!==drag.id)return;
      const maxX=Math.max(4,innerWidth-d.offsetWidth-4),maxY=Math.max(4,innerHeight-d.offsetHeight-4);
      d.style.left=clamp(drag.left+e.clientX-drag.x,4,maxX)+'px';
      d.style.top=clamp(drag.top+e.clientY-drag.y,4,maxY)+'px';
      d.style.right='auto'; d.style.bottom='auto'; d.classList.add('v487-positioned');
      e.preventDefault(); e.stopPropagation();
    });
    const endDrag=e=>{if(drag && (!e || e.pointerId===drag.id)){drag=null;d.classList.remove('v487-dragging');save();}};
    head?.addEventListener('pointerup',endDrag); head?.addEventListener('pointercancel',endDrag); head?.addEventListener('lostpointercapture',()=>endDrag());

    // Keep resize isolated to the lower-right grip.
    const grip=document.createElement('div');
    grip.className='sbc-kim-resize-grip v487-grip'; grip.title='Resize Kim'; d.appendChild(grip);
    let resize=null;
    grip.addEventListener('pointerdown',e=>{const r=d.getBoundingClientRect();resize={id:e.pointerId,x:e.clientX,y:e.clientY,w:r.width,h:r.height};try{grip.setPointerCapture(e.pointerId)}catch{}e.preventDefault();e.stopPropagation();});
    grip.addEventListener('pointermove',e=>{if(!resize||e.pointerId!==resize.id)return;d.style.width=clamp(resize.w+e.clientX-resize.x,300,Math.max(300,innerWidth-16))+'px';d.style.height=clamp(resize.h+e.clientY-resize.y,320,Math.max(320,innerHeight-16))+'px';e.preventDefault();e.stopPropagation();});
    const endResize=e=>{if(resize && (!e || e.pointerId===resize.id)){resize=null;save();}};
    grip.addEventListener('pointerup',endResize); grip.addEventListener('pointercancel',endResize);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init); else init();
  window.initKimDockV487=init;
})();
