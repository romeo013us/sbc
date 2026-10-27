/* SBC V55.11.3 — browser readiness diagnostics only.
   Navigation ownership remains exclusively in app.js.
   This file MUST NOT intercept clicks, prevent defaults, or mutate live controls.
*/
(function(){
  'use strict';
  const VERSION='55.11.3';
  const state={version:VERSION,installedAt:new Date().toISOString(),lastScan:null};
  window.SBC_OPEN_READY=state;
  function nav(view){
    if(!view||!window.state)return false;
    try{
      if(typeof window.sbcNavigate==='function') return !!window.sbcNavigate(String(view));
      window.state.view=String(view);
      const renderer=typeof window.sbcPrimaryRender==='function'?window.sbcPrimaryRender:window.render;
      if(typeof renderer!=='function')throw new Error('Canonical renderer unavailable.');
      renderer(); return true;
    }catch(err){ console.error('[SBC OPEN READY] navigation failure',err); return false; }
  }
  window.sbcOpenReadyNavigate=nav;
  function scan(){
    const navs=[...document.querySelectorAll('.sidebar .nav-item[data-view]')];
    const renderer=typeof window.sbcPrimaryRender==='function'||typeof window.render==='function';
    const buttons=[...document.querySelectorAll('button')];
    const broken=[];
    for(const b of buttons){
      const expr=b.getAttribute('onclick'); if(!expr)continue;
      const names=[...expr.matchAll(/(?:^|[;\s])([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
      const missing=names.filter(n=>!['if','for','while','switch','catch','confirm','alert','prompt','setTimeout','setInterval'].includes(n)&&typeof window[n]!=='function');
      if(missing.length)broken.push({label:b.innerText.trim().slice(0,80),missing,expr});
    }
    state.lastScan={version:VERSION,renderer,navCount:navs.length,buttons:{total:buttons.length,broken},view:window.state?.view||null,at:new Date().toISOString()};
    return state.lastScan;
  }
  window.sbcOpenReadyScan=scan;
  window.sbcOpenReadyClean=scan;
  window.sbcOpenReadyHealth=function(){const s=scan();return {version:VERSION,renderer:s.renderer,navCount:s.navCount,view:s.view,buttonsChecked:s.buttons.total,brokenButtons:s.buttons.broken.length,ready:Boolean(s.renderer&&s.navCount&&s.buttons.broken.length===0)};};
  function protectHiddenKimSurfaces(){['#sbcAiDock','#sbcKimLauncher'].forEach(sel=>{const el=document.querySelector(sel);if(el&&el.classList.contains('hidden'))el.style.setProperty('pointer-events','none','important');});}
  function install(){protectHiddenKimSurfaces();scan();window.dispatchEvent(new CustomEvent('sbc:open-ready-installed',{detail:{version:VERSION}}));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
