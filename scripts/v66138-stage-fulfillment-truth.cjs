'use strict';
/* SBC V66.138: disposable staged-only V400 authority and supplier-truth patch.
   Do not rewrite pinned server.js in source; GitHub's staged release signs new bytes.
*/
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66138_FULFILLMENT_COMMIT_AND_PROVIDER_TRUTH';
function once(src,from,to,label){
 const count=src.split(from).length-1;if(count!==1)throw Error('FULFILLMENT_ANCHOR_MISMATCH:'+label+':'+count);
 return src.replace(from,to);
}
function patchServer(source){
 let s=String(source||'');
 if(s.includes(MARK)){if(s.split(MARK).length!==2)throw Error('FULFILLMENT_STAGING_PARTIAL');return s;}
 const start="function v400ApplyOrderStage(id,stage){";
 const end="// SBC_V6641_FULFILLMENT_PAYMENT_EVIDENCE: authorize and verify BEFORE V400 order changes.";
 const p=s.indexOf(start),q=s.indexOf(end,p);
 if(p<0||q<p||s.indexOf(start,p+1)!==-1)throw Error('FULFILLMENT_APPLY_STAGE_BOUNDARY_MISSING');
 const replacement=`
const SBC_V66138_FULFILLMENT_TRUTH=require('./enterprise/v66138-fulfillment-truth.cjs');
// ${MARK}
async function v400ApplyOrderStage(req,id,stage){
 const tenantId=requireRequestTenant(req);
 const order=v400Orders().find(x=>String(x.id)===String(id)&&Number(x.tenantId??x.tenant_id)===Number(tenantId));
 if(!order)throw Object.assign(Error('FULFILLMENT_ORDER_NOT_FOUND_IN_TENANT'),{code:'FULFILLMENT_ORDER_NOT_FOUND_IN_TENANT'});
 return SBC_V66138_FULFILLMENT_TRUTH.commitStage({order,stage,pool:mysqlPool,saveData,
   paid:V400_PAYMENT_EVIDENCE.confirmedPaid,stamp:now()});
}
let sbcV66138CommitTail=Promise.resolve();
async function v400CommitAction(req,stage,mutate){
 const prior=sbcV66138CommitTail;
 let release;sbcV66138CommitTail=new Promise(resolve=>{release=resolve});
 await prior;
 let snapshot=null;
 try{
  const tenantId=requireRequestTenant(req);
  const order=v400Orders().find(x=>String(x.id)===String(req.params.id)&&Number(x.tenantId??x.tenant_id)===Number(tenantId));
  if(!order)throw Object.assign(Error('FULFILLMENT_ORDER_NOT_FOUND_IN_TENANT'),{code:'FULFILLMENT_ORDER_NOT_FOUND_IN_TENANT'});
  if(!V400_PAYMENT_EVIDENCE.confirmedPaid(order))throw Error('PAYMENT_EVIDENCE_REQUIRED');
  if(!mysqlPool||SBC_RUNTIME_READ_ONLY||sbcShutdownStarted||!MYSQL_RECOVERY_EVALUATED||MYSQL_RECOVERY_REQUIRED||!sbcWriterLeaseReady)
    throw Object.assign(Error('FULFILLMENT_AUTHORITATIVE_WRITER_UNAVAILABLE'),{code:'FULFILLMENT_AUTHORITATIVE_WRITER_UNAVAILABLE'});
  snapshot=V400.capture(req.params.id);
  const result=mutate();
  const receipt=await v400ApplyOrderStage(req,req.params.id,stage);
  return {result,receipt};
 }catch(e){
  if(snapshot){try{V400.restore(snapshot)}catch(err){console.error('[SBC FULFILLMENT] rollback projection failed; manual reconciliation required',String(err.code||err.message||err))}}
  throw e;
 }finally{release()}
}
`;
 s=s.slice(0,p)+replacement+s.slice(q);
 const manual="const staged=V400.markVendorReady(req.params.id,normalized,req.user);const vendor=V400.submitVendor(req.params.id,vendorOrderId,req.user);v400ApplyOrderStage(req.params.id,'VENDOR_SUBMITTED');";
 s=once(s,manual,"const {result:{staged,vendor}}=await v400CommitAction(req,'VENDOR_SUBMITTED',()=>{const staged=V400.markVendorReady(req.params.id,normalized,req.user);const vendor=V400.submitVendor(req.params.id,vendorOrderId,req.user);return {staged,vendor}});",'manual-commit');
 const recordStart="app.post('/api/kim400/orders/:id/vendor/record',auth,requireCapability('fulfillment.manage'),async(req,res)=>{";
 const recordEnd="app.get('/api/kim400/summary',auth,";
 const rs=s.indexOf(recordStart),re=s.indexOf(recordEnd,rs);
 if(rs<0||re<rs)throw Error('FULFILLMENT_VENDOR_RECORD_BOUNDARY_MISSING');
 const record=`
app.post('/api/kim400/orders/:id/vendor/record',auth,requireCapability('fulfillment.manage'),async(req,res)=>{
 try{
  const provider=String(req.body?.provider||'').trim(),vendorOrderId=String(req.body?.vendorOrderId||'').trim();
  if(!provider||!SBC_V66138_FULFILLMENT_TRUTH.validReceipt(vendorOrderId))
   return res.status(422).json({ok:false,code:'REAL_VENDOR_ORDER_REFERENCE_REQUIRED',error:'A real supplier receipt is required; no purchase is made by recording it.'});
  const current=V400.get(req.params.id,v400Orders());
  if(!current)return res.status(404).json({ok:false,error:'Fulfillment order not found.'});
  if(!['VENDOR_STAGED','VENDOR_SUBMITTED'].includes(current.stage))
   return res.status(409).json({ok:false,error:'Supplier record cannot change a completed or in-production stage.'});
  const {result:order,receipt}=await v400CommitAction(req,'VENDOR_SUBMITTED',()=>{
   const vendor=V400.markVendorReady(req.params.id,provider,req.user);
   vendor.orderId=vendorOrderId;vendor.status='SUBMITTED';
   const item=V400.state.orders[String(req.params.id)];
   item.vendor=vendor;item.stage='VENDOR_SUBMITTED';item.checklist.vendor=true;
   item.updatedAt=now();item.history.unshift({id:id('fh'),from:current.stage,to:'VENDOR_SUBMITTED',
    actor:req.user.name||'Owner',at:now(),meta:{manualVendorRecord:true,provider,vendorOrderId}});
   return V400.get(req.params.id,v400Orders());
  });
  audit(req.user,'fulfillment_vendor_recorded','Recorded existing manual supplier purchase after durable stage commit',
   {orderId:req.params.id,provider,vendorOrderId});
  return res.json({ok:true,order,receipt,providerSubmissionPerformed:false,manualReceipt:true});
 }catch(e){return res.status(409).json({ok:false,error:String(e.code||e.message||'FULFILLMENT_COMMIT_FAILED'),durable:false})}
});
`;
 s=s.slice(0,rs)+record+s.slice(re);
 s=once(s,
 "const next=String(req.body?.stage||'');const result=V400.advance(req.params.id,next,req.user,{manual:true});v400ApplyOrderStage(req.params.id,next);res.json({ok:true,order:result});",
 "const next=String(req.body?.stage||'');const {result,receipt}=await v400CommitAction(req,next,()=>V400.advance(req.params.id,next,req.user,{manual:true}));res.json({ok:true,order:result,receipt});",
 'advance-commit');
 const originalSubmit="app.post('/api/kim400/orders/:id/vendor/submit',auth,requireCapability('vendor.submit'),(req,res)=>{try{const provider=String(req.body?.provider||'');if(!v400VendorReady(provider))return res.status(409).json({error:'Live vendor submission is fail-closed until provider credentials/endpoints are verified.'});const staged=V400.markVendorReady(req.params.id,provider,req.user);const vendor=V400.submitVendor(req.params.id,req.body?.vendorOrderId||'',req.user);v400ApplyOrderStage(req.params.id,'VENDOR_SUBMITTED');res.json({ok:true,provider,vendor});}catch(e){res.status(400).json({error:e.message})}});";
 const safeSubmit="app.post('/api/kim400/orders/:id/vendor/submit',auth,requireCapability('vendor.submit'),async(req,res)=>{try{const provider=String(req.body?.provider||'');const vendorOrderId=String(req.body?.vendorOrderId||'').trim();if(!v400VendorReady(provider))return res.status(409).json({ok:false,error:'Provider is not externally verified READY. No vendor order was placed.'});if(!SBC_V66138_FULFILLMENT_TRUTH.validReceipt(vendorOrderId))return res.status(422).json({ok:false,error:'REAL_VENDOR_ORDER_REFERENCE_REQUIRED'});const {result:{vendor},receipt}=await v400CommitAction(req,'VENDOR_SUBMITTED',()=>{V400.markVendorReady(req.params.id,provider,req.user);const vendor=V400.submitVendor(req.params.id,vendorOrderId,req.user);return {vendor}});res.json({ok:true,provider,vendor,receipt,providerSubmissionPerformed:false,manualReceipt:true});}catch(e){res.status(409).json({ok:false,error:String(e.code||e.message),durable:false})}});";
 s=once(s,originalSubmit,safeSubmit,'submit-is-manual-evidence-only');
 const ship="app.post('/api/kim400/orders/:id/shipping',auth,requireCapability('fulfillment.manage'),(req,res)=>{try{const shipping=V400.shipping(req.params.id,req.body||{},req.user);v400ApplyOrderStage(req.params.id,'SHIPPED');res.json({ok:true,shipping});}catch(e){res.status(400).json({error:e.message})}});";
 const safeShip="app.post('/api/kim400/orders/:id/shipping',auth,requireCapability('fulfillment.manage'),async(req,res)=>{try{const {result:shipping,receipt}=await v400CommitAction(req,'SHIPPED',()=>V400.shipping(req.params.id,req.body||{},req.user));res.json({ok:true,shipping,receipt});}catch(e){res.status(409).json({ok:false,error:String(e.code||e.message),durable:false})}});";
 s=once(s,ship,safeShip,'shipping-commit');
 const del="app.post('/api/kim400/orders/:id/deliver',auth,requireCapability('fulfillment.manage'),(req,res)=>{try{const shipping=V400.deliver(req.params.id,req.user);v400ApplyOrderStage(req.params.id,'DELIVERED');res.json({ok:true,shipping});}catch(e){res.status(400).json({error:e.message})}});";
 const safeDel="app.post('/api/kim400/orders/:id/deliver',auth,requireCapability('fulfillment.manage'),async(req,res)=>{try{const {result:shipping,receipt}=await v400CommitAction(req,'DELIVERED',()=>V400.deliver(req.params.id,req.user,req.body?.evidence||req.body||{}));res.json({ok:true,shipping,receipt});}catch(e){res.status(409).json({ok:false,error:String(e.code||e.message),durable:false})}});";
 s=once(s,del,safeDel,'delivery-commit');
 return s;
}
if(require.main===module){
 const file=path.resolve(__dirname,'../server.js');
 const original=fs.readFileSync(file,'utf8'),patched=patchServer(original);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66138_ISOLATED_STAGE!=='YES')throw Error('FULFILLMENT_DISPOSABLE_STAGE_ONLY');
  fs.writeFileSync(file,patched);
  console.log('[SBC V66.138] staged signed fulfillment status receipts and provider truth');
 }else console.log('[SBC V66.138] anchor validation PASS; no source changes');
}
module.exports={patchServer,MARK};
