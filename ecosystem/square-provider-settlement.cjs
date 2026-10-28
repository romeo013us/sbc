'use strict';
/**
 * Read-only, non-dispatching Square payment verifier for Office Box.
 * NO scheduler, customer provisioning, DB writes, refund/dispute mutations or
 * automatic worker registration. Requires PAYMENTS_READ + DISPUTES_READ.
 * Fail closed on pagination/permission/network failure and on any refund or
 * dispute on the original payment, including pending or won disputes.
 * Refunded-money and refund IDs are also checked directly on GetPayment.
 */
const API_ROOT=Object.freeze({production:'https://connect.squareup.com',sandbox:'https://connect.squareupsandbox.com'});
const API_VERSION='2026-09-16';
const ID=/^[A-Za-z0-9_-]{4,192}$/;
function refuse(code){throw Object.assign(new Error(code),{code})}
function createSquareSettlementVerifier({accessToken,environment='production',transport=globalThis.fetch,
 version=API_VERSION,clock=Date.now,maxPages=8,timeoutMs=8000}={}){
 if(typeof accessToken!=='string'||accessToken.length<12||/[\r\n]/.test(accessToken)||
    !Object.hasOwn(API_ROOT,environment)||typeof transport!=='function'||
    !/^\d{4}-\d{2}-\d{2}$/.test(version)||typeof clock!=='function'||
    !Number.isSafeInteger(maxPages)||maxPages<1||maxPages>50||
    !Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>30000)
  refuse('SQUARE_VERIFIER_CONFIGURATION_INVALID');
 const headers=Object.freeze({'Authorization':'Bearer '+accessToken,'Square-Version':version,
  'Accept':'application/json'});
 async function get(endpoint,params){
  const u=new URL(endpoint,API_ROOT[environment]);
  for(const [key,value] of Object.entries(params||{}))u.searchParams.set(key,value);
  let response,body;
  try{
   response=await transport(u.href,{method:'GET',headers,redirect:'error',cache:'no-store',
    signal:AbortSignal.timeout(timeoutMs)});
   if(response?.status!==200||typeof response.text!=='function')refuse('SQUARE_PROVIDER_GET_NOT_AUTHORIZED');
   const raw=await response.text();
   if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>1024*1024)refuse('SQUARE_PROVIDER_RESPONSE_TOO_LARGE');
   body=JSON.parse(raw);
  }catch{refuse('SQUARE_PROVIDER_READ_UNAVAILABLE')}
  if(!body||typeof body!=='object'||Array.isArray(body)||
    (body.errors!==undefined&&(!Array.isArray(body.errors)||body.errors.length>0)))
   refuse('SQUARE_PROVIDER_RESPONSE_INVALID');
  return body;
 }
 async function listAll(endpoint,field,params={}){
  let cursor,records=[],seen=new Set();
  for(let page=0;page<maxPages;page++){
   const data=await get(endpoint,{...params,...(cursor?{cursor}:{})});
   if(!Array.isArray(data[field]))refuse('SQUARE_PROVIDER_PAGINATION_INVALID');
   records.push(...data[field]);
   if(!data.cursor)return records;
   if(typeof data.cursor!=='string'||data.cursor.length>3000||seen.has(data.cursor))
    refuse('SQUARE_PROVIDER_PAGINATION_INVALID');
   seen.add(data.cursor);cursor=data.cursor;
  }
  refuse('SQUARE_PROVIDER_PAGINATION_INCOMPLETE');
 }
 async function verifyLiveSettlement({paymentId}={}){
  if(typeof paymentId!=='string'||!ID.test(paymentId))refuse('SQUARE_PAYMENT_ID_INVALID');
  const data=await get('/v2/payments/'+paymentId);
  const p=data.payment;
  if(!p||p.id!==paymentId||p.status!=='COMPLETED'||!ID.test(String(p.order_id||''))||
     !ID.test(String(p.location_id||''))||p.amount_money?.currency!=='USD'||
     !Number.isSafeInteger(p.amount_money?.amount)||p.amount_money.amount<=0)
   refuse('SQUARE_CAPTURE_IDENTITY_OR_STATUS_INVALID');
  // The Refunds API defaults to the prior year. Older payments need manual
  // reconciliation rather than falsely inferring no historical refunds.
  const paymentCreated=Date.parse(p.created_at||'');
  const observed=Number(clock());
  if(!Number.isFinite(paymentCreated)||!Number.isFinite(observed)||
     paymentCreated>observed+30000||observed-paymentCreated>364*24*60*60*1000)
   refuse('SQUARE_PAYMENT_OUTSIDE_VERIFIABLE_REFUND_WINDOW');
  // A refund request or nonzero refunded amount disqualifies provisioning.
  if(p.refunded_money!==undefined&&p.refunded_money!==null&&
     (!Number.isSafeInteger(p.refunded_money.amount)||p.refunded_money.amount!==0||
       p.refunded_money.currency!=='USD'))
   refuse('SQUARE_PAYMENT_REFUNDED_OR_UNVERIFIABLE');
  if(p.refund_ids!==undefined&&(!Array.isArray(p.refund_ids)||p.refund_ids.length!==0))
   refuse('SQUARE_PAYMENT_REFUND_EXISTS');
  // Refund list is eventually consistent, so pair it with direct payment fields.
  const refunds=await listAll('/v2/refunds','refunds');
  if(refunds.some(refund=>!refund||typeof refund!=='object'))
   refuse('SQUARE_REFUND_LIST_MALFORMED');
  if(refunds.some(refund=>refund.payment_id===paymentId))
   refuse('SQUARE_PAYMENT_REFUND_EXISTS');
  // DISPUTES_READ permission is mandatory. Never treat a 403 or missing page
  // as "no dispute", even if the payment GET was successful.
  const disputes=await listAll('/v2/disputes','disputes',{location_id:p.location_id});
  if(disputes.some(dispute=>!dispute||typeof dispute!=='object'))
   refuse('SQUARE_DISPUTE_LIST_MALFORMED');
  if(disputes.some(dispute=>dispute.disputed_payment?.payment_id===paymentId))
   refuse('SQUARE_PAYMENT_DISPUTE_EXISTS');
  const now=Number(clock());
  if(!Number.isFinite(now)||now<0)refuse('SQUARE_PROVIDER_CLOCK_INVALID');
  return Object.freeze({source:'SQUARE_PAYMENT_PROVIDER_GET',status:'COMPLETED',settled:true,
   refunded:false,disputed:false,paymentId:p.id,squareOrderId:p.order_id,
   locationId:p.location_id,currency:'USD',amountCents:p.amount_money.amount,
   verifiedAt:new Date(now).toISOString()});
 }
 return Object.freeze({verifyLiveSettlement});
}
module.exports={createSquareSettlementVerifier};
