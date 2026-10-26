'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6645_SQUARE_PAYMENT_PROOF_AND_READINESS';
function once(s,from,to,label){
 const n=s.split(from).length-1;
 if(n!==1)throw Error(MARKER+': '+label+' anchor count '+n);
 return s.replace(from,to);
}
function apply(root){
 const file=path.join(root,'server.js');
 const original=path.join(__dirname,'../enterprise/v6645-square-checkout-safety.cjs');
 const helper=path.join(root,'enterprise/v6645-square-checkout-safety.cjs');
 if(!fs.existsSync(file)||!fs.existsSync(original))throw Error(MARKER+': required files missing');
 let s=fs.readFileSync(file,'utf8');
 if(s.includes(MARKER))throw Error(MARKER+': duplicate install');
 s=once(s,
 "const SQUARE_API_VERSION = process.env.SQUARE_API_VERSION || '2026-09-16';",
 "const SQUARE_API_VERSION = process.env.SQUARE_API_VERSION || '2026-09-16';\n"+
 "const SBC_SQUARE_SAFETY=require('./enterprise/v6645-square-checkout-safety.cjs');\n"+
 "const SBC_SQUARE_LOCATION_PROBE=SBC_SQUARE_SAFETY.createLocationProbe();\n"+
 "// "+MARKER+": provider payment proof and read-only readiness.",
 'register safe Square helpers');
 s=once(s,
 "  const idem=crypto.randomUUID();\n  const requestBody={idempotency_key:idem,",
 "  const requestBody={idempotency_key:'',",
 'remove random link idempotency');
 s=once(s,
 "  const j=await squareApi('/v2/online-checkout/payment-links',{method:'POST',body:requestBody});",
 "  // Reusing an order-scoped key prevents another Square link on retry after an uncertain response.\n"+
 "  requestBody.idempotency_key=SBC_SQUARE_SAFETY.linkIdempotencyKey({tenantId:o.tenantId,orderId:o.id,environment:squareEnvironment(),locationId:process.env.SQUARE_LOCATION_ID,amountCents:squareMoneyCents(o.price)});\n"+
 "  const j=await squareApi('/v2/online-checkout/payment-links',{method:'POST',body:requestBody});",
 'stable economic intent key');
 s=once(s,
 "  if(o.squarePaymentLink?.url || orderParsed(o).squarePaymentLinkUrl) return {existing:true,url:o.squarePaymentLink?.url||orderParsed(o).squarePaymentLinkUrl,order:o};",
 "  if(o.squarePaymentLink?.url || orderParsed(o).squarePaymentLinkUrl) return {existing:true,url:o.squarePaymentLink?.url||orderParsed(o).squarePaymentLinkUrl,order:o};\n"+
 "  if(o.checkoutLinkStatus==='RECONCILIATION_REQUIRED'||orderParsed(o).checkoutLinkStatus==='RECONCILIATION_REQUIRED'){\n"+
 "    const e=Error('SQUARE_PAYMENT_LINK_RECONCILIATION_REQUIRED');e.status=409;throw e;\n"+
 "  }",
 'do not retry payment links with unknown provider outcome');
 s=once(s,
 "    if(paymentAmountCents>0 && expectedAmountCents>0 && paymentAmountCents!==expectedAmountCents){",
 "    if(expectedAmountCents<=0||paymentAmountCents!==expectedAmountCents||String(payment.amount_money?.currency||'').toUpperCase()!=='USD'){" ,
 'webhook verified complete amount and currency');
 const oldRoute=s.split('\n').find(x=>x.startsWith("app.post('/api/payments/square/refresh/:orderId'"));
 if(!oldRoute)throw Error(MARKER+': Square owner refresh endpoint missing');
 const safeRoute=[
 "app.post('/api/payments/square/refresh/:orderId',auth,ownerOnly,async(req,res)=>{",
 "  const o=db.orders.find(x=>x.id===req.params.orderId);",
 "  if(!o)return res.status(404).json({ok:false,error:'Order not found.'});",
 "  const parsed=orderParsed(o),squareOrderId=parsed.squareOrderId||squarePaymentRecords().find(x=>x.sbcOrderId===o.id)?.squareOrderId;",
 "  if(!squareOrderId)return res.status(400).json({ok:false,error:'No Square order is linked to this SBC order.'});",
 "  try{",
 "    // Tender IDs are NOT payment proof; retrieve and validate the actual Square Payment.",
 "    const j=await squareApi('/v2/orders/'+encodeURIComponent(squareOrderId));",
 "    const payment=await SBC_SQUARE_SAFETY.findCapturedTender(j.order,async paymentId=>{",
 "      const detail=await squareApi('/v2/payments/'+encodeURIComponent(paymentId));",
 "      return detail.payment;",
 "    },{squareOrderId,locationId:String(process.env.SQUARE_LOCATION_ID),expectedAmountCents:squareMoneyCents(o.price)});",
 "    if(!payment)return res.json({ok:true,orderId:o.id,status:o.paymentStatus||'Pending',squareOrderId,verification:'NO_CONFIRMED_MATCHING_PAYMENT'});",
 "    const evidence={type:'payment.updated',event_id:'manual-verified-'+String(payment.id),data:{object:{payment}}};",
 "    return res.json(await handleSquarePaymentEvent(evidence));",
 "  }catch(e){",
 "    return res.status(e.status===401||e.status===403?502:503).json({ok:false,code:'SQUARE_PAYMENT_VERIFICATION_UNAVAILABLE',error:'Square payment verification failed. No order was marked paid.'});",
 "  }",
 "});"
 ].join('\n');
 s=once(s,oldRoute,safeRoute,'refresh requires actual Square captured payment');
 const statusRoute=s.split('\n').find(x=>x.startsWith("app.get('/api/payments/square/status'"));
 if(!statusRoute)throw Error(MARKER+': status anchor missing');
 const diagnostic=[
 "app.get('/api/payments/square/readiness',auth,ownerOnly,async(req,res)=>{",
 "  res.setHeader('Cache-Control','no-store');",
 "  const configured=squareConfigured(),webhookConfigured=squareWebhookConfigured();",
 "  const ownerPaused=RUNTIME_GATE.blocked('NEW_CHECKOUTS');",
 "  const writerReady=!SBC_RUNTIME_READ_ONLY&&MYSQL_RECOVERY_EVALUATED&&!MYSQL_RECOVERY_REQUIRED&&sbcWriterLeaseReady;",
 "  const provider=configured?await SBC_SQUARE_LOCATION_PROBE({",
 "    token:process.env.SQUARE_ACCESS_TOKEN,locationId:process.env.SQUARE_LOCATION_ID,",
 "    environment:squareEnvironment(),apiVersion:SQUARE_API_VERSION",
 "  }):{reachable:false,code:'NOT_CONFIGURED'};",
 "  const ready=configured&&provider.reachable&&webhookConfigured&&writerReady&&!ownerPaused;",
 "  res.json({ok:true,ready,provider,environment:squareEnvironment(),configured,webhookConfigured,",
 "    writerReady,ownerPaused,",
 "    verification:'READ_ONLY_LOCATION_PROBE_NO_CHARGES_NO_WEBHOOK_EVENT',",
 "    limitations:'A live test purchase and signed Square webhook remain necessary for production certification.'});",
 "});"
 ].join('\n');
 s=once(s,statusRoute,statusRoute+'\n'+diagnostic,'owner-only Square readiness');
 new vm.Script(s,{filename:'server.js'});
 new vm.Script(fs.readFileSync(original,'utf8'),{filename:'v6645-square-checkout-safety.cjs'});
 fs.copyFileSync(original,helper);
 fs.writeFileSync(file,s);
 return {marker:MARKER,files:['server.js','enterprise/v6645-square-checkout-safety.cjs'],
   stableIdempotency:true,onlyConfirmedPaymentSetsPaid:true,readOnlyProviderProbe:true,
   requiresWriterForCheckout:true,noNewProviderCharges:true,noDatabaseSchemaChanges:true};
}
module.exports={apply,MARKER,once};
