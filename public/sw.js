const CACHE='sbc-static-v66-36-canonical-shell';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();})()));
// SBC_V6637_NETWORK_ONLY_NO_OFFLINE_MUTATION_REPLAY: network-only UI/data. No cached authenticated HTML or stale runtime.
self.addEventListener('fetch',event=>{event.respondWith(fetch(event.request));});
// Historic IndexedDB records are preserved, but queued writes may NOT execute in background.
self.addEventListener('sync',event=>{
  if(event.tag==='sbc-offline-sync')event.waitUntil(Promise.resolve());
});

/* SBC_V6568_CACHE_CLEANUP */
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE).map(k=>caches.delete(k)))))});
