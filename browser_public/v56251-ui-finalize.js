/* SBC V65.1.23 — UI identity finalizer. Legacy subsystem names are not the app release. */
(function(){'use strict';
 function repair(){try{
   const v=document.getElementById('sbcBuildVersion');
   if(v) v.textContent='V65.1.26 · DEMO STUDIO';
   window.__SBC_UI_RELEASE__='65.1.26';
 }catch(e){console.warn('[SBC UI FINALIZE] '+String(e&&e.message||e));}}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(repair,0),{once:true});else setTimeout(repair,0);
 [500,1500,3000].forEach(ms=>setTimeout(repair,ms));
})();
