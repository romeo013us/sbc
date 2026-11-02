'use strict';
// SBC V66.30: surgical, fail-closed legacy order/quote boundary repair.
// This compiles an isolated staging candidate, never changes production MySQL or calls Square.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARK='SBC_V6630_CUSTOMER_JOURNEY_ORDER_GUARDS';
function once(s,old,next,label){
 const p=s.split(old);
 if(p.length!==2)throw Error(MARK+': '+label+' expected once, found '+(p.length-1));
 return p.join(next);
}
const GUARDS=String.raw`
/* SBC_V6630_CUSTOMER_JOURNEY_ORDER_GUARDS: legacy CRUD cannot mint financial proof. */
function sbcV6630OrderLinked(o){
 const n=orderParsed(o);
 return !!(n.squareOrderId||n.squarePaymentId||n.squarePaymentLinkId||
   o.squareOrderId||o.squarePaymentId||o.paymentUrl||
   String(o.paymentStatus||'').toUpperCase()==='PAID');
}
function sbcV6630ProtectedNotes(v){
 if(typeof v!=='string')return true;
 let n={};try{n=JSON.parse(v)}catch{return false}
 if(!n||typeof n!=='object')return false;
 return ['squareOrderId','squarePaymentId','squarePaymentStatus','squarePaymentLinkId',
   'squarePaymentCompletedAt','sbcLaunchQa','manualPaymentEvidence',
   'manualPaymentConfirmation','sbcLaunchQaPaidVerified'].some(k=>Object.prototype.hasOwnProperty.call(n,k));
}
function sbcV6630OrderAllowed(req,res,tenantId,b,existing){
 if(!sbcV6606QuoteWriterReady(req,res))return false;
 if(!b||typeof b!=='object'||Array.isArray(b)){
   res.status(422).json({ok:false,code:'ORDER_PATCH_INVALID'});return false;
 }
 const forbidden=new Set(['id','tenantId','tenant_id','createdAt','updatedAt','paymentStatus',
   'paymentUrl','squareOrderId','squarePaymentId','squarePaymentStatus',
   'squarePaymentLinkId','squarePaymentCompletedAt','launchQaOwnerCreated',
   'sbcLaunchQaPaidVerified','fulfillmentStatus']);
 if(Object.keys(b).some(k=>forbidden.has(k))){
   res.status(422).json({ok:false,code:'ORDER_FINANCIAL_FIELDS_IMMUTABLE'});return false;
 }
 if(existing&&Object.keys(b).some(k=>!new Set(['customerName','product','quantity','cost','price','status','notes']).has(k))){
   res.status(422).json({ok:false,code:'ORDER_PATCH_FIELD_NOT_ALLOWED'});return false;
 }
 const status=String(b.status||'').trim();
 if(/^(paid|completed|fulfilled|delivered|ready for fulfillment)$/i.test(status)){
   res.status(409).json({ok:false,code:'PAYMENT_PROOF_REQUIRED'});return false;
 }
 if(Object.prototype.hasOwnProperty.call(b,'notes')&&sbcV6630ProtectedNotes(b.notes)){
   res.status(409).json({ok:false,code:'PROVIDER_PAYMENT_NOTES_IMMUTABLE'});return false;
 }
 for(const k of ['price','cost','quantity']){
   if(Object.prototype.hasOwnProperty.call(b,k) &&
      (!Number.isFinite(Number(b[k]))||Number(b[k])<(k==='quantity'?0.000001:0))){
     res.status(422).json({ok:false,code:'ORDER_AMOUNT_INVALID'});return false;
   }
 }
 if(b.customerId&&!(db.customers||[]).some(c=>String(c.id)===String(b.customerId)&&Number(c.tenantId)===tenantId)){
   res.status(404).json({ok:false,code:'CUSTOMER_NOT_FOUND_IN_TENANT'});return false;
 }
 if(existing){
   if(orderParsed(existing).sbcLaunchQa||String(existing.fulfillmentStatus||'').startsWith('QA ')||sbcV6630OrderLinked(existing)){
     res.status(409).json({ok:false,code:'PAYMENT_LINKED_ORDER_IMMUTABLE'});return false;
   }
 }
 return true;
}
function sbcV6630OrderCanDelete(req,res,o){
 if(!sbcV6606QuoteWriterReady(req,res))return false;
 if(orderParsed(o).sbcLaunchQa||String(o.fulfillmentStatus||'').startsWith('QA ')||sbcV6630OrderLinked(o)){
   res.status(409).json({ok:false,code:'PAYMENT_LINKED_ORDER_IMMUTABLE'});return false;
 }
 return true;
}
`;
function patchServer(source){
 if(typeof source!=='string'||!source)throw Error(MARK+': compiled server required');
 if(source.includes(MARK))return {source,alreadyApplied:true};
 const start=source.indexOf("app.post('/api/orders',auth,ownerOnly,");
 const end=source.indexOf("\napp.post('/api/renewals'",start);
 if(start<0||end<=start)throw Error(MARK+': order route boundary not found');
 let block=source.slice(start,end);
 block=once(block,"const b=req.body||{};if(!b.customerName||!b.product)",
   "const b=req.body||{};if(!sbcV6630OrderAllowed(req,res,tenantId,b,null))return;if(!b.customerName||!b.product)",'order create');
 block=once(block,"const o=db.orders.find(x=>x.id===req.params.id);if(!o)return res.status(404).json({error:'Order not found.'});Object.assign(o,req.body||{},{id:o.id,updatedAt:now()});",
   "const tenantId=requireRequestTenant(req);const o=db.orders.find(x=>x.id===req.params.id&&Number(x.tenantId)===tenantId);if(!o)return res.status(404).json({error:'Order not found.'});if(!sbcV6630OrderAllowed(req,res,tenantId,req.body||{},o))return;Object.assign(o,req.body||{},{id:o.id,tenantId:o.tenantId,updatedAt:now()});",'order update');
 block=once(block,"const i=db.orders.findIndex(x=>x.id===req.params.id);if(i<0)return res.status(404).json({error:'Order not found.'});db.orders[i].status='Deleted';",
   "const tenantId=requireRequestTenant(req);const i=db.orders.findIndex(x=>x.id===req.params.id&&Number(x.tenantId)===tenantId);if(i<0)return res.status(404).json({error:'Order not found.'});if(!sbcV6630OrderCanDelete(req,res,db.orders[i]))return;db.orders[i].status='Deleted';",'order delete');
 let result=source.slice(0,start)+GUARDS+'\n'+block+source.slice(end);
 result=once(result,
   "registerV56131RevenueFinisher(app,{auth,ownerOnly,getContext:()=>({db,mysqlPool,audit,saveData,user:null,addActivity,assignLeadAutomatically,enqueueLeadAssist,normalizeLeadIntelligence,sqlDateTime})});",
   "registerV56131RevenueFinisher(app,{auth,ownerOnly,getContext:()=>({db,mysqlPool,audit,saveData,user:null,addActivity,assignLeadAutomatically,enqueueLeadAssist,normalizeLeadIntelligence,sqlDateTime,writerReady:!SBC_RUNTIME_READ_ONLY&&!sbcShutdownStarted&&!!mysqlPool&&MYSQL_RECOVERY_EVALUATED&&!MYSQL_RECOVERY_REQUIRED&&sbcWriterLeaseReady})});",
   'legacy import writer context');
 const qs=result.indexOf("app.post('/api/quotes',auth,ownerOnly,");
 const qe=result.indexOf("// V25 Sales Order Builder",qs);
 if(qs<0||qe<=qs)throw Error(MARK+': quote boundary missing');
 let quote=result.slice(qs,qe);
 quote=once(quote,"const b=req.body||{},items=",
  "const b=req.body||{};if(b.customerId&&!(db.customers||[]).some(c=>String(c.id)===String(b.customerId)&&Number(c.tenantId)===requireRequestTenant(req)))return res.status(404).json({ok:false,code:'CUSTOMER_NOT_FOUND_IN_TENANT'});const items=",'quote customer');
 quote=once(quote,"const c=db.customers.find(x=>x.id===q.customerId);",
   "const c=db.customers.find(x=>x.id===q.customerId&&Number(x.tenantId)===requireRequestTenant(req));",'quote update customer');
 quote=once(quote,"const i=db.quotes.findIndex(x=>x.id===req.params.id);if(i<0)return res.status(404).json({error:'Quote not found.'});const q=db.quotes[i];",
   "if(!sbcV6606QuoteWriterReady(req,res))return;const tenantId=requireRequestTenant(req);const i=db.quotes.findIndex(x=>x.id===req.params.id&&Number(x.tenantId)===tenantId);if(i<0)return res.status(404).json({error:'Quote not found.'});const q=db.quotes[i];if(String(q.status||'').toLowerCase()==='paid'||q.paymentUrl)return res.status(409).json({ok:false,code:'SETTLED_OR_LINKED_QUOTE_IMMUTABLE'});",'quote delete');
 result=result.slice(0,qs)+quote+result.slice(qe);
 new vm.Script(result,{filename:'sbc-v6630-staged-server.js'});
 return {source:result,alreadyApplied:false};
}
if(require.main===module){
 const p=path.resolve(__dirname,'../server.js'),src=fs.readFileSync(p,'utf8');
 const {source,alreadyApplied}=patchServer(src);
 const twice=patchServer(source);
 if(twice.source!==source||!twice.alreadyApplied)throw Error(MARK+': patch not idempotent');
 if(process.argv.includes('--apply')){
  if(process.env.SBC_ENABLE_V6630_SOURCE_WRITE!=='YES')throw Error(MARK+': isolated write approval required');
  if(!alreadyApplied)fs.writeFileSync(p,source);
  console.log('[SBC V6630] isolated compiled runtime updated; regenerate identity and receipt');
 }else console.log('[SBC V6630] PASS: order/quote guards validated in memory without live changes');
}
module.exports={patchServer,MARK};
