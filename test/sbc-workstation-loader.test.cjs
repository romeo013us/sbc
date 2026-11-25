'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createLoader}=require('../public/sbc-workstation-loader-v1.js');
const manifest=Object.freeze({marketing:Object.freeze(['/market.js?v=1','/hub.js?v=1'])});
test('workstations load only after explicit activation, serially and once',async()=>{
 const requested=[],pending=[];
 const loader=createLoader(manifest,url=>new Promise((resolve,reject)=>{requested.push(url);pending.push({resolve,reject})}));
 assert.deepEqual(requested,[]);
 const a=loader('marketing'),b=loader('marketing');
 assert.equal(a,b);await Promise.resolve();assert.deepEqual(requested,['/market.js?v=1']);
 pending[0].resolve();await new Promise(r=>setImmediate(r));assert.deepEqual(requested,['/market.js?v=1','/hub.js?v=1']);
 pending[1].resolve();await Promise.all([a,b]);await loader('marketing');assert.equal(requested.length,2);
});
test('unknown keys and off-origin assets fail closed; retry resumes failed dependency',async()=>{
 const requested=[];let fail=true;
 const loader=createLoader(manifest,async url=>{requested.push(url);if(url.includes('hub')&&fail)throw Error('offline')});
 await assert.rejects(loader('__proto__'),/WORKSTATION_UNKNOWN/);
 await assert.rejects(loader('marketing'),/offline/);fail=false;await loader('marketing');
 assert.deepEqual(requested,['/market.js?v=1','/hub.js?v=1','/hub.js?v=1']);
 for(const url of ['https://example.invalid/a.js','//evil.invalid/a.js','/../x.js','/x.js?redirect=https://other.invalid','/x.js#x'])assert.throws(()=>createLoader({bad:[url]},async()=>{}),/WORKSTATION_ASSET_INVALID/);
});

test('both HTML mirrors load only the lightweight bootstrap at startup',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const root=path.resolve(__dirname,'..');
 for(const dir of ['public','browser_public']){
  const html=fs.readFileSync(path.join(root,dir,'index.html'),'utf8');
  const tags=[...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)].map(m=>m[1]);
  assert.equal(tags.filter(t=>t.startsWith('/sbc-workstation-loader-v1.js?')).length,1);
  assert.ok(!tags.some(t=>/\/sbc-(?:market-intelligence|v6567-marketing-hub)\.js/.test(t)));
  assert.equal(tags.length,83);
 }
});
