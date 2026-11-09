'use strict';
// Executes a genuine V2 HMAC request and checks Office Box's exact
// post-authenticated read-only 404 contract with an isolated fake transport.
// No Stripe/Square/GoDaddy I/O, customer mutation, AI credits or payment.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const fs=require('node:fs'),path=require('node:path');
const {probe}=require('../enterprise/v66127-officebox-federation-probe.cjs');
const stage=require('./v66127-stage-signed-federation-probe.cjs');
const secret=['sbc','signed','federation','ci','secret','strong','2026'].join('-'); // generated synthetic fixture, not a credential
const origin='https://officebox-ci.example.test';
const nonce='a'.repeat(24),at=1794000000000;
let attempts=0;
async function goodTransport(url,request){
 attempts++;
 assert.equal(url,origin+'/api/sbc/activation-status');
 assert.equal(request.method,'POST');
 assert.equal(request.redirect,'error');
 assert.equal(request.cache,'no-store');
 const body=JSON.parse(request.body);
 assert.equal(body.schema,'sbc.office-box.activation-lookup.v1');
 assert.equal(body.correlationId,'sbc_probe_'+nonce);
 assert.equal(body.customerId,'sbc_probe_customer_'+nonce);
 assert.equal(body.orderId,'sbc_probe_order_'+nonce);
 assert.equal(body.plan,'business');
 assert.equal(request.headers['x-sbc-timestamp'],'1794000000');
 const expected='sha256='+crypto.createHmac('sha256',secret)
   .update(request.headers['x-sbc-timestamp']+'.').update(request.body).digest('hex');
 assert.equal(request.headers['x-sbc-signature-v2'],expected,'must sign exact raw bytes');
 return {status:404,json:async()=>({ok:false,error:'ACTIVATION_NOT_FOUND'})};
}
(async()=>{
 const success=await probe({origin,secret,nonce,at,transport:goodTransport});
 assert.equal(success.authenticated,true);
 assert.equal(success.chargeAmount,0);
 assert.equal(success.activationCreated,false);
 assert.equal(success.entitlementChanged,false);
 assert.equal(attempts,1);
 for(const [response,expected] of [
  [{status:401,json:async()=>({ok:false,error:'Invalid timestamp-bound SBC signature'})},'OFFICEBOX_PROBE_SIGNATURE_REJECTED'],
  [{status:404,json:async()=>({ok:false,error:'Not Found'})},'OFFICEBOX_PROBE_SIGNED_ACK_UNVERIFIED'],
  [{status:200,json:async()=>({ok:true,data:{status:'ACTIVATED'}})},'OFFICEBOX_PROBE_SIGNED_ACK_UNVERIFIED']
 ]){
  await assert.rejects(probe({origin,secret,nonce,at,transport:async()=>response}),
   e=>e.code===expected,expected);
 }
 await assert.rejects(probe({origin:'http://localhost:80',secret,nonce,at,transport:goodTransport}),
  /OFFICEBOX_HTTPS_ORIGIN_REQUIRED/);
 await assert.rejects(probe({origin,secret:'too-short',nonce,at,transport:goodTransport}),
  /OFFICEBOX_PROBE_SIGNING_NOT_CONFIGURED/);
 await assert.rejects(probe({origin,secret,nonce,at,transport:async()=>{throw Error('network fail')}}),
  /OFFICEBOX_PROBE_TRANSPORT_FAILED/);
 const src=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8');
 const patched=stage.patchServer(src);
 assert.equal(stage.patchServer(patched),patched);
 assert(patched.includes(stage.MARK));
 const begin=patched.indexOf("app.get('/api/owner/officebox/federation-preflight'");
 const end=patched.indexOf(" // SBC_V66112_OFFICEBOX_COMMITTED_OWNER_RECONCILIATION",begin);
 assert(begin>0&&end>begin);
 const route=patched.slice(begin,end);
 assert(route.includes('auth,ownerOnly'),'must require logged-in owner');
 assert(route.includes('readOnly:true')&&route.includes('chargeAmount:0'));
 assert(!/saveData\(|createSquare|charge\(|INSERT INTO|UPDATE .*SET|paid=true/i.test(route),
  'owner probe must not mutate ledger or initiate payments');
 if(process.argv.includes('--staged'))assert.equal(src,patched);
 console.log('[SBC V66.127] PASS signed read-only Office Box probe: 0 charges, HMAC, exact ACK, no mutations, auth gated');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
