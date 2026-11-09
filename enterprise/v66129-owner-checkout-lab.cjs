'use strict';
/* SBC V66.129 · Owner Checkout Lab
 * Quarantined ZERO-DOLLAR internal test checkout. Never represents paid
 * revenue, a provider subscription, or permission to place a vendor order.
 */
const KIND='SBC_OWNER_ZERO_DOLLAR_CHECKOUT_QA_V1';
const STEPS=Object.freeze(['PLACED','READY_FOR_MANUAL_REVIEW','COMPLETED']);
const ID=/^[a-zA-Z0-9._:-]{8,120}$/;
const PRODUCT_ID=/^[a-zA-Z0-9._:-]{2,120}$/;
function fail(code,status=422){throw Object.assign(Error(code),{code,status})}
function price(product){
 const n=Number(product?.price);
 if(!product||!PRODUCT_ID.test(String(product.id||''))||!Number.isFinite(n)||n<=0||n>100000||Math.round(n*100)!==n*100)
  fail('QA_PRODUCT_PRICE_INVALID');
 return Math.round(n*100);
}
function catalog(source){
 return [...(source?.packages||[]),...(source?.services||[])]
  .filter(x=>x&&!x.testOnly&&!/launch qa|qa test/i.test(String(x.id||'')+' '+String(x.name||'')))
  .map(x=>{try{return {id:String(x.id),name:String(x.name||'').slice(0,140),
   category:String(x.category||'').slice(0,60),listPriceCents:price(x),
   recurring:/office[\s_-]?box/i.test(String(x.name||'')+' '+String(x.id||''))||String(x.unit||'')==='month'}
  }catch{return null}}).filter(Boolean);
}
function parse(order){
 let n={};try{n=JSON.parse(String(order?.notes||'{}'))}catch{}
 return n&&typeof n==='object'&&!Array.isArray(n)?n:{};
}
function isLab(order){const l=parse(order).ownerCheckoutLab;return l?.kind===KIND}
function publicRecord(order){
 const n=parse(order).ownerCheckoutLab;
 if(n?.kind!==KIND)fail('QA_NOT_LAB_ORDER',404);
 return {id:String(order.id),productId:String(n.productId),product:String(order.product),
  listPriceCents:Number(n.listPriceCents),discountCents:Number(n.discountCents),totalCents:0,
  quantity:1,kind:KIND,stage:String(n.stage),fulfillment:String(order.fulfillmentStatus||''),
  paymentStatus:'NOT_APPLICABLE_ZERO_DOLLAR_QA',customerName:String(order.customerName),
  recurringPlanTest:Boolean(n.recurringPlanTest),providerChargeCents:0,
  providerSubscriptionActivated:false,vendorOrderSubmitted:false,
  manualCompletionBy:n.completedBy?String(n.completedBy):null,
  createdAt:String(order.createdAt||''),updatedAt:String(order.updatedAt||'')};
}
function create({tenantId,product,requestId,actor,orderId,at,customerName}){
 const t=Number(tenantId),p=product;
 if(!Number.isSafeInteger(t)||t<1)fail('QA_TENANT_REQUIRED',403);
 if(!ID.test(String(requestId||''))||!ID.test(String(orderId||'')))fail('QA_IDENTIFIERS_INVALID');
 if(!actor||String(actor.role)!=='owner'||!String(actor.id||''))fail('QA_OWNER_REQUIRED',403);
 const cents=price(p),itemName=String(p.name||'').trim().slice(0,140);
 if(!itemName)fail('QA_PRODUCT_INVALID');
 if(!String(customerName||'').trim()||String(customerName).length>100)fail('QA_TEST_CUSTOMER_REQUIRED');
 const recurring=/office[\s_-]?box/i.test(String(itemName)+' '+String(p.id||''))||String(p.unit||'')==='month';
 const record={id:String(orderId),tenantId:t,customerId:'',customerName:String(customerName),
   product:itemName,quantity:1,status:'QA TEST',cost:0,price:0,
   paymentStatus:'NOT_APPLICABLE_ZERO_DOLLAR_QA',
   fulfillmentStatus:'QA - Awaiting Manual Review',
   notes:JSON.stringify({ownerCheckoutLab:{kind:KIND,requestId:String(requestId),
    productId:String(p.id),listPriceCents:cents,discountCents:cents,
    totalCents:0,discountPercent:100,stage:STEPS[0],
    recurringPlanTest:recurring,createdBy:String(actor.id),
    activity:[{stage:STEPS[0],at:String(at),actor:String(actor.id)}]}}),
   createdAt:String(at),updatedAt:String(at)};
 return record;
}
function next(order,{stage,actor,at,confirm}){
 if(!isLab(order))fail('QA_NOT_LAB_ORDER',404);
 const mark=String(stage||''),a=String(actor?.id||''),n=parse(order);
 if(String(actor?.role)!=='owner'||!a)fail('QA_OWNER_REQUIRED',403);
 if(!STEPS.includes(mark))fail('QA_STAGE_INVALID');
 const current=STEPS.indexOf(String(n.ownerCheckoutLab.stage));
 const wanted=STEPS.indexOf(mark);
 if(wanted===current)return {order,unchanged:true};
 if(wanted!==current+1)fail('QA_STAGE_SEQUENCE_REQUIRED',409);
 if(mark==='COMPLETED'&&confirm!=='MARK_TEST_FULFILLMENT_COMPLETE')
  fail('QA_EXPLICIT_MANUAL_CONFIRMATION_REQUIRED',409);
 const nextNotes={...n,ownerCheckoutLab:{...n.ownerCheckoutLab,stage:mark,
  activity:[...(n.ownerCheckoutLab.activity||[]),{stage:mark,at:String(at),actor:a}]}};
 if(mark==='COMPLETED')nextNotes.ownerCheckoutLab.completedBy=a;
 return {order:{...order,notes:JSON.stringify(nextNotes),updatedAt:String(at),
  status:mark==='COMPLETED'?'QA TEST COMPLETED':'QA TEST',
  fulfillmentStatus:mark==='COMPLETED'?'QA - Manually Completed': 'QA - Manual Review Ready'},
  unchanged:false};
}
module.exports={KIND,STEPS,catalog,parse,isLab,publicRecord,create,next};
