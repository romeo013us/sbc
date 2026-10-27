'use strict';
const crypto=require('crypto');
function id(p){return `${p}_${crypto.randomBytes(8).toString('hex')}`}
class MerchantSettlementMatrix{
 constructor(config={}){
  this.stripeKey=config.stripeKey||process.env.STRIPE_SECRET_KEY;
  this.stripeWebhookSecret=config.stripeWebhookSecret||process.env.STRIPE_WEBHOOK_SECRET;
  this.squareKey=config.squareKey||process.env.SQUARE_ACCESS_TOKEN;
  this.live=Boolean(this.stripeKey||this.squareKey);
 }
 async createCheckoutSession({lead,amount}){
  const cents=Math.max(1,Math.round(Number(amount)));
  if(!this.stripeKey)return {intentId:id('sim_tx'),checkoutUrl:null,amount:cents,currency:'usd',status:'NOT_CONFIGURED',mode:'SIMULATED',requiresProviderConfig:true};
  const success=process.env.SBC_CHECKOUT_SUCCESS_URL||`${process.env.SBC_PUBLIC_URL||''}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancel=process.env.SBC_CHECKOUT_CANCEL_URL||`${process.env.SBC_PUBLIC_URL||''}/payment/cancel`;
  if(!String(success).startsWith('http')||!String(cancel).startsWith('http')) throw new Error('STRIPE_RETURN_URLS_NOT_CONFIGURED');
  const body=new URLSearchParams();
  body.set('mode','payment');body.set('success_url',success);body.set('cancel_url',cancel);
  body.set('line_items[0][quantity]','1');body.set('line_items[0][price_data][currency]','usd');
  body.set('line_items[0][price_data][unit_amount]',String(cents));
  body.set('line_items[0][price_data][product_data][name]',String(lead?.companyName||'SBC Business Services').slice(0,250));
  const r=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{authorization:`Bearer ${this.stripeKey}`,'content-type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(Number(process.env.SBC_STRIPE_TIMEOUT_MS||20000))});
  const j=await r.json();if(!r.ok)throw new Error(`STRIPE_CHECKOUT_${r.status}`);
  return {intentId:j.payment_intent||j.id,sessionId:j.id,checkoutUrl:j.url,amount:cents,currency:'usd',status:j.status||'open',mode:'LIVE_PROVIDER'};
 }
 verifyWebhook(payload){return Boolean(payload&&payload.type&&payload.id)}
 verifyStripeSignature(rawBody,signatureHeader){
  if(!this.stripeWebhookSecret) return {ok:false,reason:'STRIPE_WEBHOOK_SECRET_NOT_CONFIGURED'};
  if(!signatureHeader||!rawBody) return {ok:false,reason:'STRIPE_SIGNATURE_MISSING'};
  const parts=String(signatureHeader).split(',');const timestamp=parts.find(x=>x.startsWith('t='))?.slice(2);
  const signatures=parts.filter(x=>x.startsWith('v1=')).map(x=>x.slice(3));
  if(!timestamp||!signatures.length) return {ok:false,reason:'STRIPE_SIGNATURE_INVALID'};
  const tolerance=Number(process.env.SBC_STRIPE_WEBHOOK_TOLERANCE_SEC||300);
  if(Math.abs(Math.floor(Date.now()/1000)-Number(timestamp))>tolerance)return {ok:false,reason:'STRIPE_SIGNATURE_EXPIRED'};
  const signed=`${timestamp}.${Buffer.isBuffer(rawBody)?rawBody.toString('utf8'):String(rawBody)}`;
  const expected=crypto.createHmac('sha256',this.stripeWebhookSecret).update(signed).digest('hex');
  const valid=signatures.some(sig=>{try{return crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected));}catch{return false;}});
  return valid?{ok:true}:{ok:false,reason:'STRIPE_SIGNATURE_MISMATCH'};
 }
 processWebhook(payload){if(!this.verifyWebhook(payload))throw new Error('WEBHOOK_INVALID');if(['payment_intent.succeeded','checkout.session.completed','payment_intent.payment_failed','charge.dispute.created'].includes(payload.type))return {processed:true,type:payload.type,id:payload.id};return {processed:false,type:payload.type,id:payload.id}}
}
module.exports=MerchantSettlementMatrix;
