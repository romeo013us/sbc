'use strict';
// SBC V6645: deterministic checkout identity, verified payment reads and
// non-mutating owner diagnostics. Does not create charges, customers or orders.
const crypto=require('node:crypto');
const VALID_ENV=new Set(['production','sandbox']);
function linkIdempotencyKey({tenantId,orderId,environment,locationId,amountCents}){
 const env=String(environment||'');
 const tenant=String(tenantId||'').trim(),order=String(orderId||'').trim(),loc=String(locationId||'').trim();
 const cents=Number(amountCents);
 if(!tenant||!order||!loc||!VALID_ENV.has(env)||!Number.isSafeInteger(cents)||cents<=0)
   throw Error('SQUARE_IDEMPOTENCY_INPUT_INVALID');
 const preimage=JSON.stringify({scope:'SBC_PAYMENT_LINK_V1',tenantId:tenant,orderId:order,environment:env,locationId:loc,amountCents:cents});
 return 'sbcpl-'+crypto.createHash('sha256').update(preimage).digest('hex').slice(0,39);
}
function capturedForOrder(payment,{squareOrderId,locationId,expectedAmountCents}){
 const p=payment&&typeof payment==='object'?payment:{};
 const expected=Number(expectedAmountCents);
 return Boolean(p.id&&p.order_id&&p.location_id&&p.amount_money
  &&String(p.status||'').toUpperCase()==='COMPLETED'
  &&String(p.order_id)===String(squareOrderId)
  &&String(p.location_id)===String(locationId)
  &&Number.isSafeInteger(expected)&&expected>0
  &&Number(p.amount_money.amount)===expected
  &&String(p.amount_money.currency||'').toUpperCase()==='USD');
}
async function findCapturedTender(order,fetchPayment,{squareOrderId,locationId,expectedAmountCents}){
 const tenders=Array.isArray(order?.tenders)?order.tenders:[];
 const ids=[...new Set(tenders.map(t=>String(t?.payment_id||'').trim()).filter(Boolean))].slice(0,10);
 if(typeof fetchPayment!=='function')throw Error('SQUARE_PAYMENT_READER_REQUIRED');
 for(const id of ids){
  const payment=await fetchPayment(id);
  if(capturedForOrder(payment,{squareOrderId,locationId,expectedAmountCents}))return payment;
 }
 return null;
}
function createLocationProbe({fetchImpl=fetch,now=()=>Date.now(),ttlMs=60000}={}){
 let cached=null,inFlight=null,expires=0;
 return async function probe({token,locationId,environment,apiVersion}){
  if(!token||!locationId||!VALID_ENV.has(environment))return {reachable:false,code:'NOT_CONFIGURED'};
  const t=now();
  if(cached&&t<expires)return {...cached,cached:true};
  if(inFlight)return inFlight;
  inFlight=(async()=>{
   let outcome;
   try{
    const base=environment==='sandbox'?'https://connect.squareupsandbox.com':'https://connect.squareup.com';
    const response=await fetchImpl(base+'/v2/locations/'+encodeURIComponent(locationId),{
      method:'GET',
      headers:{Authorization:'Bearer '+token,'Square-Version':apiVersion||'2026-09-16',Accept:'application/json'},
      signal:AbortSignal.timeout(8000)
    });
    if(!response.ok)outcome={reachable:false,code:'HTTP_'+response.status};
    else{
     const data=await response.json();
     const loc=data?.location||{};
     outcome={reachable:loc.id===locationId&&loc.status==='ACTIVE',
       code:loc.id!==locationId?'LOCATION_MISMATCH':loc.status!=='ACTIVE'?'LOCATION_INACTIVE':'LOCATION_ACTIVE',
       currency:loc.currency||null};
    }
   }catch(e){outcome={reachable:false,code:e?.name==='TimeoutError'||e?.name==='AbortError'?'TIMEOUT':'PROVIDER_UNREACHABLE'};}
   cached=outcome;expires=now()+ttlMs;
   return {...outcome,cached:false};
  })();
  try{return await inFlight}finally{inFlight=null}
 };
}
module.exports={linkIdempotencyKey,capturedForOrder,findCapturedTender,createLocationProbe};
