/* SBC V56.25.3 — Kim Control Nexus
 * Canonical single Kim dock + independent top/bottom launchers.
 * Legacy Kim launchers/docks are suppressed so one click can never open two Kim surfaces.
 */
(function(){
  'use strict';
  const DOCK_ID='sbcAiDock';
  const TOP_ID='sbcKimTopButton';
  const BOTTOM_ID='sbcKimBottomButton';
  const LEGACY_LAUNCHERS=['#sbcKimLauncher','.akx-launcher'];
  let observer=null;
  let binding=false;

  function dock(){return document.getElementById(DOCK_ID)}
  function open(prefill){
    try{
      if(typeof window.openSbcAI==='function') return window.openSbcAI(prefill)!==false;
      return false;
    }catch(e){console.warn('[SBC KIM CONTROL] open failed',e);return false;}
  }
  function removeLegacy(){
    LEGACY_LAUNCHERS.forEach(sel=>document.querySelectorAll(sel).forEach(el=>{
      if(el.id!==TOP_ID && el.id!==BOTTOM_ID) el.remove();
    }));
    document.querySelectorAll('.sbc-kim-dock').forEach((el,i)=>{
      if(i>0 && el.id!==DOCK_ID) el.remove();
    });
  }
  function bindButton(el,label){
    if(!el || el.dataset.kimNexusBound==='1') return;
    el.dataset.kimNexusBound='1';
    el.setAttribute('aria-controls',DOCK_ID);
    el.setAttribute('aria-haspopup','dialog');
    el.setAttribute('aria-label',label);
    el.addEventListener('click',e=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      open();
    },{capture:true});
  }
  function ensureTop(){
    // V58.3.1: top Kim OS launcher permanently retired.
    document.getElementById(TOP_ID)?.remove();
  }
  function ensureBottom(){
    let b=document.getElementById(BOTTOM_ID);
    if(!b){
      b=document.createElement('button');
      b.id=BOTTOM_ID;b.type='button';b.className='sbc-kim-bottom-launcher';
      b.innerHTML='<span class="sbc-kim-bottom-orb">👑</span><span><small>KIM</small><strong>Open Chief of Staff</strong></span><span class="sbc-kim-bottom-arrow">↗</span>';
      document.body.appendChild(b);
    }
    bindButton(b,'Open Kim AI Chief of Staff');
  }
  function enforce(){
    if(binding)return;
    binding=true;
    ensureTop();
    ensureBottom();
    removeLegacy();
    binding=false;
  }
  function boot(){
    enforce();
    if(observer)return;
    observer=new MutationObserver(()=>enforce());
    observer.observe(document.body,{childList:true,subtree:true});
    [0,100,500,1200,2500].forEach(ms=>setTimeout(enforce,ms));
  }
  window.sbcKimControlNexus={open,ensure:enforce,dedupe:removeLegacy};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
