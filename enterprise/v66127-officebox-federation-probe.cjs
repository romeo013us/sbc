'use strict';
/* SBC V66.127: owner-invoked, zero-charge, read-only signed federation proof.
 * Existing Office Box POST /api/sbc/activation-status is read-only. An
 * impossible synthetic correlation must return an AUTHENTICATED not-found,
 * never a paid activation or provider receipt. No new Office Box route needed.
 */
const crypto=require('node:crypto');
const {baseUrl}=require('./v66112-officebox-postcommit.cjs');
const fail=(code,status=503)=>Object.assign(new Error(code),{code,status});
async function probe({origin,secret,transport=fetch,at=Date.now(),nonce=crypto.randomBytes(12).toString('hex')}={}){
 if(typeof transport!=='function')throw fail('OFFICEBOX_PROBE_TRANSPORT_UNAVAILABLE');
 if(typeof secret!=='string'||secret.length<32)throw fail('OFFICEBOX_PROBE_SIGNING_NOT_CONFIGURED');
 if(!/^[a-f0-9]{24}$/.test(String(nonce||'')))throw fail('OFFICEBOX_PROBE_NONCE_INVALID');
 // Inherits Command Center's restricted HTTPS origin policy, preventing SSRF.
 const target=baseUrl(origin)+'/api/sbc/activation-status';
 const timestamp=String(Math.floor(at/1000));
 if(!/^\d{10}$/.test(timestamp))throw fail('OFFICEBOX_PROBE_CLOCK_INVALID');
 const payload={schema:'sbc.office-box.activation-lookup.v1',
  correlationId:'sbc_probe_'+nonce,customerId:'sbc_probe_customer_'+nonce,
  orderId:'sbc_probe_order_'+nonce,plan:'business'};
 const raw=JSON.stringify(payload);
 const signature=crypto.createHmac('sha256',secret)
  .update(timestamp+'.').update(raw).digest('hex');
 let response,reply;
 try{
  response=await transport(target,{method:'POST',redirect:'error',cache:'no-store',
   headers:{'content-type':'application/json','x-sbc-timestamp':timestamp,
    'x-sbc-signature-v2':'sha256='+signature},
   body:raw,signal:AbortSignal.timeout(10000)});
  reply=await response.json();
 }catch{throw fail('OFFICEBOX_PROBE_TRANSPORT_FAILED',502)}
 // 404 from a non-existent route is NOT proof. This exact JSON comes from
 // Office Box only after the HMAC has passed signature/timestamp verification.
 if(response?.status!==404||reply?.ok!==false||reply?.error!=='ACTIVATION_NOT_FOUND')
  throw fail(response?.status===401?'OFFICEBOX_PROBE_SIGNATURE_REJECTED':
   'OFFICEBOX_PROBE_SIGNED_ACK_UNVERIFIED',502);
 return Object.freeze({ok:true,authenticated:true,readOnly:true,
  chargeAmount:0,providerRequests:0,activationCreated:false,tenantCreated:false,
  entitlementChanged:false,ack:'ACTIVATION_NOT_FOUND',
  meaning:'Live signed transport works; purchase/activation and recurring provider remain separately unverified'});
}
module.exports={probe};
