'use strict';
// SBC V6614 Quick Checkout acceptance: mocked owner UI, no network, database or provider calls.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const code=read('public/sbc-quick-checkout-v6614.js'),app=read('public/app.js'),html=read('public/index.html');
new vm.Script(code,{filename:'sbc-quick-checkout-v6614.js'});
assert.equal(code,read('browser_public/sbc-quick-checkout-v6614.js'),'Mirrored checkout script required');
assert.equal(app,read('browser_public/app.js'),'Mirrored app required');
assert.equal(html,read('browser_public/index.html'),'Mirrored HTML required');
assert.equal(html.split('/sbc-quick-checkout-v6614.js?v=66.0.14-sales-checkout').length-1,1);
assert.match(app,/sbcOpenQuickCheckout/);
assert.match(app,/sbcOpenOwnerDollarQA/);
assert.match(app,/SBC_LAUNCH_QA_1USD|Owner-only \$1 Square Test/);
assert.ok(app.indexOf('Owner-only $1 Square Test')>app.indexOf('function payments()'),
  'Owner QA entry belongs in Payments Center');
assert.ok(!code.includes("window.location.reload"),'No new flashing/reload mechanism');
assert.ok(!code.includes("localStorage.clear"),'Do not clear browser data');
assert.ok(!code.includes("fetch("),'Use existing authenticated SBC API exclusively');
assert.match(code,/\/api\/owner\/launch-qa\/create-order/);
assert.match(code,/\/api\/payments\/square\/create-link\//);
assert.match(code,/\/api\/payments\/square\/order\//);
function setup(role='owner',existing=false){
 const events={},calls=[],alerts=[],elems={};
 function el(id){
  if(!elems[id])elems[id]={id,hidden:false,disabled:false,value:'',textContent:'',
    addEventListener(type,fn){events[id+':'+type]=fn},
    replaceChildren(node){this.child=node},
    querySelector(){return null}};
  return elems[id];
 }
 el('sbc-v6614-email').value='owner@example.com';
 const state={me:{role},data:{customers:[],recovery:{}},catalog:{packages:[],services:[]}};
 const win={
  state,toast(msg){alerts.push(msg)},confirm:()=>true,
  openModal(){},closeModal(){},
  api:async(url,opt)=>{calls.push({url,opt});if(url.endsWith('launch-qa/create-order'))return {ok:true,existing,amountCents:100,orderId:'qa-order-1',paymentStatus:'Pending'};
   if(url.includes('create-link/'))return {paymentUrl:'https://square.link/u/test-only'};
   if(url.includes('/api/payments/square/order/'))return {order:{paymentStatus:'Paid',fulfillmentStatus:'QA VERIFIED - NO FULFILLMENT'}};
   throw Error('Unknown endpoint: '+url); }
 };
 const document={getElementById:el,createElement:()=>({})};
 vm.runInNewContext(code,{window:win,document,state,URL,Event:function(){},console,encodeURIComponent,Number,String,JSON,Array},{timeout:2000});
 const invoke=async(id,type='click')=>{assert.equal(typeof events[id+':'+type],'function','handler '+id);await events[id+':'+type]({preventDefault(){},target:el(id)});};
 return {win,elems,calls,alerts,invoke};
}
(async()=>{
 const demo=setup('demo');demo.win.sbcOpenOwnerDollarQA();assert.equal(demo.calls.length,0);assert.equal(demo.alerts.length,1);
 const owner=setup();
 owner.win.sbcOpenOwnerDollarQA();
 assert.equal(owner.calls.length,0,'Opening modal must not create an order or charge');
 await owner.invoke('sbc-v6614-qa-form','submit');
 assert.equal(owner.calls.length,1,'Owner explicitly creates one QA order');
 assert.equal(owner.calls[0].url,'/api/owner/launch-qa/create-order');
 assert.equal(owner.elems['sbc-v6614-qa-steps'].hidden,false);
 await owner.invoke('sbc-v6614-qa-form','submit');
 assert.equal(owner.calls.length,1,'Repeat submit must reuse order, not create another');
 await owner.invoke('sbc-v6614-link-btn');
 assert.equal(owner.calls.length,2,'Separate deliberate link action');
 assert.equal(owner.calls[1].url,'/api/payments/square/create-link/qa-order-1');
 assert.equal(owner.elems['sbc-v6614-payment-link'].child.href,'https://square.link/u/test-only');
 await owner.invoke('sbc-v6614-link-btn');
 assert.equal(owner.calls.length,2,'Second link click may not create a second link');
 await owner.invoke('sbc-v6614-status-btn');
 assert.equal(owner.calls[2].opt.method,'GET','Read-only status check');
 assert.match(owner.elems['sbc-v6614-payment-status'].textContent,/QA VERIFIED - NO FULFILLMENT/);
 assert.equal(owner.calls.length,3,'No surprise provider call');
 const reused=setup('owner',true);
 reused.win.sbcOpenOwnerDollarQA();
 await reused.invoke('sbc-v6614-qa-form','submit');
 assert.equal(reused.elems['sbc-v6614-link-btn'].disabled,true,'Reused order may not issue a second link');
 await reused.invoke('sbc-v6614-link-btn');
 assert.equal(reused.calls.length,1,'No second payment link request for reused order');
 console.log('[SBC V6614 QUICK CHECKOUT] PASS: owner-gated $1 UI, explicit link, one request, read-only Paid check, mirrored UI');
})().catch(e=>{console.error(e);process.exitCode=1});
