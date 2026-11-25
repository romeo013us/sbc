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

test('browser bootstrap shows navigation without loading marketing, then opens after explicit activation',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const buttons=new Map(),assets=[],listeners={};let opens=0;
 const root={state:{me:{id:'owner',role:'owner'}},location:{hash:''},addEventListener:(name,fn)=>listeners[name]=fn};
 const nav={appendChild(b){buttons.set(b.id,b)}};
 const doc={readyState:'complete',getElementById:id=>buttons.get(id),querySelector:()=>nav,
  createElement:tag=>({tag,addEventListener(name,fn){this[name]=fn},setAttribute(){},removeAttribute(){},focus(){},remove(){}}),
  head:{appendChild(tag){assets.push(tag.src);if(tag.src.includes('marketing-hub'))root.SBCMarketingHub={open:()=>opens++};queueMicrotask(()=>tag.onload())}}
 };
 const timers=new Map();let seq=0;
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../public/sbc-workstation-loader-v1.js'),'utf8'),{window:root,document:doc,setInterval:fn=>{timers.set(++seq,fn);return seq},clearInterval:id=>timers.delete(id)});
 assert.deepEqual(assets,[]);assert.equal(opens,0);
 const button=buttons.get('sbcMarketingHubNav');assert.ok(button);
 root.state.me=null;button.click();await new Promise(r=>setImmediate(r));assert.deepEqual(assets,[]);
 root.state.me={id:'owner',role:'owner'};button.click();await new Promise(r=>setImmediate(r));
 assert.equal(opens,1);assert.equal(assets.length,2);assert.match(assets[0],/market-intelligence/);assert.match(assets[1],/marketing-hub/);
 button.click();await new Promise(r=>setImmediate(r));assert.equal(opens,2);assert.equal(assets.length,2);
 root.location.hash='#marketing-hub';listeners.hashchange();await new Promise(r=>setImmediate(r));assert.equal(opens,3);assert.equal(assets.length,2);
});
