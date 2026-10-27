/* SBC V56.13.5-r4 — direct owner navigation recovery.
   These two destinations render independently of legacy navigation layers. */
(function(){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  function direct(view){
    if(!window.state||typeof window.render!=='function')return false;
    window.state.view=view;
    document.querySelectorAll('.nav-item[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
    document.querySelector('.sidebar')?.classList.remove('open');
    return window.render();
  }
  function production(){ return window.sbcCriticalSurfaceGuardian?.setView('production-control') || direct('production-control'); }
  function supernova(){ return window.sbcCriticalSurfaceGuardian?.setView('supernova') || direct('supernova'); }
  function go(view){if(view==='production-control')return production();if(view==='supernova')return supernova();return direct(view);}
  function bind(){
    document.querySelectorAll('[data-owner-go]').forEach(b=>{const v=b.dataset.ownerGo;if(v==='production-control'||v==='supernova')b.onclick=e=>{e.preventDefault();e.stopPropagation();go(v);};});
    document.querySelectorAll('.nav-item[data-view]').forEach(b=>{const v=b.dataset.view;if(v==='production-control'||v==='supernova')b.onclick=e=>{e.preventDefault();e.stopPropagation();go(v);};});
  }
  window.SBC_NAV_HOTFIX_56135={go,bind,version:'56.13.5-r4'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,80),{once:true});else setTimeout(bind,80);
  new MutationObserver(()=>{clearTimeout(window.__sbcNavHotfixTimer);window.__sbcNavHotfixTimer=setTimeout(bind,30);}).observe(document.body,{childList:true,subtree:true});
})();
