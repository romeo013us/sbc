'use strict';
// Credential-free test of exact compiled V66 Square helpers and read-only safety route.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const compiled=fs.readFileSync(path.join(root,'server.js'),'utf8');
assert.match(compiled,/SBC_V6645_SQUARE_PAYMENT_PROOF_AND_READINESS/);
assert.match(compiled,/requestBody.idempotency_key=SBC_SQUARE_SAFETY.linkIdempotencyKey/);
assert.doesNotMatch(compiled,/const idem=crypto.randomUUID\(\);\s*const requestBody=\{idempotency_key:idem/);
assert.match(compiled,/SQUARE_PAYMENT_LINK_RECONCILIATION_REQUIRED/);
assert.match(compiled,/app.get\('\/api\/payments\/square\/readiness',auth,ownerOnly/);
assert.match(compiled,/SBC_SQUARE_SAFETY.findCapturedTender/);
assert.doesNotMatch(compiled,/const completed=payments.find/);
assert.match(compiled,/paymentAmountCents!==expectedAmountCents/);
new vm.Script(compiled,{filename:'server.js'});
const S=require(path.join(root,'enterprise/v6645-square-checkout-safety.cjs'));
const src={tenantId:7,orderId:'ord-123',environment:'production',locationId:'L123',amountCents:34900};
const k=S.linkIdempotencyKey(src);
assert.equal(k,S.linkIdempotencyKey(src),'same order should re-use Square idempotency');
assert.ok(k.length<=45&&k.startsWith('sbcpl-'));
assert.notEqual(k,S.linkIdempotencyKey({...src,tenantId:8}));
assert.notEqual(k,S.linkIdempotencyKey({...src,orderId:'ord-124'}));
assert.notEqual(k,S.linkIdempotencyKey({...src,amountCents:99900}));
assert.notEqual(k,S.linkIdempotencyKey({...src,environment:'sandbox'}));
assert.throws(()=>S.linkIdempotencyKey({...src,amountCents:0}),/SQUARE_IDEMPOTENCY_INPUT_INVALID/);
const payment={id:'p123',status:'COMPLETED',order_id:'square-order',location_id:'loc1',amount_money:{amount:34900,currency:'USD'}};
const expected={squareOrderId:'square-order',locationId:'loc1',expectedAmountCents:34900};
assert.equal(S.capturedForOrder(payment,expected),true);
for(const invalid of [
 {...payment,status:'APPROVED'}, {...payment,status:'PENDING'}, {...payment,status:'FAILED'},
 {...payment,order_id:'wrong'}, {...payment,location_id:'wrong'},
 {...payment,amount_money:{amount:34899,currency:'USD'}},
 {...payment,amount_money:{amount:34900,currency:'EUR'}},
 {...payment,amount_money:undefined},{...payment,id:''}
])assert.equal(S.capturedForOrder(invalid,expected),false,'unverified Square payment must never mark paid');
(async()=>{
 const order={tenders:[{payment_id:'pending'},{payment_id:'wrong-amount'},{payment_id:'captured'}]};
 const looked=[];
 const out=await S.findCapturedTender(order,async id=>{
   looked.push(id);
   if(id==='pending')return {...payment,id,status:'PENDING'};
   if(id==='wrong-amount')return {...payment,id,amount_money:{amount:1,currency:'USD'}};
   return {...payment,id};
 },expected);
 assert.equal(out.id,'captured');
 assert.deepEqual(looked,['pending','wrong-amount','captured']);
 assert.equal(await S.findCapturedTender({tenders:[{payment_id:'pending'}]},async()=>({...payment,status:'PENDING'}),expected),null);
 let count=0;
 const probe=S.createLocationProbe({fetchImpl:async(url,opts)=>{
   count++;assert.match(url,/connect\.squareup\.com\/v2\/locations\/loc1$/);
   assert.equal(opts.method,'GET');assert.equal(opts.headers.Authorization,'Bearer FAKE_NONPRODUCTION_TOKEN');
   return {ok:true,json:async()=>({location:{id:'loc1',status:'ACTIVE',currency:'USD'}})};
 }});
 const conf={token:'FAKE_NONPRODUCTION_TOKEN',locationId:'loc1',environment:'production',apiVersion:'2026-09-16'};
 const [first,second]=await Promise.all([probe(conf),probe(conf)]);
 assert.equal(first.reachable,true);assert.equal(second.reachable,true);
 assert.equal(count,1,'concurrent diagnostics share a single GET');
 assert.equal((await probe(conf)).cached,true);
 assert.equal(count,1,'readiness refresh cannot hammer Square');
 assert.equal(JSON.stringify(first).includes(conf.token),false,'never expose secrets in diagnostics');
 const unauthorized=S.createLocationProbe({fetchImpl:async()=>({ok:false,status:401})});
 assert.deepEqual(await unauthorized(conf),{reachable:false,code:'HTTP_401',cached:false});
 const unreachable=S.createLocationProbe({fetchImpl:async()=>{throw Error('Bearer SECRET NEVER RETURN')}}) ;
 const safe=await unreachable(conf);
 assert.equal(safe.code,'PROVIDER_UNREACHABLE');
 assert.ok(!JSON.stringify(safe).includes('SECRET'));
 console.log('[SBC V6645] PASS: stable payment idempotency, verified captured+amount+tenant location, safe owner GET and no phantom paid refresh');
})().catch(e=>{console.error('[SBC V6645]',e);process.exitCode=1});
