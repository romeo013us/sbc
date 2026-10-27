(()=>{
  'use strict';
  const V='56.5.0';
  async function get(path){const r=await fetch(path,{credentials:'include'});return r.json();}
  function badge(){
    const host=document.querySelector('[data-v565-operational-badge]');
    if(!host)return;
    host.textContent='V'+V+' HARDENED';
    host.title='Public facade, tenant boundary, 90-day telemetry, guarded recovery and provider policy layer';
  }
  async function show(){
    try{
      const [f,g]=await Promise.all([get('/api/v56/facade/v565-manifest'),get('/api/v56/guardian/summary')]);
      const body=`<div style="padding:18px"><h2>SBC V56.5 Operational Hardening</h2><p>Public facade: <b>${f.publicPrefix||'/api/v56'}</b></p><p>Guardian files scanned: <b>${g.summary?.filesScanned??'—'}</b></p><p>Routes inventoried: <b>${g.summary?.routeCount??'—'}</b></p><p>Policy: <b>Owner-governed / no automatic deletion</b></p></div>`;
      if(window.openModal)window.openModal('V56.5 HARDENING',body);else alert('V56.5 Hardened: '+(g.summary?.routeCount??0)+' routes inventoried.');
    }catch(e){console.warn('[V565]',e.message);}
  }
  window.SBCV565={version:V,show};
  document.addEventListener('DOMContentLoaded',badge);
})();
