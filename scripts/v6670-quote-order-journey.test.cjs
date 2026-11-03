'use strict';
/* SBC V66.70 — synthetic customer journey regression. No payment, DB or network. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const helper=require('../enterprise/v6670-quote-order-integrity.cjs');
const patch=require('./v6670-quote-order-stage.cjs');
const master=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const compiled=patch.patchServer(master).source;
assert.equal(patch.patchServer(compiled).source,compiled,'reapplying patch is a no-op');
assert.ok(compiled.includes(patch.MARK));
assert.match(compiled,/SBC_V6670_QUOTE_ORDER\.examine/);
assert.match(compiled,/noPaymentLinkCreated:true/);
assert.match(compiled,/notes:JSON\.stringify\(\{v25:true,quoteId,clientRequestId/);
assert.equal(helper.cents(199),19900);
assert.equal(helper.cents(199.005),19901);
assert.ok(!helper.examine({tenantId:1,total:0}).ok);

const start=compiled.indexOf("app.post('/api/sales-orders',auth,v25SalesAccess,");
const end=compiled.indexOf("const PUBLIC_CHECKOUT_RATE=new Map();",start);
assert.ok(start>0&&end>start);
const handlers={};
const db={
 settings:{taxRate:0},
 customers:[
  {id:'c1',tenantId:1,customerName:'Sample',email:'buyer@example.test',phone:'+13055550001'},
  {id:'c2',tenantId:2,customerName:'Other',email:'outside@example.test',phone:'+13055550002'},
  {id:'c3',tenantId:1,customerName:'Third',email:'third@example.test',phone:'+13055550003'}
 ],
 quotes:[
  {id:'quote-one',tenantId:1,customerId:'c1',status:'Sent',total:199,quoteNumber:'SBC-42'},
  {id:'quote-draft',tenantId:1,customerId:'c1',status:'Draft',total:199,quoteNumber:'SBC-43'},
  {id:'quote-other',tenantId:2,customerId:'c2',status:'Won',total:199,quoteNumber:'SBC-44'}
 ],
 orders:[]
};
let sequence=0,payLinks=0,writes=0,activities=0;
const scope={
 app:{post:(url,...args)=>{handlers[url]=args.at(-1)}},
 auth:()=>{},v25SalesAccess:()=>{},
 FINANCIAL_GOVERNOR:{middleware:()=>()=>{}},
 SBC_V6670_QUOTE_ORDER:helper,db,Math,JSON,String,Number,Boolean,
 v25OrderItems:a=>Array.isArray(a)?a:[],
 totals:a=>a.reduce((n,i)=>n+Number(i.unitPrice||0)*Number(i.qty||1),0),
 v25BundleMatch:()=>null,requireRequestTenant:req=>req.tenantId,
 now:()=> '2026-11-03T19:00:00Z',
 id:p=>p+'_'+(++sequence),
 addActivity:()=>{activities++},
 saveData:async()=>{writes++},
 createSquarePaymentLinkForOrder:async(o)=>{payLinks++;o.paymentUrl='https://square.link/u/SYNTHETIC';return {url:o.paymentUrl,paymentLinkId:'synthetic',squareOrderId:'order-synthetic'}},
 squareConfigured:()=>true,
};
vm.runInNewContext(compiled.slice(start,end),scope,{timeout:3000});
const route=handlers['/api/sales-orders'];
assert.equal(typeof route,'function');
const base={customerId:'c1',customerName:'Sample',contactName:'Buyer',
 customerPhone:'+13055550001',customerEmail:'buyer@example.test',
 items:[{id:'starter',name:'SBC Starter',qty:1,unitPrice:199}],
 quoteId:'quote-one',generatePaymentLink:true};
async function post(body,tenantId=1){
 const r={code:200,payload:null,status(x){this.code=x;return this},json(x){this.payload=x;return this}};
 await route({tenantId,user:{id:'owner',role:'owner',name:'SBC Owner'},body},r);
 return r;
}
(async()=>{
 for(const [body,expected,code] of [
  [{...base,quoteId:'quote-other'},404,'QUOTE_NOT_FOUND_IN_TENANT'],
  [{...base,customerId:'c2'},404,'CUSTOMER_NOT_FOUND_IN_TENANT'],
  [{...base,customerId:'missing'},404,'CUSTOMER_NOT_FOUND_IN_TENANT'],
  [{...base,quoteId:'quote-draft'},409,'QUOTE_NOT_APPROVED_FOR_CHECKOUT'],
  [{...base,items:[{id:'starter',name:'Altered Price',qty:1,unitPrice:99}]},409,'QUOTE_ORDER_AMOUNT_MISMATCH'],
  [{...base,customerId:'c3',customerEmail:'third@example.test'},409,'QUOTE_CUSTOMER_LINK_REQUIRED'],
  [{...base,customerEmail:'attacker@example.test'},409,'CUSTOMER_EMAIL_MISMATCH'],
  [{...base,clientRequestId:'too-short'},422,'SALES_ORDER_REQUEST_ID_INVALID']
 ]){
  const r=await post(body);
  assert.equal(r.code,expected,JSON.stringify(body));
  assert.equal(r.payload.code,code);
  assert.equal(db.orders.length,0,'invalid cross-tenant/cross-customer requests never create orders');
  assert.equal(writes,0,'invalid requests never save data');
  assert.equal(payLinks,0,'invalid requests never attempt payment');
 }
 const good=await post({...base,clientRequestId:'REQ_CUST_JOURNEY_001'});
 assert.equal(good.code,201);
 assert.equal(db.orders.length,1);
 assert.equal(payLinks,1);
 assert.equal(db.orders[0].quoteId,'quote-one');
 assert.equal(helper.savedRequestId(db.orders[0]),'REQ_CUST_JOURNEY_001');
 assert.equal(writes,1);
 const repeat=await post({...base,clientRequestId:'REQ_CUST_JOURNEY_001'});
 assert.equal(repeat.code,200);
 assert.equal(repeat.payload.existing,true);
 assert.equal(repeat.payload.orderId,good.payload.order.id);
 assert.equal(repeat.payload.noPaymentLinkCreated,true);
 assert.equal(repeat.payload.requiresReconciliation,true);
 assert.equal(db.orders.length,1);
 assert.equal(payLinks,1,'repeat order cannot create a second Square payment link');
 assert.equal(writes,1,'repeat order does not change MySQL');
 const otherKey=await post({...base,clientRequestId:'REQ_CUST_JOURNEY_002'});
 assert.equal(otherKey.code,409,'quote cannot be silently reused under another request identity');
 assert.equal(otherKey.payload.code,'ORDER_IDEMPOTENCY_CONFLICT');
 const priceTamper=await post({...base,items:[{id:'starter',name:'Altered',qty:1,unitPrice:299}]});
 assert.equal(priceTamper.code,409);
 assert.equal(db.orders.length,1);
 const noQuote={...base,quoteId:'',clientRequestId:'REQ_CUST_JOURNEY_003',generatePaymentLink:false};
 const newOrder=await post(noQuote);
 assert.equal(newOrder.code,201);
 assert.equal(payLinks,1);
 assert.equal(db.orders.length,2);
 const sameNoQuote=await post(noQuote);
 assert.equal(sameNoQuote.code,200);
 assert.equal(db.orders.length,2);
 assert.equal(writes,2);
 const collision=await post({...noQuote,customerId:'c3',customerEmail:'third@example.test'});
 assert.equal(collision.code,409);
 assert.equal(db.orders.length,2);
 assert.equal(activities,2);
 console.log('[SBC V6670] PASS: quote provenance, tenant/customer/cost checks, safe idempotent retry, no repeat Square link, backward-compatible no-link order');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
