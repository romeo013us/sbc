'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {apply,MARKER}=require('../hotfix-assets/apply-v6637-network-only-no-offline-mutation-replay.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6637-'));
const sw=[
"const CACHE='sbc-static-v66-36-canonical-shell';",
"self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE).map(k=>caches.delete(k)))))});",
"self.addEventListener('fetch',e=>{",
"  const r=e.request;",
"  const networkOnly = r.method!=='GET';",
"  if(networkOnly){ e.respondWith(fetch(r)); return; }",
"  e.respondWith(fetch(r).then(x=>x).catch(()=>caches.match(r)));",
"});",
"self.addEventListener('sync',e=>{if(e.tag==='sbc-offline-sync')e.waitUntil((async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('sbc-offline-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});const rows=await db.transaction('mutations','readonly').objectStore('mutations').getAll();for(const x of rows){const r=await fetch(x.url,{method:x.method,body:x.body,credentials:'include'});if(r.ok)db.transaction('mutations','readwrite').objectStore('mutations').delete(x.id)}})());});",
].join('\n');
const mega=[
"window.SBCOfflineSync=(function(){const DB='sbc-offline-v1',STORE='mutations';let ready;",
"async function open(){return ready;}",
"async function queue(url,opts){const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).add({url});navigator.serviceWorker?.ready.then(r=>r.sync?.register('sbc-offline-sync'));}",
"async function flush(){return fetch(x.url,{});}",
"window.addEventListener('online',()=>flush().catch(()=>{}));return {queue,flush};})();"
].join('\n');
async function run(){
 try{
  for(const dir of ['public','browser_public']){
   fs.mkdirSync(path.join(root,dir),{recursive:true});fs.writeFileSync(path.join(root,dir,'sw.js'),sw);
   fs.writeFileSync(path.join(root,dir,'mega.js'),mega);
  }
  const res=apply(root);assert.equal(res.automaticMutationReplayDisabled,true);
  const listeners={};const sent=[];
  const ctx={Promise,self:{addEventListener:(type,fn)=>listeners[type]=fn},fetch:request=>{sent.push(request);return Promise.resolve({ok:true})}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'public/sw.js'),'utf8'),ctx);
  assert.equal(typeof listeners.fetch,'function');
  assert.equal(typeof listeners.sync,'function');
  const req={method:'POST',url:'/api/crm/leads/import'};
  let response;listeners.fetch({request:req,respondWith:p=>response=p});
  await response;assert.equal(sent.length,1);assert.equal(sent[0],req);
  let syncDone;listeners.sync({tag:'sbc-offline-sync',waitUntil:p=>syncDone=p});await syncDone;
  assert.equal(sent.length,1,'queued mutations must never replay');
  const window={};vm.runInNewContext(fs.readFileSync(path.join(root,'public/mega.js'),'utf8'),{window,Promise,Error});
  await assert.rejects(window.SBCOfflineSync.queue('/api/public/checkout',{method:'POST'}),/OFFLINE_WRITES_DISABLED/);
  assert.equal((await window.SBCOfflineSync.flush()).flushed,0);
  assert.throws(()=>apply(root),/duplicate/);
  console.log(MARKER,'network-only fetch and no offline mutation replay PASS');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
run().catch(e=>{console.error(e);process.exitCode=1});