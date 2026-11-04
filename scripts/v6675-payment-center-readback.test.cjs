'use strict';
// V66.75: static contracts. No customer data, Square calls, payment or fulfillment.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('public/app.js'),html=read('public/index.html'),server=read('server.js'),script=read('public/sbc-v6675-payment-readback.js');
assert.equal(app,read('browser_public/app.js'));
assert.equal(html,read('browser_public/index.html'));
assert.equal(script,read('browser_public/sbc-v6675-payment-readback.js'));
new vm.Script(script);
assert.match(html,/sbc-v6675-payment-readback\.js/);
assert.match(app,/sbcOpenSquareQaReadback\(\)/);
assert.match(app,/if\(!checkoutLinks\.essentials\)checkoutLinks\.essentials='https:\/\/square\.link\/u\/c8wuNr1c'/);
assert.doesNotMatch(script,/method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
assert.doesNotMatch(script,/\/api\/payments\/square\/create-link|launch-qa\/create-order|localStorage\.clear|window\.location\.reload/);
assert.match(script,/\/api\/payments\/square\/order\//);
assert.match(script,/\/api\/owner\/launch-qa\/reconcile\//);
const isApplied=server.includes('/* SBC_V6675_SQUARE_699_OWNER_LINK */');
assert.match(server,/const PAYMENT_LINKS = \{/);
if(isApplied){
 assert.match(server,/essentials: 'https:\/\/square\.link\/u\/c8wuNr1c'/);
 assert.match(server,/officeBoxEntitlement:'included-foundation', paymentUrl:PAYMENT_LINKS\.essentials/);
}else assert.match(server,/basic: 'https:\/\/square\.link\/u\/uf53mzCR', essentials: ''/);
const check=cp.spawnSync(process.execPath,[path.join(root,'scripts/v6675-square-catalog-stage.cjs')],{encoding:'utf8'});
assert.equal(check.status,0,check.stderr);
function mock({role='owner',payment='Pending',qa='MATCHED',missing=false,fail=false}={}){
 const els={},events={},calls=[],alerts=[],modals=[];
 const el=id=>els[id]||(els[id]={value:'',textContent:'',disabled:false,addEventListener:(name,cb)=>events[id+':'+name]=cb});
 const win={state:{me:{role}},toast:x=>alerts.push(x),openModal:x=>modals.push(x),api:async(url,opt)=>{
  calls.push({url,opt});if(fail)throw Error('offline');
  if(url.startsWith('/api/payments/square/order/'))return missing?{ok:false}:{ok:true,order:{id:'ord_test12345',paymentStatus:payment,fulfillmentStatus:'QA - NO VENDOR FULFILLMENT',squareStatus:'PENDING'}};
  if(url.startsWith('/api/owner/launch-qa/reconcile/'))return {ok:true,status:qa,canCreate:true};
  throw Error('unexpected endpoint');
 }};
 vm.runInNewContext(script,{window:win,document:{getElementById:el},encodeURIComponent},{timeout:2000});
 el('sbc-v6675-qa-order').value='ord_test12345';
 return {win,el,calls,modals,alerts,async submit(){const fn=events['sbc-v6675-qa-form:submit'];assert.ok(fn);await fn({preventDefault(){}})}};
}
(async()=>{
 const other=mock({role:'sales'});other.win.sbcOpenSquareQaReadback();assert.equal(other.modals.length,0);assert.equal(other.calls.length,0);
 const paid=mock({payment:'Paid'});paid.win.sbcOpenSquareQaReadback();assert.equal(paid.calls.length,0);await paid.submit();assert.equal(paid.calls.length,1);assert.match(paid.el('sbc-v6675-qa-feedback').textContent,/Do not charge again/);
 const pending=mock();pending.win.sbcOpenSquareQaReadback();await pending.submit();assert.equal(pending.calls.length,2);assert.match(pending.el('sbc-v6675-qa-feedback').textContent,/Do not pay twice/);
 const missing=mock({missing:true});missing.win.sbcOpenSquareQaReadback();await missing.submit();assert.equal(missing.calls.length,1);assert.match(missing.el('sbc-v6675-qa-feedback').textContent,/STOP/);
 const failure=mock({fail:true});failure.win.sbcOpenSquareQaReadback();await failure.submit();assert.match(failure.el('sbc-v6675-qa-feedback').textContent,/STOP/);
 const bad=mock();bad.win.sbcOpenSquareQaReadback();bad.el('sbc-v6675-qa-order').value='oops';await bad.submit();assert.equal(bad.calls.length,0);
 for(const fixture of [paid,pending,missing])for(const call of fixture.calls)assert.equal(call.opt.method,'GET');
 console.log('[SBC V6675] PASS $699 owner URL, owner-only QA, GET-only evidence, no accidental charge');
})().catch(e=>{console.error(e);process.exitCode=1});