/* SBC V56.13.5-r5 — canonical critical navigation bridge.
 * Production Control + Supernova have exactly one browser click owner.
 * This runs after every legacy navigation layer and wins at capture phase.
 */
(function(){
  'use strict';
  const VERSION='56.13.5-r5';
  function route(view){
    const v=String(view||'').trim();
    if(!v)return false;
    if(window.sbcCriticalSurfaceGuardian?.setView && (v==='production-control'||v==='supernova')) return window.sbcCriticalSurfaceGuardian.setView(v);
    if(typeof window.sbcNavigate==='function'){
      window.sbcNavigate(v);
      return true;
    }
    if(window.state && typeof window.render==='function'){
      window.state.view=v;
      window.render();
      return true;
    }
    return false;
  }
  function target(e){
    const el=e.target?.closest?.('[data-owner-go],[data-view]');
    if(!el)return null;
    const v=String(el.dataset.ownerGo||el.dataset.view||'').trim();
    if(v!=='production-control' && v!=='supernova')return null;
    if(el.matches('.nav-item') || el.closest('.sidebar nav') || el.closest('#sbcOwnerQuickRail'))return {el,v};
    return null;
  }
  function handle(e){
    const hit=target(e); if(!hit)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    route(hit.v);
  }
  document.addEventListener('click',handle,true);
  document.addEventListener('keydown',e=>{
    if(e.key!=='Enter' && e.key!==' ')return;
    const hit=target(e); if(!hit)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    route(hit.v);
  },true);
  function annotate(){
    document.querySelectorAll('.sidebar .nav-item[data-view], #sbcOwnerQuickRail [data-owner-go]').forEach(el=>{
      const v=el.dataset.ownerGo||el.dataset.view;
      if(v==='production-control'||v==='supernova'){
        el.setAttribute('data-sbc-critical-nav','1');
        el.setAttribute('type','button');
      }
    });
  }
  annotate();
  new MutationObserver(annotate).observe(document.body,{childList:true,subtree:true});
  window.SBC_CRITICAL_NAV={version:VERSION,route};
})();
