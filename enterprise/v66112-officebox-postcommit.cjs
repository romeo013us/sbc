'use strict';
const {isIP}=require('node:net');
/* SBC V66.112: owner-invoked, post-commit Office Box V2 reconciliation.
 * Never charges a card, calls Twilio, creates a new order, or provisions
 * a tenant without an existing paid, MySQL-committed Office Box SKU.
 */
const {PLANS,prepareHandoff,signHandoffV2,interpretAck}=require('./v6674-officebox-v2-handoff.cjs');
const ORDER_RE=/^[A-Za-z0-9._:-]{6,80}$/;
function fail(code,status=409){const e=new Error(code);e.code=code;e.status=status;throw e;}
function parseNotes(s){try{const x=JSON.parse(String(s||'{}'));return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}catch{return {}}}
function baseUrl(raw){
 let u;try{u=new URL(String(raw||''))}catch{fail('OFFICEBOX_URL_NOT_CONFIGURED',503)}
 const host=u.hostname.replace(/^\[|\]$/g,'').replace(/\.$/,'').toLowerCase();
 // A signed provisioning handoff must use a DNS origin, never a literal
 // IPv4/IPv6 address or local-resolver hostname. Redirects remain disabled.
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||
   (u.port&&u.port!=='443')||!host||isIP(host)||
   host==='localhost'||host.endsWith('.localhost')||
   host.endsWith('.local')||host.endsWith('.internal'))
   fail('OFFICEBOX_HTTPS_ORIGIN_REQUIRED',503);
 return u.origin;
}
function skuFor(notes){
 const x=String(notes.officeBoxSku||'').toUpperCase();
 if(PLANS[x])return x;
 for(const line of Array.isArray(notes.items)?notes.items:[]){const k=String(line?.sku||'').toUpperCase();if(PLANS[k])return k}
 return '';
}
async function reconcile(input,dep){
 const tenantId=Number(input?.tenantId),orderId=String(input?.orderId||'');
 if(!Number.isSafeInteger(tenantId)||tenantId<1)fail('OFFICEBOX_TENANT_REQUIRED',403);
 if(!ORDER_RE.test(orderId))fail('OFFICEBOX_ORDER_ID_INVALID',422);
 if(!dep||!dep.pool||typeof dep.pool.query!=='function')fail('OFFICEBOX_DURABLE_DATABASE_REQUIRED',503);
 if(typeof dep.squareApi!=='function'||typeof dep.fetch!=='function')fail('OFFICEBOX_PROVIDER_NOT_CONFIGURED',503);
 if(typeof dep.secret!=='string'||dep.secret.length<32)fail('OFFICEBOX_WEBHOOK_SECRET_NOT_CONFIGURED',503);
 const target=baseUrl(dep.baseUrl);
 const locationId=String(dep.locationId||'');
 if(!ORDER_RE.test(locationId))fail('OFFICEBOX_SQUARE_LOCATION_NOT_CONFIGURED',503);
 // MySQL is authoritative. In-memory or uncommitted Square event state cannot
 // authorize Office Box provisioning.
 const [rows]=await dep.pool.query('SELECT id,customer_id,product,status,price,notes FROM sbc_orders WHERE tenant_id=? AND id=? LIMIT 1',[tenantId,orderId]);
 const r=rows?.[0];
 if(!r)fail('OFFICEBOX_COMMITTED_ORDER_NOT_FOUND',404);
 if(!['PAID','COMPLETED'].includes(String(r.status||'').toUpperCase()))fail('OFFICEBOX_COMMITTED_ORDER_NOT_PAID');
 const notes=parseNotes(r.notes);
 if(notes.sbcLaunchQa||notes.launchQaOwnerCreated===true||/launch qa|\$1 test/i.test(String(r.product||'')))fail('OFFICEBOX_QA_ORDER_EXCLUDED');
 const sku=skuFor(notes);
 if(!sku)fail('OFFICEBOX_EXPLICIT_PURCHASE_SKU_REQUIRED',422);
 if(!ORDER_RE.test(String(notes.squarePaymentId||''))||!ORDER_RE.test(String(notes.squareOrderId||''))||String(notes.squarePaymentStatus||'').toUpperCase()!=='PAID')
   fail('OFFICEBOX_DURABLE_SQUARE_PROOF_MISSING');
 const [customers]=await dep.pool.query('SELECT id,business_name,email,industry FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1',[tenantId,String(r.customer_id||'')]);
 const c=customers?.[0];
 if(!c)fail('OFFICEBOX_COMMITTED_CUSTOMER_NOT_FOUND',404);
 const provider=await dep.squareApi('/v2/payments/'+encodeURIComponent(notes.squarePaymentId));
 const payment=provider?.payment;
 if(!payment||String(payment.id)!==String(notes.squarePaymentId))fail('OFFICEBOX_SQUARE_PROVIDER_READBACK_MISMATCH',409);
 const order={id:r.id,customerId:r.customer_id,price:Number(r.price),officeBoxSku:sku,product:r.product,
   paymentStatus:'PAID',squareOrderId:notes.squareOrderId,sbcLaunchQa:Boolean(notes.sbcLaunchQa)};
 const customer={id:c.id,businessName:c.business_name,email:c.email,industry:c.industry||''};
 const event=prepareHandoff({order,customer,squareReadback:{
   providerVerified:true,source:'SQUARE_PROVIDER_READBACK',
   squareOrderId:payment.order_id,payment
 },commitReceipt:{source:'COMMITTED_MYSQL',commitVerified:true},expectedLocationId:locationId});
 const signed=signHandoffV2(event,dep.secret);
 let response,body;
 try{
   response=await dep.fetch(target+signed.path,{method:signed.method,headers:signed.headers,
     body:signed.body,redirect:'error',signal:AbortSignal.timeout(10000)});
   body=await response.json();
 }catch(e){fail('OFFICEBOX_HANDOFF_TRANSPORT_FAILED',502)}
 const reply={ok:Boolean(response.ok)&&body?.ok===true,data:body?.data||body};
 const ack=interpretAck(reply);
 if(!ack.accepted)fail('OFFICEBOX_HANDOFF_NOT_ACKNOWLEDGED',502);
 return {ok:true,accepted:true,duplicate:ack.duplicate===true,
   status:ack.duplicate?'INVITATION_RECONCILIATION_REQUIRED':ack.activationUrl?'INVITATION_PENDING':'ACTIVATION_URL_UNCONFIRMED',
   correlationId:event.correlationId,customerId:String(c.id),orderId:String(r.id),
   activationUrl:ack.activationUrl||null};
}
module.exports={reconcile,skuFor,baseUrl,parseNotes};
