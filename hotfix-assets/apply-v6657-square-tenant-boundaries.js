'use strict';
// V66.57: require tenant equality on Square order routes, prevent cross-tenant
// payment refresh, and distinguish provider-backed Square proof from status flags.
// Source patch only: no provider calls or live record writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6657_SQUARE_TENANT_BOUNDARIES';
function once(s,before,after,label){
 const count=s.split(before).length-1;
 if(count!==1)throw Error(MARKER+': '+label+' expected once, got '+count);
 return s.replace(before,after);
}
function server(s){
 if(s.includes(MARKER))throw Error(MARKER+': duplicate');
 const requireTenant="let tenantId;try{tenantId=requireRequestTenant(req)}catch(_){return res.status(403).json({ok:false,code:'TENANT_CONTEXT_REQUIRED'});}";
 const selectOrder="const o=(db.orders||[]).find(x=>String(x.id)===String(req.params.orderId)&&Number(x.tenantId)===tenantId);";
 s=once(s,
 "app.post('/api/payments/square/create-link/:orderId',auth,v25SalesAccess,FINANCIAL_GOVERNOR.middleware('square_payment_link'),async(req,res)=>{const o=db.orders.find(x=>x.id===req.params.orderId);",
 "// "+MARKER+": tenant-bound payment-link creation.\napp.post('/api/payments/square/create-link/:orderId',auth,v25SalesAccess,FINANCIAL_GOVERNOR.middleware('square_payment_link'),async(req,res)=>{"+requireTenant+selectOrder,
 'link create');
 s=once(s,
 "app.get('/api/payments/square/order/:orderId',auth,async(req,res)=>{const o=db.orders.find(x=>x.id===req.params.orderId);",
 "app.get('/api/payments/square/order/:orderId',auth,async(req,res)=>{"+requireTenant+selectOrder,
 'payment view');
 s=once(s,
 "app.post('/api/payments/square/refresh/:orderId',auth,ownerOnly,async(req,res)=>{\n  const o=db.orders.find(x=>x.id===req.params.orderId);",
 "app.post('/api/payments/square/refresh/:orderId',auth,ownerOnly,async(req,res)=>{\n  "+requireTenant+"\n  "+selectOrder,
 'provider refresh');
 s=once(s,
 "app.get('/api/payments/square/status',auth,(req,res)=>res.json({ok:true,configured:squareConfigured(),webhookConfigured:squareWebhookConfigured(),environment:squareEnvironment(),apiVersion:SQUARE_API_VERSION,pending:squarePaymentRecords().filter(x=>x.status==='PENDING').length,successUrl:process.env.SQUARE_SUCCESS_REDIRECT_URL||''}));",
 "app.get('/api/payments/square/status',auth,(req,res)=>{"+requireTenant+"const ids=new Set((db.orders||[]).filter(o=>Number(o.tenantId)===tenantId).map(o=>String(o.id)));return res.json({ok:true,configured:squareConfigured(),webhookConfigured:squareWebhookConfigured(),environment:squareEnvironment(),apiVersion:SQUARE_API_VERSION,pending:squarePaymentRecords().filter(x=>x.status==='PENDING'&&ids.has(String(x.sbcOrderId))).length,successUrl:process.env.SQUARE_SUCCESS_REDIRECT_URL||''});});",
 'tenant-only pending status');
 s=once(s,
 " if(!require('./enterprise/v6640-payment-evidence.cjs').confirmedPaid(order))throw Object.assign(new Error('PAYMENT_EVIDENCE_REQUIRED'),{code:'PAYMENT_EVIDENCE_REQUIRED'});",
 " const E=require('./enterprise/v6640-payment-evidence.cjs');\n if(!E.confirmedPaid(order)||(E.squareLinked(order)&&!E.providerCapturedSquare(order)))throw Object.assign(new Error('PAYMENT_EVIDENCE_REQUIRED'),{code:'PAYMENT_EVIDENCE_REQUIRED'});",
 'Square-linked fulfillment evidence');
 s=once(s,
 " const paid=orders.filter(E.confirmedPaid);",
 " const paid=orders.filter(E.confirmedPaid);\n const providerCapturedSquare=orders.filter(E.providerCapturedSquare);\n const statusOnlyPaid=orders.filter(E.statusOnlyPayment);",
 'report proof classes');
 s=once(s,
 "   evidenceClassifiedPaid:paid.length,legacyManualUnverified:unresolved.length,unverifiedFulfillment:needsReview.length,",
 "   evidenceClassifiedPaid:paid.length,providerCapturedSquare:providerCapturedSquare.length,statusOnlyPaidNeedsReview:statusOnlyPaid.length,legacyManualUnverified:unresolved.length,unverifiedFulfillment:needsReview.length,",
 'owner report new counts');
 s=once(s,
 "  limitations:'Not a Square deposit or authoritative MySQL certification. No financial or CRM records were modified.'",
 "  limitations:'ProviderCapturedSquare is stored evidence, not independent Square deposit confirmation. StatusOnlyPaidNeedsReview is NOT collected cash. Not authoritative MySQL certification; no records were modified.'",
 'honest evidence disclaimer');
 new vm.Script(s,{filename:'server.js'});
 return s;
}
function classifier(s){
 if(!s.includes('SBC_V6652_MANUAL_PAYMENT_PROOF'))throw Error(MARKER+': payment prerequisite missing');
 const helpers=[
  '// '+MARKER+': status flags are not sufficient for Square-linked orders.',
  'function proofFields(o){',
  " let n={};try{if(typeof o?.notes==='string'&&o.notes.trim().startsWith('{'))n=JSON.parse(o.notes)}catch(_){}",
  " const p=o?.parsed&&typeof o.parsed==='object'?o.parsed:{};",
  " const m=o?.metadata&&typeof o.metadata==='object'?o.metadata:{};",
  " return {order:String(o?.squareOrderId||p.squareOrderId||m.squareOrderId||n.squareOrderId||'').trim(),",
  "  id:String(o?.squarePaymentId||p.squarePaymentId||m.squarePaymentId||n.squarePaymentId||'').trim(),",
  "  state:norm(o?.squarePaymentStatus||p.squarePaymentStatus||m.squarePaymentStatus||n.squarePaymentStatus),",
  "  completedAt:String(o?.squarePaymentCompletedAt||p.squarePaymentCompletedAt||m.squarePaymentCompletedAt||n.squarePaymentCompletedAt||'').trim(),",
  "  link:String(o?.squarePaymentLinkId||p.squarePaymentLinkId||m.squarePaymentLinkId||n.squarePaymentLinkId||'').trim()};",
  '}',
  "function squareLinked(o){const x=proofFields(o);return !!(x.order||x.link||x.id);}",
  'function providerCapturedSquare(o){',
  " if(!o||typeof o!=='object')return false;",
  ' const x=proofFields(o),payment=norm(o.paymentStatus);',
  ' return !NEGATIVE.has(payment)&&!NEGATIVE.has(x.state)&&!!x.order&&!!x.id&&SETTLED.has(x.state)&&!!x.completedAt&&Number.isFinite(Date.parse(x.completedAt));',
  '}',
  'function statusOnlyPayment(o){',
  " if(!o||typeof o!=='object')return false;",
  ' const p=norm(o.paymentStatus),x=proofFields(o);',
  ' return (SETTLED.has(p)||SETTLED.has(x.state))&&!providerCapturedSquare(o);',
  '}'
 ].join('\n');
 s=once(s,'function confirmedPaid(o){',helpers+'\nfunction confirmedPaid(o){','provider evidence helper');
 s=once(s,
 " if(!o||typeof o!=='object')return false;\n if(manualEvidence(o)&&!verifiedSquareAfterManual(o))return false;",
 " if(!o||typeof o!=='object')return false;\n if(squareLinked(o)&&!providerCapturedSquare(o))return false;\n if(manualEvidence(o)&&!verifiedSquareAfterManual(o))return false;",
 'fail closed for Square-linked orders');
 s=once(s,
 'module.exports={confirmedPaid,unverifiedFulfillment,snapshot,manualEvidence,verifiedSquareAfterManual};',
 'module.exports={confirmedPaid,unverifiedFulfillment,snapshot,manualEvidence,verifiedSquareAfterManual,providerCapturedSquare,squareLinked,statusOnlyPayment,proofFields};',
 'new read-only report helpers');
 new vm.Script(s,{filename:'payment-evidence.cjs'});
 return s;
}
function apply(root){
 const changes=[['enterprise/v6640-payment-evidence.cjs',classifier],['server.js',server]];
 const prepared=changes.map(([rel,fn])=>{
  const filename=path.join(root,rel);
  if(!fs.existsSync(filename))throw Error(MARKER+': missing '+rel);
  return {filename,rel,content:fn(fs.readFileSync(filename,'utf8'))};
 });
 for(const item of prepared)fs.writeFileSync(item.filename,item.content);
 return {marker:MARKER,files:prepared.map(x=>x.rel),tenantScopedRoutes:4,squareLinkedFulfillmentProtected:true,noProviderCalls:true};
}
module.exports={MARKER,once,server,classifier,apply};
