'use strict';
// Regression against the actual built browser scripts; no network or production writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.SBC_RUNTIME_ROOT;
if(!root)throw Error('SBC_RUNTIME_ROOT must point to disposable compiled runtime');
const filename='sbc-critical-surfaces-guardian-v56-25-3.js';
const source=fs.readFileSync(path.join(root,'public',filename),'utf8');
assert.equal(source,fs.readFileSync(path.join(root,'browser_public',filename),'utf8'),'browser mirrors must match');
assert(source.includes('renderEpoch===sbcCriticalNavigationEpoch'));
assert(source.includes("renderHost.querySelector('#sbcProductionCriticalSurface')"));
new vm.Script(source,{filename});
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve}}
function fixture(jobs){
 let next=0,refreshes=0;
 const root={innerHTML:'<h1>Dashboard</h1>',querySelector(k){
  return k==='#sbcProductionCriticalSurface'&&this.innerHTML.includes('id="sbcProductionCriticalSurface"')?{}:null;
 }};
 const window={state:{view:'dashboard'},addEventListener(){},sbcNavigate(v){
  window.state.view=v;root.innerHTML='<h1>DASHBOARD REMAINS</h1>';
 },fantastic4LaunchView(){return jobs[next++].promise},f4RevenueRefresh(){refreshes++}};
 const document={readyState:'loading',getElementById:k=>k==='content'?root:null,
  querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){}};
 class MutationObserver{observe(){}}
 vm.runInNewContext(source,{window,document,MutationObserver,console,setTimeout(){},setInterval(){}},{timeout:2000});
 return {window,root,refreshes:()=>refreshes};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 for(let pass=1;pass<=3;pass++){
  // A delayed old page cannot overwrite the new dashboard or refresh stale data.
  const a=[deferred()],x=fixture(a);
  x.window.sbcNavigate('fantastic4');x.window.sbcNavigate('dashboard');
  a[0].resolve('<section class="f4-production-control">STALE</section>');await tick();
  assert.equal(x.root.innerHTML,'<h1>DASHBOARD REMAINS</h1>');assert.equal(x.refreshes(),0);
  // Legitimate render remains functional for the current owner view.
  const b=[deferred()],y=fixture(b);y.window.sbcNavigate('fantastic4');
  b[0].resolve('<section class="f4-production-control">CURRENT</section>');await tick();
  assert.match(y.root.innerHTML,/CURRENT/);assert.equal(y.refreshes(),1);
  // Two overlapping visits must honor the latest visit, even when the first finishes last.
  const c=[deferred(),deferred()],z=fixture(c);
  z.window.sbcNavigate('fantastic4');z.window.sbcNavigate('production-control');
  c[1].resolve('<section class="f4-production-control">SECOND</section>');await tick();
  c[0].resolve('<section class="f4-production-control">FIRST</section>');await tick();
  assert.match(z.root.innerHTML,/SECOND/);assert.doesNotMatch(z.root.innerHTML,/FIRST/);
  assert.equal(z.refreshes(),1);
  // A newer renderer can replace the placeholder without being overwritten.
  const d=[deferred()],q=fixture(d);q.window.sbcNavigate('fantastic4');
  q.root.innerHTML='<section class="f4-production-control">RENDERER WON</section>';
  d[0].resolve('<section class="f4-production-control">OUTDATED</section>');await tick();
  assert.match(q.root.innerHTML,/RENDERER WON/);
  console.log('[V6669] PASS pass '+pass+' / 3 — stale navigation, current view, overlapping renders and placeholder ownership');
 }
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});