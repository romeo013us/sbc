'use strict';
/**
 * Compiler-only owner QA route. Injected into the reconstructed runtime.
 * Does NOT create a payment link or send an external request.
 * No new env secrets, no migrations, no autonomous payment actions.
 */
const SOURCE=String.raw\`
app.post('/api/owner/launch-qa/create-order',auth,ownerOnly,async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(SBC_RUNTIME_READ_ONLY||sbcShutdownStarted||!mysqlPool||
    !MYSQL_RECOVERY_EVALUATED||MYSQL_RECOVERY_REQUIRED||!sbcWriterLeaseReady||
    RUNTIME_GATE.blocked('NEW_CHECKOUTS'))
  return res.status(423).json({ok:false,code:'LAUNCH_QA_WRITER_OR_CHECKOUT_LOCKED'});
 let tenantId;
 try{tenantId=requireRequestTenant(req)}catch(_){
  return res.status(403).json({ok:false,code:'LAUNCH_QA_TENANT_REQUIRED'});
 }
 const email=String(req.body?.email||'').trim().toLowerCase();
 if(email.length>254||!/^\\S+@\\S+\\.\\S+$/.test(email)||
    email.endsWith('.invalid')||email.endsWith('.test'))
  return res.status(400).json({ok:false,code:'LAUNCH_QA_CONTROLLED_EMAIL_REQUIRED'});
 // One test per tenant and owner-provided email: cannot accidentally mint
 // another charge by retrying after an ambiguous response.
 const existing=(db.orders||[]).find(o=>Number(o.tenantId)===tenantId&&
  String(o.product||'')==='SBC Launch QA - $1 Test Service'&&
  orderParsed(o).sbcLaunchQa?.kind==='OWNER_ONLY_ONE_DOLLAR_CHECKOUT'&&
  (db.customers||[]).some(c=>String(c.id)===String(o.customerId)&&
    Number(c.tenantId)===tenantId&&String(c.email||'').toLowerCase()===email));
 if(existing)return res.json({ok:true,existing:true,orderId:existing.id,
  customerId:existing.customerId,amountCents:100,
  paymentStatus:existing.paymentStatus||'Pending',paymentUrl:existing.paymentUrl||'',
  next:'Reuse the existing order. Never issue a second checkout automatically.'});
 const t=now();
 const customer={id:id('cust'),tenantId,businessName:'SBC Launch QA Test Customer',
  contactName:'Owner Internal Test',email,phone:'',status:'Internal Test',
  source:'Owner Launch QA',notes:'Internal test: no vendor fulfillment or follow-up automation',
  createdAt:t,updatedAt:t};
 const order={id:id('ord'),tenantId,customerId:customer.id,
  customerName:customer.businessName,product:'SBC Launch QA - $1 Test Service',
  quantity:1,status:'New',cost:0,price:1,
  notes:JSON.stringify({sbcLaunchQa:{kind:'OWNER_ONLY_ONE_DOLLAR_CHECKOUT',version:1},
   items:[{id:'SBC_LAUNCH_QA_1USD',sku:'SBC_LAUNCH_QA_1USD',
    name:'SBC Launch QA',qty:1,unitPrice:1}],
   customerEmail:email,fulfillmentStatus:'QA - NO VENDOR FULFILLMENT'}),
  launchQaOwnerCreated:true,paymentStatus:'Pending',
  fulfillmentStatus:'QA - NO VENDOR FULFILLMENT',createdAt:t,updatedAt:t};
 db.customers.unshift(customer);db.orders.unshift(order);
 addActivity('launch_qa_order_created','Owner created controlled $1 Square checkout test',
  {orderId:order.id,customerId:customer.id,amountCents:100});
 try{await saveData()}catch(_){
  return res.status(503).json({ok:false,code:'LAUNCH_QA_SAVE_UNCONFIRMED',
   orderId:order.id,automaticRetry:false,
   error:'Persistence uncertain; verify existing order before retry.'});
 }
 return res.status(201).json({ok:true,existing:false,orderId:order.id,
  customerId:customer.id,amountCents:100,paymentStatus:'Pending',
  next:'/api/payments/square/create-link/'+encodeURIComponent(order.id),
  note:'Owner must generate checkout explicitly. This endpoint does not charge.'});
});
\`;
module.exports={SOURCE};
