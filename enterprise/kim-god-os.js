'use strict';

const crypto = require('crypto');

const VERSION = '1.1.0';
const TERMINAL = new Set(['COMPLETED','CANCELLED','FAILED']);
const STAGES = ['INTAKE','PAYMENT_PENDING','PAID','FULFILLMENT_READY','FULFILLING','SHIPPED','COMPLETED'];

function now(){ return new Date().toISOString(); }
function id(prefix='god'){ return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }
function low(v){ return String(v||'').toLowerCase(); }
function paid(order){ return low(order?.paymentStatus)==='paid' || low(order?.status)==='paid'; }
function externalReady(caps, vendor){
  const x=caps?.[vendor] || caps?.[String(vendor||'').toLowerCase()];
  return Boolean(x?.configured && x?.autoExecute);
}
function providerForOrder(order){
  const text=low(`${order?.product||''} ${order?.notes||''}`);
  if(/domain|hosting|microsoft|email/.test(text)) return 'godaddy';
  if(/vistaprint/.test(text)) return 'vistaprint';
  if(/4over4|print|business card|flyer|brochure/.test(text)) return '4over4';
  return 'internal';
}
function estimate(provider, order, vendorResult){
  if(vendorResult?.eta) return {kind:'vendor',value:String(vendorResult.eta),source:'vendor'};
  if(vendorResult?.estimatedDelivery) return {kind:'vendor',value:String(vendorResult.estimatedDelivery),source:'vendor'};
  const days = provider==='internal' ? 0 : provider==='godaddy' ? 1 : 5;
  const d=new Date(Date.now()+days*86400000);
  return {kind:'estimate',value:d.toISOString(),source:'SBC estimate',disclaimer:'Estimated until the external provider returns a confirmed delivery date.'};
}
function capabilityFor(caps, vendor){
  const keyMap={godaddy:['godaddy'],fourOverFour:['fourOverFour','4over4'],vistaprint:['vistaprint'],internal:['internal']};
  for(const key of (keyMap[vendor]||[vendor])) if(caps?.[key]) return caps[key];
  return {};
}
function validateCustomerAndPackage(order, db, catalog){
  const customer=(db?.customers||[]).find(c=>String(c.id)===String(order.customerId));
  if(!customer) return {ok:false,code:'CUSTOMER_NOT_FOUND',message:'Customer record could not be verified.'};
  const parsed=typeof order.notes==='string' ? (()=>{try{return JSON.parse(order.notes)||{}}catch{return {}}})() : (order.notes||{});
  const items=Array.isArray(parsed.items)?parsed.items:[];
  const packages=Array.isArray(catalog?.packages)?catalog.packages:[];
  const services=Array.isArray(catalog?.services)?catalog.services:[];
  let expected=null;
  if(parsed.bundleId){const pkg=packages.find(x=>String(x.id)===String(parsed.bundleId)); if(pkg) expected=Number(pkg.price);}
  if(expected===null && items.length){
    const catalogItems=items.map(item=>{const x=[...packages,...services].find(v=>String(v.id)===String(item.id)); return x?Number(x.price):Number(item.unitPrice);});
    if(catalogItems.every(Number.isFinite)) expected=items.reduce((sum,item,i)=>sum+catalogItems[i]*Math.max(1,Number(item.qty||1)),0);
  }
  const actual=Number(order.price);
  if(!Number.isFinite(actual)||actual<=0) return {ok:false,code:'INVALID_PRICE',message:'Order price is missing or invalid.'};
  if(expected!==null){
    const discount=Math.max(0,Number(parsed.discount||0)); const tax=Math.max(0,Number(parsed.tax||0)); const expectedTotal=Number((Math.max(0,expected-discount)+tax).toFixed(2));
    if(Math.abs(expectedTotal-actual)>0.01) return {ok:false,code:'PRICE_MISMATCH',message:`Order price ${actual.toFixed(2)} does not match the verified catalog/package total ${expectedTotal.toFixed(2)}.`};
  }
  const product=String(order.product||parsed.bundleName||'').trim();
  if(!product) return {ok:false,code:'PACKAGE_NOT_VERIFIED',message:'Order package/product could not be verified.'};
  return {ok:true,customerId:customer.id,package:product,price:actual};
}
function exceptionPayload(traceId, order, provider, reason, jobs=[], validation={}){
  return {type:'ORDER_EXCEPTION',traceId,orderId:order.id,stage:'FULFILLMENT_READY',payment:'CONFIRMED',order:'CREATED',fulfillment:jobs.length?'CREATED':'NOT_CREATED',vendorSubmission:'BLOCKED',reason,customerMoney:'SAFE',orderState:'SAFE',nextAction:'Owner approval or provider configuration is required before external submission.',provider,validation,jobs:jobs.map(j=>({id:j.id,vendor:j.vendor,status:j.status,vendorStatus:j.vendorStatus,lastError:j.lastError||''}))};
}
function buildReceipt(order, stage, delivery, jobs=[]){
  return {
    receiptId:id('receipt'),
    orderId:order.id,
    customerId:order.customerId||'',
    customerName:order.customerName||'Customer',
    product:order.product||'',
    amount:Number(order.price||0),
    currency:'USD',
    paymentStatus:paid(order)?'PAID':'PENDING',
    fulfillmentStatus:stage,
    deliveryEstimate:delivery,
    fulfillmentJobs:jobs.map(j=>({id:j.id,status:j.status,vendor:j.vendor,vendorOrderNumber:j.vendorOrderNumber||'',trackingNumber:j.trackingNumber||''})),
    generatedAt:now(),
    truthGate:'Receipt never claims external fulfillment or delivery unless supported by verified job/vendor state.'
  };
}

async function orchestrate({order, requestUser, createFulfillmentJobsForOrder, processReadyFulfillmentJobs, vendorCapabilities, addActivity, audit, saveData, db, catalog, sendCustomerStatus, testMode=false}){
  if(!order) throw new Error('Order is required.');
  const started=Date.now(), traceId=id('gk'), steps=[];
  const validation=validateCustomerAndPackage(order,db,catalog);
  if(!validation.ok){
    const result={ok:false,traceId,stage:'BLOCKED',provider:providerForOrder(order),steps,exception:exceptionPayload(traceId,order,providerForOrder(order),validation.message,[],validation),elapsedMs:Date.now()-started};
    if(audit) audit(requestUser||{id:'godkim',name:'GodKim'},'godkim_order_exception',`GodKim blocked ${order.id}: ${validation.code}`,{orderId:order.id,traceId,code:validation.code});
    return result;
  }
  const caps=typeof vendorCapabilities==='function'?vendorCapabilities():{};
  const provider=providerForOrder(order);
  steps.push({stage:'INTAKE',status:'VERIFIED',at:now(),customer:validation.customerId,package:validation.package,price:validation.price});
  if(!paid(order)){
    const result={ok:true,traceId,stage:'PAYMENT_PENDING',provider,steps,receipt:null,blockedReason:'Verified payment is required before fulfillment.',elapsedMs:Date.now()-started};
    if(addActivity) addActivity('godkim_orchestration',`GodKim held ${order.id} at payment gate`,{orderId:order.id,traceId,stage:result.stage});
    return result;
  }
  steps.push({stage:'PAID',status:'VERIFIED',at:now()});
  let jobs=[];
  if(testMode){
    jobs=[{id:id('testjob'),orderId:order.id,vendor:'internal-test',status:'completed',vendorStatus:'SIMULATED_COMPLETE',vendorOrderNumber:`TEST-${order.id}`,trackingNumber:'TEST-TRACKING'}];
  }else{
    jobs=await createFulfillmentJobsForOrder(order);
    steps.push({stage:'FULFILLMENT_READY',status:'CREATED',jobCount:jobs.length,at:now()});
    const blockedProviders=jobs.filter(j=>{const c=capabilityFor(caps,j.vendor);return j.vendor!=='internal' && !(c.configured&&c.autoExecution);});
    if(blockedProviders.length){
      const reason=`${blockedProviders.map(j=>j.vendor).filter((v,i,a)=>a.indexOf(v)===i).join(', ')} automatic execution is not enabled.`;
      const delivery=estimate(provider,order,blockedProviders[0]);
      const receipt=buildReceipt(order,'FULFILLMENT_READY',delivery,jobs);
      const exception=exceptionPayload(traceId,order,provider,reason,jobs,validation);
      order.godKimTraceId=traceId;order.godKimStage='FULFILLMENT_READY';order.godKimReceiptId=receipt.receiptId;order.godKimException=exception;order.godKimUpdatedAt=now();order.fulfillmentStatus='Ready for Fulfillment';order.updatedAt=now();
      if(addActivity) addActivity('godkim_order_exception',`GodKim blocked external submission for ${order.id}`,{orderId:order.id,traceId,provider,reason});
      if(audit) audit(requestUser||{id:'godkim',name:'GodKim'},'godkim_order_exception',`GodKim blocked external submission for ${order.id}`,exception);
      if(saveData) await saveData();
      if(sendCustomerStatus && !order.godKimStatusSentAt){try{await sendCustomerStatus(order,customerStatusMessage(order,{exception,receipt}));order.godKimStatusSentAt=now();if(saveData)await saveData();}catch(e){if(addActivity)addActivity('godkim_notification_error',`GodKim status notification failed for ${order.id}: ${e.message}`,{orderId:order.id,traceId});}}
      return {ok:true,traceId,stage:'FULFILLMENT_READY',provider,steps,exception,receipt,jobs,elapsedMs:Date.now()-started,externalExecution:false};
    }
    await processReadyFulfillmentJobs();
    const fresh=(db.fulfillmentJobs||[]).filter(j=>String(j.orderId)===String(order.id));
    jobs=fresh.length?fresh:jobs;
  }
  const blocked=jobs.filter(j=>['waiting_vendor_credentials','ready_for_owner','blocked','failed','manual','manual_required','owner_clearance_required','provider_mapping_required','needs_reconciliation'].includes(low(j.status)) || ['waiting_vendor_credentials','ready_for_owner','blocked','failed','manual','manual_required','owner_clearance_required','provider_mapping_required','submission_outcome_unknown'].includes(low(j.vendorStatus)));
  const completed=jobs.length>0 && jobs.every(j=>['completed','complete','fulfilled','delivered'].includes(low(j.status)) && (!j.vendorStatus||['completed','complete','fulfilled','delivered'].includes(low(j.vendorStatus))));
  const allDone=testMode || (completed && blocked.length===0);
  const currentStage=allDone?'COMPLETED':blocked.length?'FULFILLMENT_READY':'FULFILLING';
  steps.push({stage:currentStage,status:allDone?'COMPLETE':blocked.length?'BLOCKED':'IN_PROGRESS',at:now()});
  const delivery=estimate(provider,order,jobs[0]);
  const receipt=buildReceipt(order,currentStage,delivery,jobs);
  const result={ok:true,traceId,stage:currentStage,provider,steps,jobs,receipt,elapsedMs:Date.now()-started,externalExecution:!testMode};
  if(order){order.godKimTraceId=traceId;order.godKimStage=currentStage;order.godKimReceiptId=receipt.receiptId;order.godKimUpdatedAt=now();order.godKimException=null;order.fulfillmentStatus=currentStage==='COMPLETED'?'Completed':currentStage;order.updatedAt=now();}
  if(addActivity) addActivity('godkim_orchestration',`GodKim orchestration ${currentStage.toLowerCase()} for ${order.id}`,{orderId:order.id,traceId,provider,stage:currentStage,jobCount:jobs.length,testMode});
  if(audit) audit(requestUser||{id:'godkim',name:'GodKim'},'godkim_orchestration',`GodKim orchestrated ${order.id} → ${currentStage}`,{orderId:order.id,traceId,provider,testMode});
  if(saveData) await saveData();
  if(sendCustomerStatus && !order.godKimStatusSentAt && currentStage==='COMPLETED'){try{await sendCustomerStatus(order,customerStatusMessage(order,result));order.godKimStatusSentAt=now();if(saveData)await saveData();}catch(e){if(addActivity)addActivity('godkim_notification_error',`GodKim status notification failed for ${order.id}: ${e.message}`,{orderId:order.id,traceId});}}
  return result;
}

function customerStatusMessage(order, result){
  const r=result?.receipt||{};
  if(result?.exception){
    return {subject:`SBC Payment Received — Order ${order.id}`,body:`Your payment has been confirmed for ${order.product||'your SBC order'}.\n\nOrder: ${order.id}\nPayment: CONFIRMED\nFulfillment: READY\nDelivery: Pending fulfillment configuration\n\nYour order and payment are safe. SBC will continue fulfillment once the required provider is authorized.\n\nThank you for choosing Successful By Choice.`};
  }
  return {subject:`SBC Order Confirmation — ${order.id}`,body:`Thank you for your order with Successful By Choice.\n\nOrder: ${order.id}\nItem: ${order.product||'SBC Service'}\nAmount: $${Number(order.price||0).toFixed(2)}\nPayment: ${r.paymentStatus||'PAID'}\nFulfillment: ${r.fulfillmentStatus||result.stage}\nDelivery estimate: ${r.deliveryEstimate?.value||'Pending'}\n\nWe will update you as fulfillment progresses.`};
}

function brief({db={},health={},capabilities={}}={}){
  const orders=Array.isArray(db.orders)?db.orders:[];
  const paidOrders=orders.filter(paid);
  const open=orders.filter(o=>!['completed','cancelled','fulfilled'].includes(low(o.status)));
  const external={};
  for(const v of ['godaddy','4over4','vistaprint']) external[v]={configured:Boolean(capabilities[v]?.configured),autoExecute:Boolean(capabilities[v]?.autoExecute),status:capabilities[v]?.status||'STANDBY'};
  return {version:VERSION,mode:'GodKim',principle:'Observe → verify → orchestrate → verify → report',metrics:{orders:orders.length,paidOrders:paidOrders.length,openOrders:open.length,overdueActions:Number(health.overdueActions||0)},external,truthGate:'Never claim a vendor purchase, shipment, tracking number, payment, or delivery date without verified evidence.'};
}

module.exports={VERSION,STAGES,orchestrate,brief,providerForOrder,buildReceipt};
