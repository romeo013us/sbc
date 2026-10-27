'use strict';
// V66.66: reproduce the real compiled public checkout pre-write portion in a sandbox.
// No server boot, external GET, Square links, CRM inserts, or financial writes.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const routeAnchor="app.post('/api/public/checkout',async(req,res)=>{";
const nextAnchor="app.get('/api/sales-orders',auth,v25SalesAccess,";
const at=server.indexOf(routeAnchor),end=at<0?-1:server.indexOf(nextAnchor,at);
assert(at>=0&&end>at,'canonical public checkout route not present');
const route=server.slice(at,end);
const first="if(!name||!email||!phone)return res.status(400)";
const preflightAt=route.indexOf(first);
const insertAt=route.indexOf("    const c=",preflightAt);
assert(preflightAt>=0&&insertAt>preflightAt,'pre-write boundary missing');
const beforeWrite=route.slice(preflightAt,insertAt);
assert(beforeWrite.includes('SBC_V6666_PUBLIC_SQUARE_ZERO_GHOST_PREFLIGHT'),'new guard absent');
for(const word of ['SQUARE_WEBHOOK_NOT_CONFIGURED','SQUARE_PREFLIGHT_UNAVAILABLE','CHECKOUT_WRITER_LOCKED','CHECKOUT_OWNER_PAUSED','SQUARE_NOT_CONFIGURED'])assert(beforeWrite.includes(word),'missing fail-closed condition '+word);
for(const word of ['db.customers','db.orders','saveData(','createSquarePaymentLinkForOrder(','paymentStatus:'])assert(!beforeWrite.includes(word),'unexpected preflight side effect '+word);
assert(route.indexOf('SBC_V6666_PUBLIC_SQUARE_ZERO_GHOST_PREFLIGHT')<route.indexOf('db.customers.unshift('),'must gate before customer insert');
assert(route.indexOf('SBC_V6666_PUBLIC_SQUARE_ZERO_GHOST_PREFLIGHT')<route.indexOf('db.orders.unshift('),'must gate before order insert');

async function check(input){
 const seen={probeCount:0,probeArgs:[],httpStatus:200,response:null};
 const res={status(n){seen.httpStatus=n;return this;},json(j){seen.response=j;return j}};
 const ctx={
  res,name:input.invalid?'':'Test business',email:'test@example.invalid',phone:'+13055550101',
  SBC_RUNTIME_READ_ONLY:Boolean(input.readOnly),
  MYSQL_RECOVERY_EVALUATED:true,MYSQL_RECOVERY_REQUIRED:false,sbcWriterLeaseReady:true,
  RUNTIME_GATE:{blocked:()=>Boolean(input.paused)},
  squareConfigured:()=>input.configured!==false,
  squareWebhookConfigured:()=>input.webhook!==false,
  squareEnvironment:()=>'sandbox',
  process:{env:{SQUARE_ACCESS_TOKEN:'SECRET_THAT_MUST_NEVER_APPEAR',SQUARE_LOCATION_ID:'L_FAKE'}},
  SQUARE_API_VERSION:'2026-09-16',
  SBC_SQUARE_LOCATION_PROBE:async opts=>{
   seen.probeCount++;seen.probeArgs.push({locationId:opts.locationId,environment:opts.environment});
   if(input.throwProbe)throw Error('SECRET_THAT_MUST_NEVER_APPEAR');
   return {reachable:input.reachable!==false,code:input.reachable===false?'LOCATION_INACTIVE':'LOCATION_ACTIVE'};
  }
 };
 const script=new vm.Script('(async function(){'+beforeWrite+'return {allowed:true}})()',{filename:'compiled-public-preflight.js'});
 const response=await script.runInNewContext(ctx,{timeout:1000});
 if(seen.response!==null){
  if(seen.httpStatus===400)assert.match(seen.response.error,/required/);
  else {
   assert.equal(seen.response.ok,false);
   assert.match(seen.response.error,/No customer or order was created/);
  }
  assert(!JSON.stringify(seen.response).includes('SECRET_THAT_MUST_NEVER_APPEAR'));
 }else assert.equal(response.allowed,true);
 return {...seen,response};
}
(async()=>{
 const scenarios=[
  [{invalid:true},400,''],
  [{readOnly:true},423,'CHECKOUT_WRITER_LOCKED'],
  [{paused:true},423,'CHECKOUT_OWNER_PAUSED'],
  [{configured:false},503,'SQUARE_NOT_CONFIGURED'],
  [{webhook:false},503,'SQUARE_WEBHOOK_NOT_CONFIGURED'],
  [{reachable:false},503,'SQUARE_PREFLIGHT_UNAVAILABLE'],
  [{throwProbe:true},503,'SQUARE_PREFLIGHT_UNAVAILABLE'],
  [{},200,'']
 ];
 for(const [input,status,code] of scenarios){
  const r=await check(input);
  assert.equal(r.httpStatus,status,JSON.stringify(input));
  if(status!==200){if(code)assert.equal(r.response.code,code);assert.equal(r.probeCount,input.reachable===false||input.throwProbe?1:0);}
  else {assert.equal(r.response.allowed,true);assert.equal(r.probeCount,1);assert.equal(r.probeArgs[0].environment,'sandbox');}
 }
 assert(server.includes('SBC_V6645_SQUARE_PAYMENT_PROOF_AND_READINESS'),'read-only Square location probe must be installed');
 assert(server.includes('SQUARE_PAYMENT_LINK_RECONCILIATION_REQUIRED'),'uncertain payment links still reconciliation-locked');
 assert(server.includes('MYSQL_RECOVERY_REQUIRED')&&server.includes('SBC_RUNTIME_WRITER_LEASE_REQUIRED'),'do not bypass recovery/writer');
 console.log('[SBC V66.66] PASS compiled public checkout gate: 8 scenarios, no ghost rows when provider/webhook unavailable, zero charges');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
