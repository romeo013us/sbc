/* SBC V55.11.3 — mobile interaction hardening.
   Kim remains draggable, but its open dock can never consume the whole viewport.
*/
(function(){
  'use strict';
  const KEY='sbc.kim.float.v56.13.3';
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  function safeDock(){
    const d=document.getElementById('sbcAiDock'); if(!d)return;
    const mobile=innerWidth<=650;
    const maxW=mobile?Math.max(280,innerWidth-16):Math.min(450,innerWidth-28);
    const maxH=mobile?Math.max(360,Math.floor(innerHeight*.76)):Math.min(700,innerHeight-40);
    d.style.width=maxW+'px'; d.style.height=maxH+'px';
    const r=d.getBoundingClientRect();
    d.style.left=clamp(r.left,8,Math.max(8,innerWidth-r.width-8))+'px';
    d.style.top=clamp(r.top,8,Math.max(8,innerHeight-r.height-8))+'px';
    d.style.right='auto'; d.style.bottom='auto';
  }
  function init(){
    const b=document.getElementById('sbcKimLauncher');
    const d=document.getElementById('sbcAiDock');
    if(d){
      safeDock();
      addEventListener('resize',safeDock,{passive:true});
      document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!d.classList.contains('hidden'))window.closeSbcAI?.();},{capture:true});
      document.addEventListener('pointerdown',e=>{
        if(d.classList.contains('hidden'))return;
        if(!d.contains(e.target) && !b?.contains(e.target)) window.closeSbcAI?.();
      },{capture:true,passive:true});
    }
    if(!b || b.dataset.mobileFinalReady==='1') return !!b;
    b.dataset.mobileFinalReady='1';
    b.style.touchAction='none';
    b.setAttribute('aria-label','Open Kim — draggable');
    let saved={}; try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}
    function place(x,y){const r=b.getBoundingClientRect();const maxX=Math.max(8,innerWidth-r.width-8),maxY=Math.max(8,innerHeight-r.height-8);b.style.left=clamp(x,8,maxX)+'px';b.style.top=clamp(y,8,maxY)+'px';b.style.right='auto';b.style.bottom='auto';}
    function restore(){if(Number.isFinite(Number(saved.left))&&Number.isFinite(Number(saved.top)))place(Number(saved.left),Number(saved.top));}
    function save(){const r=b.getBoundingClientRect();try{localStorage.setItem(KEY,JSON.stringify({left:Math.round(r.left),top:Math.round(r.top)}))}catch{}}
    function keep(){const r=b.getBoundingClientRect();if(r.width)place(r.left,r.top)}
    requestAnimationFrame(restore); addEventListener('resize',keep,{passive:true});
    let drag=null;
    b.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;const r=b.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false};try{b.setPointerCapture(e.pointerId)}catch{}e.stopPropagation();},{passive:false});
    b.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;place(drag.left+dx,drag.top+dy);e.preventDefault();e.stopPropagation();},{passive:false});
    const end=e=>{if(!drag||e.pointerId!==drag.id)return;const moved=drag.moved;drag=null;save();if(moved)e.stopPropagation()};
    b.addEventListener('pointerup',end);b.addEventListener('pointercancel',end);
    return true;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.initSbcMobileFinal=init;
})();
