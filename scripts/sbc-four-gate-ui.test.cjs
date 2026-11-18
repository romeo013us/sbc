'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const file=path.resolve(__dirname,'../public/sbc-launch-readiness-v6621.js');
const code=fs.readFileSync(file,'utf8');
const window={state:{me:{role:'owner'}},api:async()=>({}),openModal:()=>{}};
const document={getElementById:()=>null};
vm.runInNewContext(code,{window,document},{filename:file});
const verdict=window.sbcFourGateVerdicts;

test('Launch Check presents four strict live customer journey gates',()=>{
 assert(verdict);
 for(const title of ['1 · Inquiry persistence','2 · Customer tenant isolation','3 · Square real payment','4 · Office Box activation'])assert(code.includes(title),title);
 assert(code.includes('/api/owner/officebox/federation-preflight'));
 assert(code.includes('/api/portal/admin-summary'));
 assert(code.includes('/api/payments/square/readiness'));
 assert.equal(code,fs.readFileSync(path.resolve(__dirname,'../browser_public/sbc-launch-readiness-v6621.js'),'utf8'));
});
test('Only exact authenticated read-only signed Office Box proof verifies transport, not activation',()=>{
 const proof={ok:true,authenticated:true,readOnly:true,chargeAmount:0,providerRequests:0,
  activationCreated:false,tenantCreated:false,entitlementChanged:false,ack:'ACTIVATION_NOT_FOUND'};
 assert.equal(verdict.federation(proof).transportVerified,true);
 assert.equal(verdict.federation(proof).activationCertified,false);
 for(const patch of [{ok:false},{authenticated:false},{readOnly:false},{chargeAmount:1},{providerRequests:1},{activationCreated:true},{tenantCreated:true},{entitlementChanged:true},{ack:'OK'},{ack:'ACTIVATED'}])
  assert.equal(verdict.federation({...proof,...patch}).transportVerified,false,JSON.stringify(patch));
 assert.equal(verdict.federation(null).transportVerified,false);
});
test('Portal count and Square configuration never count as real tenant isolation or payment proof',()=>{
 for(const d of [{accounts:[{id:'A'},{id:'B'}]},{ok:true,accounts:[{id:'A'},{id:'B'}]}]){
  assert.equal(verdict.portal(d).tenantIsolationCertified,false);
  assert.equal(verdict.portal(d).loginCertified,false);
 }
 const d={ok:true,preflightReady:true,environment:'production',triage:{blockers:[]}};
 assert.equal(verdict.square(d).providerPaymentCertified,false);
 assert.equal(verdict.square(d).duplicatePaymentCertified,false);
});
test('All gates default to unverified',()=>{
 for(const [name,v] of Object.entries(verdict.initial()))assert.equal(v.certified,false,name);
});
test('Owner-triggered check calls read-only existing APIs and cannot falsely certify payment or activation',async()=>{
 const elements={},calls=[];
 const dom={getElementById(id){return elements[id]||(elements[id]={id,textContent:'',disabled:false,addEventListener(event,fn){this[event]=fn;}})}};
 const proof={ok:true,authenticated:true,readOnly:true,chargeAmount:0,providerRequests:0,activationCreated:false,tenantCreated:false,entitlementChanged:false,ack:'ACTIVATION_NOT_FOUND'};
 const w={state:{me:{role:'owner'}},openModal:()=>{},api:async(route,opts)=>{
  calls.push({route,opts});
  if(route.includes('federation-preflight'))return proof;
  if(route==='/api/portal/admin-summary')return {accounts:[{id:'account_a'},{id:'account_b'}]};
  if(route==='/api/payments/square/readiness')return {ok:true,preflightReady:true};
  return {ok:true};
 }};
 vm.runInNewContext(code,{window:w,document:dom},{filename:file});
 await w.sbcOpenLaunchReadiness();
 assert.equal(typeof elements['sbc-four-readonly-check'].click,'function');
 await elements['sbc-four-readonly-check'].click();
 assert.deepEqual(calls.slice(-3).map(x=>x.route),['/api/portal/admin-summary','/api/payments/square/readiness','/api/owner/officebox/federation-preflight']);
 assert(calls.every(x=>x.opts.method==='GET'));
 assert.match(elements['sbc-four-activation'].textContent,/SIGNED TRANSPORT VERIFIED/);
 for(const id of ['sbc-four-inquiry','sbc-four-portal','sbc-four-square','sbc-four-activation'])
  assert.match(elements[id].textContent,/NOT CERTIFIED/,id);
 const n=calls.length;w.state.me.role='demo';await elements['sbc-four-readonly-check'].click();
 assert.equal(calls.length,n);
});
