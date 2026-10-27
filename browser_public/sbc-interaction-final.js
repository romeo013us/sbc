/* SBC V55.11.4 — single-owner browser interaction controller.
   No document capture handlers. No navigation interception. No legacy Kim controller.
*/
(function(){
  'use strict';
  const KEY='sbc.kim.position.v55.11.4';
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  function fitDock(){
    const d=document.getElementById('sbcAiDock'); if(!d)return;
    const mobile=innerWidth<=650;
    const maxW=Math.max(280,innerWidth-16);
    const maxH=Math.max(320,innerHeight-16);
    d.style.width=(mobile?maxW:Math.min(450,maxW))+'px';
    d.style.height=(mobile?Math.min(Math.floor(innerHeight*.76),maxH):Math.min(700,maxH))+'px';
    const r=d.getBoundingClientRect();
    if(r.width){d.style.left=clamp(r.left,8,Math.max(8,innerWidth-r.width-8))+'px';d.style.top=clamp(r.top,8,Math.max(8,innerHeight-r.height-8))+'px';d.style.right='auto';d.style.bottom='auto';}
  }
  function init(){
    const b=null,d=document.getElementById('sbcAiDock');
    if(!d)return;
    if(d.dataset.interactionFinal==='1')return;
    d.dataset.interactionFinal='1';
    fitDock();
    addEventListener('resize',fitDock,{passive:true});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!d.classList.contains('hidden'))window.closeSbcAI?.()});
    d.querySelector('#sbcKimClose')?.addEventListener('click',()=>window.closeSbcAI?.());
    d.querySelector('#sbcAiSend')?.addEventListener('click',()=>{const i=d.querySelector('#sbcAiInput');if(i?.value.trim())window.askSbcAI?.(i.value);});
    d.querySelector('#sbcAiInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();window.askSbcAI?.(e.currentTarget.value)}});
    d.querySelectorAll('[data-kim-prompt]').forEach(x=>x.addEventListener('click',()=>window.askSbcAI?.(x.getAttribute('data-kim-prompt')||'')));
    let drag=null;
    const head=d.querySelector('.sbc-kim-topbar');
    head?.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;const r=d.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};head.setPointerCapture?.(e.pointerId);e.preventDefault();});
    head?.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;d.style.left=clamp(drag.left+e.clientX-drag.x,8,Math.max(8,innerWidth-d.offsetWidth-8))+'px';d.style.top=clamp(drag.top+e.clientY-drag.y,8,Math.max(8,innerHeight-d.offsetHeight-8))+'px';});
    const end=e=>{if(drag&&e.pointerId===drag.id){drag=null;}};head?.addEventListener('pointerup',end);head?.addEventListener('pointercancel',end);
    let fd=null;const grip=d.querySelector('.sbc-kim-resize-grip');
    grip?.addEventListener('pointerdown',e=>{const r=d.getBoundingClientRect();fd={id:e.pointerId,x:e.clientX,y:e.clientY,w:r.width,h:r.height};grip.setPointerCapture?.(e.pointerId);e.preventDefault();e.stopPropagation();});
    grip?.addEventListener('pointermove',e=>{if(!fd||e.pointerId!==fd.id)return;d.style.width=clamp(fd.w+e.clientX-fd.x,280,Math.max(280,innerWidth-16))+'px';d.style.height=clamp(fd.h+e.clientY-fd.y,320,Math.max(320,innerHeight-16))+'px';e.stopPropagation();});
    grip?.addEventListener('pointerup',e=>{if(fd&&e.pointerId===fd.id)fd=null});
    if(b&&!b.dataset.interactionFinal){
      b.dataset.interactionFinal='1';b.style.touchAction='none';
      let bd=null;
      b.addEventListener('pointerdown',e=>{if(e.button!==0)return;const r=b.getBoundingClientRect();bd={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false};b.setPointerCapture?.(e.pointerId);e.preventDefault();});
      b.addEventListener('pointermove',e=>{if(!bd||e.pointerId!==bd.id)return;const dx=e.clientX-bd.x,dy=e.clientY-bd.y;if(Math.abs(dx)+Math.abs(dy)>6)bd.moved=true;const r=b.getBoundingClientRect();b.style.left=clamp(bd.left+dx,8,Math.max(8,innerWidth-r.width-8))+'px';b.style.top=clamp(bd.top+dy,8,Math.max(8,innerHeight-r.height-8))+'px';b.style.right='auto';b.style.bottom='auto';e.preventDefault();});
      b.addEventListener('pointerup',e=>{if(!bd||e.pointerId!==bd.id)return;const moved=bd.moved;bd=null;if(!moved)window.openSbcAI?.();});
      b.addEventListener('pointercancel',()=>{bd=null});
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.initSbcInteractionFinal=init;
})();

/* V56.9 semantic row priority engine — additive to the existing interaction controller. */
(function(){'use strict';
 const findContainer=()=>document.querySelector('.command-center-grid')||document.querySelector('.v56-shell')||document.querySelector('#content');
 function shuffleRows(prioritizedIds=[]){const c=findContainer();if(!c)return;const modules=[...c.children].filter(x=>x.nodeType===1);const first=new Map(modules.map(el=>[el,el.getBoundingClientRect()]));modules.forEach((el,i)=>{if(!el.dataset.moduleId)el.dataset.moduleId=el.id||`module-${i+1}`;const n=prioritizedIds.indexOf(el.dataset.moduleId);el.style.order=n<0?99:n;el.style.willChange='transform';el.style.transform='translate3d(0,0,0)';});requestAnimationFrame(()=>modules.forEach(el=>{const a=first.get(el),b=el.getBoundingClientRect();if(!a||!b)return;const dx=a.left-b.left,dy=a.top-b.top;if(dx||dy){el.style.transform=`translate3d(${dx}px,${dy}px,0)`;el.style.transition='transform 0s';requestAnimationFrame(()=>{el.style.transform='translate3d(0,0,0)';el.style.transition='transform .55s cubic-bezier(.25,1,.5,1)';});}}));}
 window.CommandCenterUI=window.CommandCenterUI||{};window.CommandCenterUI.shuffleRows=shuffleRows;window.CommandCenterUI.initRows=()=>{const c=findContainer();if(!c)return;[...c.children].forEach((el,i)=>{if(!el.dataset.moduleId)el.dataset.moduleId=el.id||`module-${i+1}`;});};window.CommandCenterUI.initRows();
})();

/* V56.13.1 — revenue telemetry → FLIP priority rail. Additive; does not replace navigation. */
(function(){'use strict';
  function revenuePriority(){
    const ui=window.CommandCenterUI;if(!ui?.shuffleRows)return;if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    const c=document.querySelector('.command-center-grid')||document.querySelector('.v56-shell')||document.querySelector('#content');if(!c)return;
    const ids=[...c.children].map((el,i)=>{if(!el.dataset.moduleId)el.dataset.moduleId=el.id||`module-${i+1}`;return el.dataset.moduleId;});
    const score=id=>{const x=String(id).toLowerCase();if(/revenue|sales|play|hot|opportun/.test(x))return 0;if(/kim|telemetry|intelligence/.test(x))return 1;return 9;};
    ui.shuffleRows(ids.sort((a,b)=>score(a)-score(b)));
  }
  function init(){if(!window.EventSource)return;const es=new EventSource('/api/v56131/telemetry/stream');es.addEventListener('sbc',e=>{try{const x=JSON.parse(e.data||'{}');if(/HOT_LEAD_HANDOFF|OBJECTION_DETECTED|CALL_CONNECTED|VOICE_STATE/.test(String(x.eventType||x.type||''))||Number(x.intentScore||0)>=85)revenuePriority();}catch{}});window.__SBC_V56131_STREAM=es;}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
