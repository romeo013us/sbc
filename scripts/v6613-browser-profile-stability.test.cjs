'use strict';
/*
 * SBC V66.0.13: scoped Chrome profile stability regression.
 * Uses browser mocks only, never hits customer APIs or mutates production state.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const app=read('public/app.js');
const index=read('public/index.html');
assert.equal(app,read('browser_public/app.js'),'frontend mirrors must match');
assert.equal(index,read('browser_public/index.html'),'HTML mirrors must match');
const start=app.indexOf('(function sbcClientFreshness(){');
const end=app.indexOf('\n\nfunction sbcShowLogin',start);
assert.ok(start>=0&&end>start,'extract exact browser profile guard');
const guard=app.slice(start,end);
new vm.Script(guard);
assert.match(guard,/SBC_V6613_PROFILE_STABILITY/);
assert.doesNotMatch(guard,/\blocation\.(?:reload|replace|assign)\s*\(/,'never reload an active CRM automatically');
assert.doesNotMatch(guard,/localStorage\.(?:clear|removeItem)|sessionStorage\.(?:clear|removeItem)|indexedDB\.deleteDatabase|document\.cookie\s*=/,
  'do not clear sessions, drafts, history or persistent customer state');
assert.match(index,/\/app\.js\?v=66\.0\.15-persistent-repair/);
assert.match(index,/\/sbc-browser-view-repair-v6601\.js\?v=66\.0\.13-profile-stability/);
assert.match(index,/SBC_V6613_PROFILE_STABILITY/);
assert.ok((index.match(/\?v=66\.0\.13-profile-stability/g)||[]).length>80,
  'all old static assets must refresh with the same release version');
assert.ok(!index.includes('?v=66.34-asset-cache-reset'),'no old versioned script URLs');
for(const pathName of ['public/sbc-v6559-ui.js','browser_public/sbc-v6559-ui.js']){
  const code=read(pathName);
  new vm.Script(code);
  assert.doesNotMatch(code,/storage[^;]*location\.reload/,'retired dashboard section-order events must not reload other tabs');
}
const roleBlock=index.slice(index.indexOf('<script id="sbc-lorna-least-privilege-ui">'),
  index.indexOf('</script>',index.indexOf('<script id="sbc-lorna-least-privilege-ui">')));
assert.match(roleBlock,/function isResearcher\(/,'researcher restrictions remain');
assert.match(roleBlock,/MutationObserver\(scheduleReconcile\)/,'coalesced role UI reconciliation');
assert.match(roleBlock,/readCooldownMs=15000/,'do not hammer the auth service');
(async()=>{
  const store=new Map([['sbc-client-version','65.1.25-customer360'],['sbc-call-draft-v1:123','private draft']]);
  const deleted=[],removed=[],reloads=[];
  let oldWorkerPresent=true;
  const liveCacheKeys=new Set(['sbc-static-v65-old','sbc-static-v66-current','unrelated-cache','another-app']);
  const registrations=[
    {active:{scriptURL:'https://command.example/sw.js'},async unregister(){removed.push('sbc');oldWorkerPresent=false;return true;}},
    {active:{scriptURL:'https://command.example/other-sw.js'},async unregister(){removed.push('other');return true;}},
  ];
  const context={
    localStorage:{getItem:key=>store.get(key)||null,setItem:(k,v)=>store.set(k,v)},
    navigator:{serviceWorker:{getRegistrations:async()=>registrations.filter(r=>r.active.scriptURL.endsWith('/other-sw.js')||oldWorkerPresent)}},
    caches:{keys:async()=>[...liveCacheKeys],
      delete:async key=>{deleted.push(key);liveCacheKeys.delete(key);return true;}},
    location:{origin:'https://command.example',href:'https://command.example/',reload:()=>reloads.push('reload')},
    URL,console,
  };
  context.window={caches:context.caches};
  vm.runInNewContext(guard,context,{timeout:4000});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(removed,['sbc'],'only same-origin SBC /sw.js is removed');
  assert.deepEqual(deleted,['sbc-static-v65-old','sbc-static-v66-current'],
    'only specifically named SBC caches are deleted');
  assert.equal(store.get('sbc-call-draft-v1:123'),'private draft');
  assert.equal(store.get('sbc-client-version'),'66.0.15-persistent-repair');
  assert.equal(reloads.length,0,'no flashing auto-refresh');
  // Simulate an obsolete worker/cache being reintroduced AFTER the first successful repair.
  // A version-marker short-circuit would leave it active indefinitely.
  oldWorkerPresent=true;
  liveCacheKeys.add('sbc-static-v64-resurrected');
  vm.runInNewContext(guard,context,{timeout:4000});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(removed,['sbc','sbc'],'reintroduced SBC worker removed on subsequent normal visit');
  assert.deepEqual(deleted,['sbc-static-v65-old','sbc-static-v66-current','sbc-static-v64-resurrected']);
  assert.equal(store.get('sbc-call-draft-v1:123'),'private draft');
  assert.equal(reloads.length,0,'no auto reload after repeated repair');
  console.log('[SBC V6613 PROFILE STABILITY] PASS: new URLs, coalesced role observer, no auto reload, scoped SW/cache cleanup, preserved draft and role protection');
})().catch(e=>{console.error(e);process.exitCode=1});
