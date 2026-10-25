'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {apply}=require('../hotfix-assets/apply-v6635-public-checkout-preflight-safety.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6635-'));
try{
 const s=[
  "app.post('/api/public/checkout',async(req,res)=>{",
  "    if(!name||!email||!phone)return res.status(400).json({error:'Business name, email and phone are required.'});",
  "    const c={id:id('cust')};db.customers.unshift(c);",
  "    const o={paymentStatus:'Pending',id:'ord'};db.orders.unshift(o);await saveData();",
  "    const checkout=await createSquarePaymentLinkForOrder(o,{user:{id:'public-checkout',name:'SBC Web Checkout'}});",
  "    res.status(201).json({ok:true,paymentUrl:checkout.url});",
  "});",
  "app.get('/api/sales-orders',auth,v25SalesAccess,(req,res)=>res.json([]));"
 ].join('\n');
 fs.writeFileSync(path.join(root,'server.js'),s);
 const out=apply(root);assert.equal(out.noAutoRetry,true);
 const result=fs.readFileSync(path.join(root,'server.js'),'utf8');
 assert.match(result,/SBC_V6635_PUBLIC_CHECKOUT_PREFLIGHT/);
 assert.match(result,/SQUARE_NOT_CONFIGURED/);
 assert.match(result,/CHECKOUT_WRITER_LOCKED/);
 assert.match(result,/CHECKOUT_OWNER_PAUSED/);
 assert.match(result,/SQUARE_LINK_UNCONFIRMED/);
 assert.match(result,/automaticRetry:false/);
 assert.match(result,/recordedPendingOrder:true/);
 assert.match(result,/RECONCILIATION_REQUIRED/);
 assert.ok(result.indexOf("if(!squareConfigured())")<result.indexOf('db.customers.unshift(c)'),'must gate before writes');
 assert.ok(result.indexOf("if(!sbcWriterLeaseReady")<0,'writer predicate uses compound fail-closed guard');
 assert.throws(()=>apply(root),/applied twice/);
 console.log('V6635 public checkout locks/secret preflight before any CRM write; uncertain Square links remain traceable PASS');
}finally{fs.rmSync(root,{recursive:true,force:true})}