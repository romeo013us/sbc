/* SBC V66.0.1: deliberate, site-scoped stale-asset repair. No cookies,
   localStorage, IndexedDB, drafts, CRM records, or browser history are deleted. */
(function(){
  'use strict';
  const url=new URL(location.href);
  if(url.searchParams.get('sbcRepair')!=='1')return;
  url.searchParams.delete('sbcRepair');
  const destination=url.pathname+url.search+url.hash;
  async function run(){
    if(!confirm('Repair SBC browser display? Only obsolete SBC static caches and the SBC service worker will be reset. Your CRM records, login cookies, site preferences and browsing history will not be cleared.')){
      location.replace(destination);return;
    }
    let failed=false;
    try{
      if('serviceWorker' in navigator){
        const registrations=await navigator.serviceWorker.getRegistrations();
        for(const registration of registrations){
          const worker=registration.active||registration.waiting||registration.installing;
          if(worker){
            const script=new URL(worker.scriptURL,location.origin);
            if(script.origin===location.origin&&script.pathname==='/sw.js'){
              if(!(await registration.unregister()))failed=true;
            }
          }
        }
      }
      if('caches' in window){
        for(const key of await caches.keys()){
          if(/^sbc-static-v[\w.-]*$/.test(key))await caches.delete(key);
        }
      }
    }catch(err){failed=true;console.warn('[SBC VIEW REPAIR] Some browser assets could not be reset:',err?.message||err)}
    if(failed)alert('SBC view repair was incomplete. Try a hard refresh (Ctrl+Shift+R) and disable browser extensions for this site if the jumping continues.');
    location.replace(destination);
  }
  run();
})();
