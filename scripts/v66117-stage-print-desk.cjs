'use strict';
/* SBC V66.117 staged only: no changes to live GoDaddy, Square or Twilio.
 * One owner-only read endpoint, one false vendor order ID bug fix.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const MARK='SBC_V66117_PRINT_FULFILLMENT_TRUTH';
function replaceExactlyOnce(input,oldText,nextText,label){
 const count=input.split(oldText).length-1;
 assert.equal(count,1,label+' must have one exact anchor, found '+count);
 return input.replace(oldText,nextText);
}
function patchServer(source){
 if(source.includes(MARK))return source;
 const readOnly=[
 " // SBC_V66117_PRINT_FULFILLMENT_TRUTH: tenant-scoped read, never a vendor API call.",
 " app.get('/api/owner/print-desk',auth,ownerOnly,(req,res)=>{",
 "  try{",
 "   const tenantId=requireRequestTenant(req);",
 "   const print=require('./enterprise/v66117-print-fulfillment-truth.cjs');",
 "   const payment=require('./enterprise/v6640-payment-evidence.cjs');",
 "   const summary=print.summarize({tenantId,orders:db.orders,jobs:megaData().fulfillmentJobs,",
 "      paymentConfirmed:order=>payment.providerCapturedSquare(order),limit:req.query.limit||100});",
 "   res.setHeader('Cache-Control','no-store');",
 "   return res.json({ok:true,...summary});",
 "  }catch(e){return res.status(Number(e?.status)||400).json({ok:false,code:String(e?.code||'PRINT_DESK_UNAVAILABLE')});}",
 " });",
 ""
 ].join('\n');
 let code=replaceExactlyOnce(source,
  "app.get('/api/fulfillment/provider-center',auth,requireCapability('fulfillment.manage')",
  readOnly+"app.get('/api/fulfillment/provider-center',auth,requireCapability('fulfillment.manage')",
  'owner print desk insertion');
 const bt=String.fromCharCode(96);
 const old="const staged=V400.markVendorReady(req.params.id,normalized,req.user);const vendorOrderId=String(req.body?.vendorOrderId||'').trim();const vendor=V400.submitVendor(req.params.id,vendorOrderId||"+bt+"MANUAL-"+'1794160228897'+bt+",req.user);";
 const next="const vendorOrderId=String(req.body?.vendorOrderId||'').trim();if(!require('./enterprise/v66117-print-fulfillment-truth.cjs').validVendorOrderId(vendorOrderId))return res.status(422).json({ok:false,code:'REAL_VENDOR_ORDER_REFERENCE_REQUIRED',error:'Enter a real supplier order number before marking a purchase submitted. No vendor order was placed by this action.'});const staged=V400.markVendorReady(req.params.id,normalized,req.user);const vendor=V400.submitVendor(req.params.id,vendorOrderId,req.user);";
 code=replaceExactlyOnce(code,old,next,'remove fabricated supplier order number');
 const recordOld="if(!provider||!vendorOrderId)return res.status(400).json({error:'Provider and vendor order number are required.'});";
 const recordNew="if(!provider||!require('./enterprise/v66117-print-fulfillment-truth.cjs').validVendorOrderId(vendorOrderId))return res.status(422).json({ok:false,code:'REAL_VENDOR_ORDER_REFERENCE_REQUIRED',error:'A real supplier order reference is required; no simulated vendor receipt may be saved.'});";
 code=replaceExactlyOnce(code,recordOld,recordNew,'protect manual vendor receipt recording');
 return code;
}
function verify(code){
 assert(code.includes(MARK),'staged truth patch missing');
 assert(code.includes("app.get('/api/owner/print-desk',auth,ownerOnly"),'print desk must be owner-only');
 assert(code.includes("payment.providerCapturedSquare(order)"),'use existing strict Square capture proof predicate');
 assert(!code.includes('vendorOrderId||'+String.fromCharCode(96)+'MANUAL-'),'synthetic receipt must be removed');
 assert(code.includes("code:'REAL_VENDOR_ORDER_REFERENCE_REQUIRED'"),'invalid receipt must fail explicitly');
 assert(code.includes("async function handleSquarePaymentEvent("),'must preserve Square payment handler');
 assert(code.includes("app.post('/api/kim400/orders/:id/vendor/manual-submit'"),'preserve vendor workflow');
 return true;
}
if(require.main===module){
 const file=path.resolve(__dirname,'..','server.js'),orig=fs.readFileSync(file,'utf8');
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66117_ISOLATED_STAGE!=='YES')throw Error('SBC_V66117_REFUSE_NON_DISPOSABLE_STAGE');
  const patched=patchServer(orig);verify(patched);assert.equal(patchServer(patched),patched,'idempotency');
  if(patched!==orig)fs.writeFileSync(file,patched);
  console.log('[SBC V66.117] staged print desk and real supplier receipt requirement');
 }else if(process.argv.includes('--verify-staged')){
  verify(orig);console.log('[SBC V66.117] staged server receipt and no-fake-vendor checks PASS');
 }else{
  const staged=patchServer(orig);verify(staged);
  console.log('[SBC V66.117] dry-run patch PASS (source unchanged)');
 }
}
module.exports={patchServer,verify,MARK};
