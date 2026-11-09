'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),lab=require('../enterprise/v66129-owner-checkout-lab.cjs'),stage=require('./v66129-stage-owner-checkout-lab.cjs');
const catalog={packages:[{id:'officebox_starter',name:'Office Box — Starter',price:49,category:'Office Box',unit:'month'},{id:'starter',name:'SBC Starter',price:199,category:'Package'}],services:[{id:'cards100',name:'Business Cards — 100',price:40,category:'Print'},{id:'qa_zero',name:'QA Test',price:1,testOnly:true}]};
const all=lab.catalog(catalog),owner={id:'usr_owner',role:'owner'},at=new Date().toISOString();
assert.equal(all.length,3);
assert.equal(all.find(p=>p.id==='officebox_starter').listPriceCents,4900);
assert.equal(all.find(p=>p.id==='cards100').listPriceCents,4000);
assert.equal(all.find(p=>p.id==='starter').listPriceCents,19900);
assert(!all.some(p=>p.id==='qa_zero'));
const create=p=>lab.create({tenantId:1,product:p,requestId:'browser1234567890',actor:owner,orderId:'qaorder_internal123',at,customerName:'INTERNAL QA'});
const ob=create(catalog.packages[0]),cards=create(catalog.services[0]);
assert.equal(ob.price,0);assert.equal(cards.price,0);
assert.equal(ob.paymentStatus,'NOT_APPLICABLE_ZERO_DOLLAR_QA');
assert.equal(lab.publicRecord(ob).discountCents,4900);
assert.equal(lab.publicRecord(cards).discountCents,4000);
assert.equal(lab.publicRecord(ob).providerSubscriptionActivated,false);
assert.equal(lab.publicRecord(ob).vendorOrderSubmitted,false);
assert.throws(()=>lab.create({tenantId:1,product:{id:'x',name:'Bad',price:-2},actor:owner,orderId:'qaorder_internal123',requestId:'browser1234567890',at,customerName:'QA'}),/QA_PRODUCT_PRICE_INVALID/);
let progress=lab.next(ob,{stage:'READY_FOR_MANUAL_REVIEW',actor:owner,at});
assert.equal(lab.publicRecord(progress.order).stage,'READY_FOR_MANUAL_REVIEW');
assert.throws(()=>lab.next(ob,{stage:'COMPLETED',actor:owner,at,confirm:'MARK_TEST_FULFILLMENT_COMPLETE'}),/QA_STAGE_SEQUENCE_REQUIRED/);
assert.throws(()=>lab.next(progress.order,{stage:'COMPLETED',actor:owner,at}),/QA_EXPLICIT_MANUAL_CONFIRMATION_REQUIRED/);
progress=lab.next(progress.order,{stage:'COMPLETED',actor:owner,at,confirm:'MARK_TEST_FULFILLMENT_COMPLETE'});
assert.equal(progress.order.status,'QA TEST COMPLETED');
assert.equal(lab.next(progress.order,{stage:'COMPLETED',actor:owner,at}).unchanged,true);
const source=fs.readFileSync(path.join(root,'server.js'),'utf8'),patched=stage.patchServer(source);
assert.equal(stage.patchServer(patched),patched);
const first=patched.indexOf("const SBC_V66129_LAB=require("),last=patched.indexOf('/* SBC_V6630_CUSTOMER_JOURNEY_ORDER_GUARDS',first);
assert(first>0&&last>first);
const route=patched.slice(first,last);
assert(!/squareApi\(|createSquarePaymentLinkForOrder\(|sendOrderIntake\(|twilioFactory\(|stripe\b/i.test(route));
const handlers=new Map(),db={settings:{ownerCheckoutLab:[]},orders:[],customers:[]};let writes=0,writer=true,dbOnline=true,committedState=[];const audits=[];
const ctx={require:()=>lab,db,CATALOG:catalog,auth:'AUTH',ownerOnly:'OWNER',Array,Number,String,JSON,Object,Error,Date,
 app:{get:(u,a,o,h)=>{assert.equal(a,'AUTH');assert.equal(o,'OWNER');handlers.set('GET '+u,h)},
 post:(u,a,o,h)=>{assert.equal(a,'AUTH');assert.equal(o,'OWNER');handlers.set('POST '+u,h)}},
 requireRequestTenant:req=>req.tenantId,
 MYSQL_RECOVERY_REQUIRED:false,MYSQL_RECOVERY_EVALUATED:true,mysqlPool:{query:async(sql,args)=>{
  assert(/^SELECT setting_value FROM sbc_settings WHERE setting_key=\? LIMIT 1$/.test(sql));
  assert.equal(args[0],'ownerCheckoutLab');
  if(!dbOnline)throw Error('SIMULATED_MYSQL_OFFLINE');
  return [[{setting_value:JSON.stringify(committedState)}]];
 }},
 SBC_V6649_REQUIRE_WRITER:()=>{if(!writer)throw Object.assign(Error('WRITER_LOCKED'),{code:'WRITER_LOCKED',status:423})},
 saveData:async()=>{writes++;committedState=JSON.parse(JSON.stringify(db.settings.ownerCheckoutLab))},audit:(u,t,m,n)=>audits.push(t),
 id:()=> 'qaorder_'+String(writes+1).padStart(10,'0'),now:()=>new Date().toISOString()};
vm.runInNewContext(route,ctx,{timeout:2500});
const req=(body={},tenantId=1,orderId='')=>({body,tenantId,user:owner,params:{orderId},query:{}}),res=()=>({statusCode:200,body:null,headers:{},status(c){this.statusCode=c;return this},setHeader(k,v){this.headers[k]=v;return this},json(x){this.body=x;return this}});
async function call(route,request){const fn=handlers.get(route);assert(fn,'missing '+route);const output=res();await fn(request,output);return output}
(async()=>{
 let result=await call('GET /api/owner/checkout-lab/catalog',req());
 assert.equal(result.statusCode,200);assert.equal(result.body.catalog.length,3);
 const body={confirm:'CREATE_ZERO_DOLLAR_QA',discountPercent:100,productId:'cards100',requestId:'browser1234567890'};
 result=await call('POST /api/owner/checkout-lab/order',req({...body,discountPercent:95}));
 assert.equal(result.statusCode,422);assert.equal(writes,0);
 result=await call('POST /api/owner/checkout-lab/order',req({...body,price:0}));
 assert.equal(result.statusCode,422);assert.equal(writes,0);
 result=await call('POST /api/owner/checkout-lab/order',req(body));
 assert.equal(result.statusCode,201);
 assert.equal(result.body.record.totalCents,0);
 assert.equal(result.body.record.listPriceCents,4000);
 assert.equal(writes,1);
 assert.equal(db.orders.length,0);assert.equal(db.customers.length,0);
 const oid=result.body.record.id;
 result=await call('POST /api/owner/checkout-lab/order',req(body));
 assert.equal(result.statusCode,200);assert.equal(result.body.existing,true);assert.equal(writes,1);
 result=await call('POST /api/owner/checkout-lab/order/:orderId/advance',req({stage:'COMPLETED',confirm:'MARK_TEST_FULFILLMENT_COMPLETE'},1,oid));
 assert.equal(result.statusCode,409);
 result=await call('POST /api/owner/checkout-lab/order/:orderId/advance',req({stage:'READY_FOR_MANUAL_REVIEW'},1,oid));
 assert.equal(result.statusCode,200);assert.equal(writes,2);
 result=await call('POST /api/owner/checkout-lab/order/:orderId/advance',req({stage:'COMPLETED'},1,oid));
 assert.equal(result.statusCode,409);
 result=await call('POST /api/owner/checkout-lab/order/:orderId/advance',req({stage:'COMPLETED',confirm:'MARK_TEST_FULFILLMENT_COMPLETE'},1,oid));
 assert.equal(result.statusCode,200);assert.equal(result.body.record.stage,'COMPLETED');assert.equal(writes,3);
 result=await call('GET /api/owner/checkout-lab/orders',req({},2));
 assert.equal(result.body.records.length,0);
 assert.equal(stage.patchServer(patched.replace('const records=(await sbcV66129Committed(t))','const records=sbcV66129List(t)')),patched,'legacy staged route must be upgraded');
 assert(route.includes('const records=(await sbcV66129Committed(t))'),'GET ledger must read MySQL');
 const originalQuery=ctx.mysqlPool.query;
 ctx.mysqlPool.query=async()=>{throw Error('SIMULATED_MYSQL_OFFLINE')};
 result=await call('GET /api/owner/checkout-lab/orders',req());
 assert.equal(result.statusCode,503,'SQL outage must never present stale in-memory checkout as committed');
 ctx.mysqlPool.query=originalQuery;
 const phantom=lab.create({tenantId:1,product:catalog.services[0],requestId:'phantom_browser_12345',actor:owner,orderId:'qaorder_phantom_12345',at,customerName:'INTERNAL QA'});
 db.settings.ownerCheckoutLab.push(phantom);
 result=await call('POST /api/owner/checkout-lab/order',req({...body,requestId:'phantom_browser_12345'}));
 assert.equal(result.statusCode,503,'uncommitted in-memory record must never be presented as saved');
 db.settings.ownerCheckoutLab.pop();
 writer=false;result=await call('POST /api/owner/checkout-lab/order',req({...body,requestId:'newbrowser12345678'}));
 assert.equal(result.statusCode,423);assert.equal(writes,3);
 assert(audits.includes('owner_checkout_lab_created')&&audits.includes('owner_checkout_lab_stage'));
 for(const folder of ['public','browser_public']){
  const app=fs.readFileSync(path.join(root,folder,'app.js'),'utf8'),
   html=fs.readFileSync(path.join(root,folder,'index.html'),'utf8'),
   ui=fs.readFileSync(path.join(root,folder,'v66-129-owner-checkout-lab.js'),'utf8');
  assert(app.includes('sbcOpenOwnerCheckoutLab()'));
  assert(html.includes('/v66-129-owner-checkout-lab.js?v=66.0.129'));
  assert(ui.includes('discountPercent:100')&&ui.includes('MARK_TEST_FULFILLMENT_COMPLETE'));
  assert(!/square\.link|createSquarePaymentLink|api\/payments\/square|STRIPE_SECRET_KEY/.test(ui));
  new vm.Script(ui,{filename:folder+'/v66-129-owner-checkout-lab.js'});
 }
 assert.equal(fs.readFileSync(path.join(root,'public/app.js'),'utf8'),fs.readFileSync(path.join(root,'browser_public/app.js'),'utf8'));
 assert.equal(fs.readFileSync(path.join(root,'public/v66-129-owner-checkout-lab.js'),'utf8'),fs.readFileSync(path.join(root,'browser_public/v66-129-owner-checkout-lab.js'),'utf8'));
 if(process.argv.includes('--staged'))assert.equal(source,patched,'staged QA route missing');
 console.log('[SBC V66.129 CHECKOUT LAB] PASS $49 Office Box / $40 business cards / 100% discount / $0 provider calls / manual QA fulfillment / idempotency / tenant isolation / no real orders');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
