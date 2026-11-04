/* SBC V66.0.0 — UI identity finalizer. Legacy subsystem names are not the app release. */
(function(){'use strict';
 function repair(){try{
   const v=document.getElementById('sbcBuildVersion');
   if(v) v.textContent='V66.0.0 · DEMO STUDIO';
   window.__SBC_UI_RELEASE__='66.0.0';
 }catch(e){console.warn('[SBC UI FINALIZE] '+String(e&&e.message||e));}}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(repair,0),{once:true});else setTimeout(repair,0);
 [500,1500,3000].forEach(ms=>setTimeout(repair,ms));
})();
