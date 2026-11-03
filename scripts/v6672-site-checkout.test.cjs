'use strict';
/* SBC V66.72 — synthetic signed public website checkout regression, no live money. */
const assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const bridge=require('../enterprise/v6660-website-bridge.cjs');
const safety=require('../enterprise/v6672-site-checkout-integrity.cjs');
const stage=require('./v6672-site-checkout-stage.cjs');
const raw=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const compiled=stage.patchServer(raw).source;
assert.equal(stage.patchServer(compiled).source,compiled,'stage is idempotent');
assert.ok(compiled.includes(stage.MARK));
const key='sbc-website-hmac-synthetic-key-at-least-32-characters-00001';
let seq=0,write=0,links=0,activity=0,holdProbe=false,releaseProbe,failLink=false;
const db={customers:[],orders:[]},registered={};
const ctx={
 require:p=>{assert.equal(p,'./enterprise/v6672-site-checkout-integrity.cjs');return safety},
 app:{post:(url,...handlers)=>{registered[url]=handlers.at(-1)}},
 SBC_V6672_SITE_CHECKOUT:safety,SBC_V6672_CHECKOUT_INFLIGHT:new Set(),
 PUBLIC_CHECKOUT_RATE:new Map(),
 sbcVerifiedWebsiteTenant:req=>{
   const v=bridge.verify(req,{key});
   if(!v.ok)throw Object.assign(new Error(v.code),{code:v.code,status:403});
   return 1;
 },
 requireMappedRequestTenant:req=>{if(req.headers?.host!=='cc.example.test')throw Error('unmapped');return 1},
 CATALOG:{packages:[{id:'starter',name:'SBC Business Starter',price:199,category:'Package'}, {id:'quickstart',name:'Business Visibility',price:99,category:'Package'}]},
 normalizeBuyerPhone:v=>String(v||'').replace(/\D/g,'').length===10?'+1'+String(v).replace(/\D/g,''):'',
 SBC_RUNTIME_READ_ONLY:false,MYSQL_RECOVERY_EVALUATED:true,MYSQL_RECOVERY_REQUIRED:false,sbcWriterLeaseReady:true,
 RUNTIME_GATE:{blocked:()=>false},squareConfigured:()=>true,squareWebhookConfigured:()=>true,
 SBC_SQUARE_LOCATION_PROBE:async()=>{
   if(holdProbe)await new Promise(r=>{releaseProbe=r});
   return {reachable:true}
 },
 db,now:()=>new Date().toISOString(),id:p=>p+'_'+(++seq),
 addActivity:()=>{activity++},saveData:async()=>{write++},
 createSquarePaymentLinkForOrder:async o=>{
   links++;
   if(failLink)throw Error('SYNTHETIC_SQUARE_PROVIDER_TIMEOUT');
   const url='https://square.link/u/synthetic';
   o.paymentUrl=url;
   o.notes=JSON.stringify({...JSON.parse(o.notes),squareOrderId:'sq_order_'+links,squarePaymentLinkUrl:url});
   return {url,paymentLinkId:'link_'+links,squareOrderId:'sq_order_'+links,longUrl:''};
 },
 updateOrderParsed:(o,p)=>{o.notes=JSON.stringify({...JSON.parse(o.notes),...p})},
 Math,Number,String,Boolean,Set,Map,Date,JSON,console
};
const start=compiled.indexOf("/* "+stage.MARK+" */");
const end=compiled.indexOf("\napp.get('/api/sales-orders'",start);
assert.ok(start>=0&&end>start);
vm.runInNewContext(compiled.slice(start,end),ctx,{timeout:3000});
const route=registered['/api/public/checkout'];
assert.equal(typeof route,'function');
const base={clientRequestId:'sbcweb_'+'a'.repeat(32),packageId:'starter',customerName:'Synthetic Store',contactName:'Test Owner',customerEmail:'owner@example.test',customerPhone:'3055550000'};
function req(body,{signed=true,badSignature=false}={}){
 const payload=JSON.stringify(body),now=String(Math.floor(Date.now()/1000)),nonce=crypto.randomBytes(16).toString('hex');
 const h={host:'cc.example.test'};
 if(signed){
  h['x-sbc-website-host']='sbcmia.com';
  h['x-sbc-website-timestamp']=now;h['x-sbc-website-nonce']=nonce;
  h['x-sbc-website-signature']=badSignature?'a'.repeat(64):bridge.signature({key,host:'sbcmia.com',method:'POST',path:'/api/public/checkout',at:now,nonce,body:payload});
 }
 return {body,headers:h,method:'POST',path:'/api/public/checkout',rawBody:Buffer.from(payload),socket:{remoteAddress:'127.0.0.1'}};
}
function res(){return {code:200,jsonBody:null,status(n){this.code=n;return this},json(o){this.jsonBody=o;return this}}}
async function post(body,opts){const r=res();await route(req(body,opts),r);return r}
(async()=>{
 assert.equal(safety.requestIdValid(base.clientRequestId),true);
 assert.equal(safety.requestIdValid('falsereq'),false);
 const denied=await post(base,{badSignature:true});
 assert.equal(denied.code,403);assert.equal(db.orders.length,0);
 const bad=await post({...base,clientRequestId:'bad'});
 assert.equal(bad.code,422);
 const missingPhone=await post({...base,customerPhone:''});
 assert.equal(missingPhone.code,400);assert.equal(db.orders.length,0);
 const created=await post(base);
 assert.equal(created.code,201,JSON.stringify(created.jsonBody));
 assert.equal(db.orders.length,1);assert.equal(db.customers.length,1);assert.equal(links,1);
 assert.equal(JSON.parse(db.orders[0].notes).websiteCheckoutRequestId,base.clientRequestId);
 const repeat=await post(base);
 assert.equal(repeat.code,200);assert.equal(repeat.jsonBody.existing,true);
 assert.equal(repeat.jsonBody.noNewPaymentLink,true);
 assert.equal(db.orders.length,1);assert.equal(links,1);
 const conflict=await post({...base,customerEmail:'hijacker@example.test'});
 assert.equal(conflict.code,409);assert.equal(conflict.jsonBody.code,'WEBSITE_CHECKOUT_REQUEST_CONFLICT');
 assert.equal(db.orders.length,1);
 const afterPaid=safety.inspectExisting({tenantId:1,clientRequestId:base.clientRequestId,packageId:'starter',businessName:'Synthetic Store',email:base.customerEmail,orders:[{...db.orders[0],paymentStatus:'Paid'}],customers:db.customers});
 assert.equal(afterPaid.code,'WEBSITE_CHECKOUT_ALREADY_PAID');
 const protectedTenant=safety.inspectExisting({tenantId:2,clientRequestId:base.clientRequestId,packageId:'starter',businessName:'Synthetic Store',email:base.customerEmail,orders:db.orders,customers:db.customers});
 assert.equal(protectedTenant.found,false);
 const second={...base,clientRequestId:'sbcweb_'+'b'.repeat(32)};
 holdProbe=true;
 const firstInFlight=post(second);
 await new Promise(r=>setImmediate(r));
 const duplicateWhilePending=await post(second);
 assert.equal(duplicateWhilePending.code,409);
 assert.equal(duplicateWhilePending.jsonBody.code,'WEBSITE_CHECKOUT_IN_PROGRESS');
 holdProbe=false;
 assert.equal(typeof releaseProbe,'function');releaseProbe();
 const after=await firstInFlight;assert.equal(after.code,201);
 assert.equal(db.orders.length,2);assert.equal(links,2);
 const third={...base,clientRequestId:'sbcweb_'+'c'.repeat(32)};
 failLink=true;
 const linkFailed=await post(third);
 assert.equal(linkFailed.code,503);
 assert.equal(linkFailed.jsonBody.code,'SQUARE_LINK_UNCONFIRMED');
 assert.equal(db.orders.length,3);
 const retry=await post(third);
 assert.equal(retry.code,409);
 assert.equal(retry.jsonBody.code,'WEBSITE_CHECKOUT_RECONCILIATION_REQUIRED');
 assert.equal(db.orders.length,3);
 assert.equal(links,3,'no second Square link request after uncertain provider response');
 assert.equal(ctx.SBC_V6672_CHECKOUT_INFLIGHT.size,0);
 console.log('[SBC V6672] PASS: HMAC origin, exact tenant, catalog price, stable duplicate key, concurrent request exclusion, no repeat Square link, pending-reconcile, paid retry block. Synthetic only.');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
