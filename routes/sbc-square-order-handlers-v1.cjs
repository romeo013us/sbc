'use strict';
// Exact extracted Square order handlers. Middleware remains at the original server mount.
function createSquareOrderHandlers(getContext){
 if(typeof getContext!=='function')throw Error('Square order context required');
 return {
createLink:async(req,res)=>{
 const {db,requireRequestTenant,createSquarePaymentLinkForOrder,squareConfigured}=getContext();let tenantId;try{tenantId=requireRequestTenant(req)}catch(_){return res.status(403).json({ok:false,code:'TENANT_CONTEXT_REQUIRED'});}const o=(db.orders||[]).find(x=>String(x.id)===String(req.params.orderId)&&Number(x.tenantId)===tenantId);if(!o)return res.status(404).json({error:'Order not found.'});if(req.user.role==='caller'&&o.salesRepId&&o.salesRepId!==req.user.id)return res.status(403).json({error:'This order is not assigned to you.'});try{const out=await createSquarePaymentLinkForOrder(o,req);res.json({ok:true,...out})}catch(e){res.status(e.status===401||e.status===403?502:400).json({error:e.message||'Could not create Square payment link.',squareConfigured:squareConfigured()})}},
order:async(req,res)=>{
 const {db,requireRequestTenant,orderParsed,squarePaymentRecords}=getContext();let tenantId;try{tenantId=requireRequestTenant(req)}catch(_){return res.status(403).json({ok:false,code:'TENANT_CONTEXT_REQUIRED'});}const o=(db.orders||[]).find(x=>String(x.id)===String(req.params.orderId)&&Number(x.tenantId)===tenantId);if(!o)return res.status(404).json({error:'Order not found.'});const parsed=orderParsed(o);const rec=squarePaymentRecords().find(x=>x.sbcOrderId===o.id)||null;res.json({ok:true,order:{id:o.id,price:o.price,paymentStatus:(String(parsed.squarePaymentStatus||'').toUpperCase()==='PAID'||String(rec?.status||'').toUpperCase()==='PAID'?'Paid':o.paymentStatus||'Pending'),fulfillmentStatus:o.fulfillmentStatus||'Awaiting Customer Payment',paymentUrl:o.paymentUrl||parsed.squarePaymentLinkUrl||'',squareOrderId:rec?.squareOrderId||parsed.squareOrderId||'',squarePaymentId:rec?.squarePaymentId||parsed.squarePaymentId||'',squareStatus:rec?.status||parsed.squarePaymentStatus||'PENDING'}})},
refresh:async(req,res)=>{
 const {db,requireRequestTenant,orderParsed,squarePaymentRecords,squareApi,SBC_SQUARE_SAFETY,squareMoneyCents,handleSquarePaymentEvent}=getContext();
  let tenantId;try{tenantId=requireRequestTenant(req)}catch(_){return res.status(403).json({ok:false,code:'TENANT_CONTEXT_REQUIRED'});}
  const o=(db.orders||[]).find(x=>String(x.id)===String(req.params.orderId)&&Number(x.tenantId)===tenantId);
  if(!o)return res.status(404).json({ok:false,error:'Order not found.'});
  const parsed=orderParsed(o),squareOrderId=parsed.squareOrderId||squarePaymentRecords().find(x=>x.sbcOrderId===o.id)?.squareOrderId;
  if(!squareOrderId)return res.status(400).json({ok:false,error:'No Square order is linked to this SBC order.'});
  try{
    // Tender IDs are NOT payment proof; retrieve and validate the actual Square Payment.
    const j=await squareApi('/v2/orders/'+encodeURIComponent(squareOrderId));
    const payment=await SBC_SQUARE_SAFETY.findCapturedTender(j.order,async paymentId=>{
      const detail=await squareApi('/v2/payments/'+encodeURIComponent(paymentId));
      return detail.payment;
    },{squareOrderId,locationId:String(process.env.SQUARE_LOCATION_ID),expectedAmountCents:squareMoneyCents(o.price)});
    if(!payment)return res.json({ok:true,orderId:o.id,status:o.paymentStatus||'Pending',squareOrderId,verification:'NO_CONFIRMED_MATCHING_PAYMENT'});
    const evidence={type:'payment.updated',event_id:'manual-verified-'+String(payment.id),data:{object:{payment}}};
    return res.json(await handleSquarePaymentEvent(evidence));
  }catch(e){
    return res.status(e.status===401||e.status===403?502:503).json({ok:false,code:'SQUARE_PAYMENT_VERIFICATION_UNAVAILABLE',error:'Square payment verification failed. No order was marked paid.'});
  }
},
ownerMarkPaid:(req,res)=>{
 const {db,requireRequestTenant}=getContext();
 // SBC_V6652_MANUAL_PAYMENT_PROOF: prevent unverified vendor fulfillment.
 let tenantId;try{tenantId=requireRequestTenant(req)}catch(_){return res.status(403).json({ok:false,code:'TENANT_CONTEXT_REQUIRED'});}
 const order=(db.orders||[]).find(o=>String(o.id)===String(req.params.orderId)&&Number(o.tenantId)===tenantId);
 if(!order)return res.status(404).json({ok:false,code:'ORDER_NOT_FOUND'});
 res.setHeader('Cache-Control','no-store');
 return res.status(409).json({ok:false,code:'SBC_PROVIDER_PAYMENT_PROOF_REQUIRED',error:'Manual Mark Paid is disabled. Verify Square payment before fulfillment. No changes were made.'});
}
 };
}
module.exports={createSquareOrderHandlers};
