/* SBC V48.8 — Kim dock authoritative interaction controller
   UI-only emergency repair. Owns drag + chat input without global event interception. */
(function(){
  'use strict';
  const KEY='sbc.kim.dock.v48.8';
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  function init(){
    const d=document.getElementById('sbcAiDock');
    if(!d || d.dataset.v488Ready==='1') return !!d;
    d.dataset.v488Ready='1';

    const head=d.querySelector('.sbc-ai-head');
    const input=d.querySelector('#sbcAiInput');
    const send=d.querySelector('#sbcAiSend');
    const saved=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}})();

    // Never let an old/off-screen saved position make Kim unusable.
    const restore=()=>{
      const r0=d.getBoundingClientRect();
      const w=clamp(Number(saved.width)||r0.width||480,320,Math.max(320,innerWidth-16));
      const h=clamp(Number(saved.height)||r0.height||650,320,Math.max(320,innerHeight-16));
      d.style.width=w+'px'; d.style.height=h+'px';
      const r=d.getBoundingClientRect();
      if(saved.left!=null){d.style.left=clamp(Number(saved.left)||8,8,Math.max(8,innerWidth-r.width-8))+'px';d.style.right='auto';}
      if(saved.top!=null){d.style.top=clamp(Number(saved.top)||8,8,Math.max(8,innerHeight-r.height-8))+'px';d.style.bottom='auto';}
    };
    restore();

    const save=()=>{
      const r=d.getBoundingClientRect();
      try{localStorage.setItem(KEY,JSON.stringify({left:Math.round(r.left),top:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height)}));}catch{}
    };
    const keepVisible=()=>{
      const r=d.getBoundingClientRect();
      d.style.left=clamp(r.left,8,Math.max(8,innerWidth-r.width-8))+'px';
      d.style.top=clamp(r.top,8,Math.max(8,innerHeight-r.height-8))+'px';
      d.style.right='auto'; d.style.bottom='auto';
    };
    addEventListener('resize',keepVisible,{passive:true});

    // Explicitly restore native interaction on the chat controls.
    if(input){
      input.disabled=false;
      input.readOnly=false;
      input.style.pointerEvents='auto';
      input.style.userSelect='text';
      input.style.webkitUserSelect='text';
      input.style.touchAction='auto';
      input.setAttribute('tabindex','0');
      input.addEventListener('pointerdown',e=>{e.stopPropagation();},false);
      input.addEventListener('mousedown',e=>{e.stopPropagation();},false);
      input.addEventListener('touchstart',e=>{e.stopPropagation();},false);
      input.addEventListener('click',e=>{e.stopPropagation(); input.focus();},false);
      input.addEventListener('keydown',e=>{
        if((e.ctrlKey||e.metaKey) && e.key==='Enter'){
          e.preventDefault();
          if(typeof window.askSbcAI==='function') window.askSbcAI(input.value);
        }
      },false);
    }
    [send].filter(Boolean).forEach(el=>{
      el.disabled=false;
      el.style.pointerEvents='auto';
      el.addEventListener('pointerdown',e=>e.stopPropagation(),false);
      el.addEventListener('mousedown',e=>e.stopPropagation(),false);
      el.addEventListener('click',e=>e.stopPropagation(),false);
    });

    // Drag ONLY from the header, never from the input/actions.
    let drag=null;
    head?.addEventListener('pointerdown',e=>{
      if(e.button!==0) return;
      if(e.target.closest('button,input,textarea,select,a')) return;
      const r=d.getBoundingClientRect();
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};
      d.style.left=r.left+'px'; d.style.top=r.top+'px'; d.style.right='auto'; d.style.bottom='auto';
      try{head.setPointerCapture(e.pointerId)}catch{}
      e.preventDefault();
    },false);
    head?.addEventListener('pointermove',e=>{
      if(!drag || e.pointerId!==drag.id)return;
      const maxX=Math.max(8,innerWidth-d.offsetWidth-8),maxY=Math.max(8,innerHeight-d.offsetHeight-8);
      d.style.left=clamp(drag.left+e.clientX-drag.x,8,maxX)+'px';
      d.style.top=clamp(drag.top+e.clientY-drag.y,8,maxY)+'px';
    },false);
    const end=e=>{if(drag && (!e || e.pointerId===drag.id)){drag=null;save();}};
    head?.addEventListener('pointerup',end,false);
    head?.addEventListener('pointercancel',end,false);
    head?.addEventListener('lostpointercapture',()=>end(),false);

    // A small resize grip, isolated from chat input.
    let grip=d.querySelector('.sbc-kim-resize-grip');
    if(!grip){
      grip=document.createElement('div');
      grip.className='sbc-kim-resize-grip';
      grip.setAttribute('aria-label','Resize Kim');
      d.appendChild(grip);
    }
    let resize=null;
    grip.addEventListener('pointerdown',e=>{
      const r=d.getBoundingClientRect(); resize={id:e.pointerId,x:e.clientX,y:e.clientY,w:r.width,h:r.height};
      try{grip.setPointerCapture(e.pointerId)}catch{} e.preventDefault();e.stopPropagation();
    },false);
    grip.addEventListener('pointermove',e=>{
      if(!resize||e.pointerId!==resize.id)return;
      d.style.width=clamp(resize.w+e.clientX-resize.x,320,Math.max(320,innerWidth-16))+'px';
      d.style.height=clamp(resize.h+e.clientY-resize.y,320,Math.max(320,innerHeight-16))+'px';
      e.preventDefault();e.stopPropagation();
    },false);
    grip.addEventListener('pointerup',e=>{if(resize&&e.pointerId===resize.id){resize=null;save();}},false);
    grip.addEventListener('pointercancel',()=>{resize=null;},false);

    return true;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init); else init();
  window.initKimDockV488=init;
})();
