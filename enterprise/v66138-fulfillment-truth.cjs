'use strict';
/* SBC V66.138: authoritative fulfillment status receipt. No supplier calls. */
const STATUS=Object.freeze({
 PAID:['Paid','Ready for Fulfillment'],
 INTAKE:['Paid','Fulfillment Intake'],
 ASSET_REQUIRED:['Paid','Awaiting Assets'],
 PREFLIGHT:['Paid','Preflight'],
 PROOF_PENDING:['Paid','Proof Pending'],
 PROOF_APPROVED:['Paid','Proof Approved'],
 PRODUCTION_READY:['Paid','Ready for Production'],
 VENDOR_STAGED:['Paid','Vendor Staged'],
 VENDOR_SUBMITTED:['In Progress','Submitted to Vendor'],
 IN_PRODUCTION:['In Progress','In Production'],
 SHIPPED:['Dispatched','Shipped'],
 DELIVERED:['Delivered','Delivered'],
 FULFILLED:['Delivered','Fulfilled'],
 BLOCKED:['Paid','Fulfillment Blocked']
});
function fail(code){const e=new Error(code);e.code=code;return e;}
function validReceipt(raw){
 const s=String(raw||'').trim();
 return /^[A-Za-z0-9][A-Za-z0-9._:/#-]{3,119}$/.test(s)&&
  !/^(?:test(?:ing)?|demo|fake|pending|unknown|none|n\/a|tbd|no.?order|manual[-_]\d+|placeholder)(?:[-_:].*)?$/i.test(s);
}
function requireReceipt(raw){if(!validReceipt(raw))throw fail('REAL_VENDOR_ORDER_REFERENCE_REQUIRED');return String(raw).trim();}
function validShipping(carrier,number){
 const c=String(carrier||'').trim(),n=String(number||'').trim();
 return c.length>=2&&c.length<=100&&n.length>=6&&n.length<=150&&/^[A-Za-z0-9_-]+$/.test(n)
  &&!/^(test|demo|fake|unknown|pending|none|na|notavailable|tbd|placeholder)/i.test(n);
}
function validDelivery(input){
 const p=input&&typeof input==='object'?input:{};
 return ['carrier_delivered','customer_confirmed','owner_verified_pickup','digital_activation'].includes(String(p.type||''))&&
  validReceipt(p.reference)&&
  typeof p.confirmedAt==='string'&&Number.isFinite(Date.parse(p.confirmedAt))&&
  Date.parse(p.confirmedAt)<=Date.now()+300000;
}
async function commitStage({order,stage,pool,saveData,paid,stamp=new Date().toISOString()}={}){
 const vals=STATUS[String(stage||'')];
 if(!vals)throw fail('FULFILLMENT_STAGE_INVALID');
 const tid=Number(order?.tenantId??order?.tenant_id);
 if(!order||!String(order.id||'')||!Number.isSafeInteger(tid)||tid<1)throw fail('FULFILLMENT_TENANT_ORDER_REQUIRED');
 if(typeof paid!=='function'||paid(order)!==true)throw fail('PAYMENT_EVIDENCE_REQUIRED');
 if(!pool||typeof pool.query!=='function'||typeof saveData!=='function')throw fail('FULFILLMENT_AUTHORITATIVE_WRITER_REQUIRED');
 const before={status:order.status,fulfillmentStatus:order.fulfillmentStatus,updatedAt:order.updatedAt};
 try {
  order.status=vals[0];order.fulfillmentStatus=vals[1];order.updatedAt=stamp;
  const result=await saveData();
  if(result?.skipped===true)throw fail('FULFILLMENT_WRITER_READ_ONLY');
  const [rows]=await pool.query(
   'SELECT status,fulfillment_status FROM sbc_orders WHERE id=? AND tenant_id=? LIMIT 1',
   [String(order.id),tid]);
  const live=Array.isArray(rows)?rows[0]:null;
  if(!live||String(live.status)!==vals[0]||String(live.fulfillment_status)!==vals[1])
   throw fail('FULFILLMENT_COMMIT_READBACK_MISMATCH');
  return {ok:true,durable:true,orderId:String(order.id),stage:String(stage),status:live.status,fulfillmentStatus:live.fulfillment_status};
 }catch(e){
  Object.assign(order,before);
  throw e;
 }
}
module.exports={STATUS,validReceipt,requireReceipt,validShipping,validDelivery,commitStage};
