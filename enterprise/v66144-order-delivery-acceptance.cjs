'use strict';
/* Owner-only customer delivery audit over already-owned evidence.
 * Does not schedule, charge, fulfill, email, provision, or mark order delivered.
 */
const PAYMENT=require('./v6640-payment-evidence.cjs');
const QA=require('./sbc-revenue-reporting-truth-v66142.cjs');
const RECEIPT=require('./v66138-fulfillment-truth.cjs');
const BUNDLE=require('./v66140-fulfillment-bundle-coverage.cjs');
const PRINT=require('./v66117-print-fulfillment-truth.cjs');
const {officePlanLine}=require('./v66120-officebox-commerce-boundary.cjs');
function officeBox(order,components){
 const n=QA.parseNotes(order);
 if(n.officeBoxSku||n.officeBoxPlan||n.officeBoxSubscriptionId||officePlanLine({name:order?.product||''}))return true;
 return (Array.isArray(components)?components:[]).some(officePlanLine);
}
function printOrder(order,components,jobs){
 const label=String(order?.product||'');
 const names=(Array.isArray(components)?components:[]).map(c=>String(c?.name||'')).join(' | ');
 return PRINT.jobIsPrint({product:label+' '+names})||
  (Array.isArray(jobs)?jobs:[]).some(PRINT.jobIsPrint);
}
function inspect({tenantId,order,customer,components=[],jobs=[],committedOrder=null,fulfillment=null}={}){
 const t=Number(tenantId);
 if(!Number.isSafeInteger(t)||t<1)throw Object.assign(Error('TENANT_REQUIRED'),{status:403});
 if(!order||Number(order.tenantId??order.tenant_id)!==t)throw Object.assign(Error('TENANT_ORDER_NOT_FOUND'),{status:404});
 const id=String(order.id||''),qa=QA.isQaOrder(order,customer);
 const customerMatch=!!customer&&Number(customer.tenantId??customer.tenant_id)===t&&String(customer.id)===String(order.customerId);
 const durable=!!committedOrder&&String(committedOrder.id)===id&&
  String(committedOrder.customer_id)===String(order.customerId)&&
  String(committedOrder.status||'')===String(order.status||'')&&
  String(committedOrder.fulfillment_status||'')===String(order.fulfillmentStatus||'');
 const paid=!qa&&PAYMENT.providerCapturedSquare(order);
 const box=officeBox(order,components);
 const isPrint=printOrder(order,components,jobs);
 const parts=Array.isArray(components)?components:[];
 const lines=Array.isArray(jobs)?jobs.filter(j=>Number(j?.tenantId??j?.tenant_id??t)===t):[];
 const packageUnmapped=BUNDLE.needsMapping(order,parts);
 const multi=parts.length>1&&!packageUnmapped?BUNDLE.summary({components:parts,jobs:lines}):null;
 const validVendorReceipts=lines.filter(j=>PRINT.validVendorOrderId(j.vendor_order_number??j.vendorOrderNumber)).length;
 const proof=fulfillment?.deliveryEvidence;
 const deliveryEvidence=RECEIPT.validDelivery(proof);
 const digitalActivation=deliveryEvidence&&proof.type==='digital_activation';
 const deliveredInDatabase=['Delivered','Fulfilled'].includes(String(committedOrder?.fulfillment_status||''))&&
  ['Delivered','In Progress','Paid'].includes(String(committedOrder?.status||''));
 const expectedProviderAction=box?'Verify recurring billing in Office Box subscription ledger':
  isPrint?'Review real supplier order reference, carrier tracking and receipt':
  'Verify deployed digital asset and owner/customer acceptance';
 const checks=[
  {id:'tenant_customer',passed:customerMatch,detail:customerMatch?'CUSTOMER_LINK_FOUND':'CUSTOMER_LINK_MISSING'},
  {id:'sql_commit',passed:durable,detail:durable?'MYSQL_READBACK_MATCH':'ORDER_SQL_READBACK_REQUIRED'},
  {id:'payment',passed:paid,detail:paid?'SBC_SQUARE_CAPTURE_METADATA':'PROVIDER_PAYMENT_PROOF_REQUIRED'},
  {id:'qa_exclusion',passed:!qa,detail:qa?'INTERNAL_QA_NOT_CUSTOMER_REVENUE':'REAL_ORDER_RECORD'},
  {id:'component_mapping',passed:!packageUnmapped,detail:packageUnmapped?'BUNDLE_RECIPE_MAPPING_REQUIRED':'COMPONENTS_IDENTIFIED'},
  {id:'bundle_completion',passed:!multi||multi.ready,detail:multi?multi.status:'NO_MULTILINE_COMPLETION_ASSERTED'},
  {id:'delivery_receipt',passed:deliveryEvidence,detail:deliveryEvidence?String(proof.type):'REAL_DELIVERY_PROOF_REQUIRED'},
  {id:'fulfillment_readback',passed:deliveredInDatabase,detail:deliveredInDatabase?'MYSQL_DELIVERED_STAGE_MATCH':'MYSQL_DELIVERED_STAGE_UNCONFIRMED'}
 ];
 // A signed handoff and a one-time payment never prove a recurring subscription.
 if(box)checks.push({id:'recurring_entitlement',passed:false,detail:'OFFICEBOX_PROVIDER_PERIOD_AND_TENANT_READBACK_REQUIRED'});
 if(isPrint)checks.push({id:'supplier_receipt',passed:validVendorReceipts>0,detail:validVendorReceipts?'REAL_REFERENCE_RECORDED':'VENDOR_ORDER_REFERENCE_REQUIRED'});
 if(!isPrint&&!box)checks.push({id:'digital_activation',passed:digitalActivation,detail:digitalActivation?'DIGITAL_PROOF_RECORDED':'DIGITAL_ACTIVATION_EVIDENCE_REQUIRED'});
 const complete=checks.every(x=>x.passed);
 const blockers=checks.filter(x=>!x.passed).map(x=>x.detail);
 return {ok:true,readOnly:true,productionCertified:false,orderId:id,tenantId:t,
  orderLabel:String(order.product||'').slice(0,140),officeBox:box,print:isPrint,
  evidence:{payment:'SBC_STORED_METADATA_NOT_BANK_STATEMENT',sqlCommitted:durable,
   recordedSupplierOrderNumbers:validVendorReceipts,
   deliveryProof:deliveryEvidence?{type:proof.type,reference:String(proof.reference)}:null,
   bundle:multi},
  checks,blockers,recordedWorkflowComplete:complete,
  providerReadbackIndependent:false,customerConfirmedIndependently:false,
  nextAction:blockers.length?blockers[0]:expectedProviderAction,
  note:'Recorded completion is a preflight, not independent payment settlement, supplier delivery, Office Box recurring entitlement or the customer accepting delivery. The owner must separately validate real provider and customer receipts.'};
}
module.exports={inspect,officeBox,printOrder};
