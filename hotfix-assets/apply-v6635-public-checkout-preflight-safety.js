'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6635_PUBLIC_CHECKOUT_PREFLIGHT';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' expected 1, got '+n);return s.replace(a,b);}
function apply(root){
 const file=path.join(root,'server.js');
 let s=fs.readFileSync(file,'utf8');
 if(s.includes(MARKER))throw Error(MARKER+': applied twice');
 const routeStart="app.post('/api/public/checkout',async(req,res)=>{";
 const nextStart="app.get('/api/sales-orders',auth,v25SalesAccess,";
 if(s.split(routeStart).length!==2||s.split(nextStart).length!==2)throw Error(MARKER+': public checkout route boundary differs');
 const start=s.indexOf(routeStart),end=s.indexOf(nextStart,start);
 if(start<0||end<start)throw Error(MARKER+': route order invalid');
 let body=s.slice(start,end);
 body=once(body,
  "    if(!name||!email||!phone)return res.status(400).json({error:'Business name, email and phone are required.'});\n    const c=",
  [
   "    if(!name||!email||!phone)return res.status(400).json({error:'Business name, email and phone are required.'});",
   "    // "+MARKER+": fail BEFORE creating customers/orders when Square or the writer is unavailable.",
   "    if(SBC_RUNTIME_READ_ONLY||!MYSQL_RECOVERY_EVALUATED||MYSQL_RECOVERY_REQUIRED||!sbcWriterLeaseReady)return res.status(423).json({ok:false,code:'CHECKOUT_WRITER_LOCKED',error:'Checkout is temporarily unavailable. No customer or order was created.'});",
   "    if(RUNTIME_GATE.blocked('NEW_CHECKOUTS'))return res.status(423).json({ok:false,code:'CHECKOUT_OWNER_PAUSED',error:'Owner has paused new checkouts. No customer or order was created.'});",
   "    if(!squareConfigured())return res.status(503).json({ok:false,code:'SQUARE_NOT_CONFIGURED',error:'Secure checkout is not yet configured. No customer or order was created.'});",
   "    // SBC_V6666_PUBLIC_SQUARE_ZERO_GHOST_PREFLIGHT: bounded cached GET; no customer/order until Square location is healthy.",
   "    if(!squareWebhookConfigured())return res.status(503).json({ok:false,code:'SQUARE_WEBHOOK_NOT_CONFIGURED',error:'Secure checkout cannot confirm its payment webhook. No customer or order was created.'});",
   "    let squareLocationProbe;",
   "    try{squareLocationProbe=await SBC_SQUARE_LOCATION_PROBE({token:process.env.SQUARE_ACCESS_TOKEN,locationId:process.env.SQUARE_LOCATION_ID,environment:squareEnvironment(),apiVersion:SQUARE_API_VERSION});}",
   "    catch(_){return res.status(503).json({ok:false,code:'SQUARE_PREFLIGHT_UNAVAILABLE',error:'Secure checkout temporarily unavailable. No customer or order was created.'});}",
   "    if(!squareLocationProbe?.reachable)return res.status(503).json({ok:false,code:'SQUARE_PREFLIGHT_UNAVAILABLE',error:'Square location could not be verified. No customer or order was created.'});",
   "    const c="
  ].join('\n'),
  'pre-insert guarded financial preflight');
 body=once(body,
  "    const checkout=await createSquarePaymentLinkForOrder(o,{user:{id:'public-checkout',name:'SBC Web Checkout'}});\n    res.status(201).json(",
  [
   "    let checkout;",
   "    try{checkout=await createSquarePaymentLinkForOrder(o,{user:{id:'public-checkout',name:'SBC Web Checkout'}});}",
   "    catch(linkError){",
   "      // Unknown provider outcome: retain the pending record for reconciliation, never auto-retry.",
   "      updateOrderParsed(o,{checkoutLinkStatus:'RECONCILIATION_REQUIRED',checkoutLinkFailureAt:now()});",
   "      o.checkoutLinkStatus='RECONCILIATION_REQUIRED';",
   "      o.fulfillmentStatus='Blocked — Payment Link Unconfirmed';",
   "      addActivity('checkout_link_unconfirmed','Square payment link unconfirmed for order '+o.id,{orderId:o.id,tenantId:o.tenantId});",
   "      await saveData();",
   "      return res.status(503).json({ok:false,code:'SQUARE_LINK_UNCONFIRMED',orderId:o.id,recordedPendingOrder:true,automaticRetry:false,error:'The payment link could not be confirmed. An unpaid pending order was retained for owner reconciliation. Do not retry automatically.'});",
   "    }",
   "    res.status(201).json("
  ].join('\n'),
  'no silent newly-created order when Square link fails');
 if(!body.includes("app.post('/api/public/checkout'")||!body.includes("paymentStatus:'Pending'")||body.includes('delete from sbc_customers'))throw Error(MARKER+': public checkout invariants failed');
 s=s.slice(0,start)+body+s.slice(end);
 fs.writeFileSync(file,s);
 return {marker:MARKER,squarePreflightBeforeCRMWrite:true,ambiguousProviderOutcomeRecorded:true,noAutoRetry:true,existingRecordsUnchanged:true,writerRecoveryPreserved:true};
}
module.exports={apply,MARKER};