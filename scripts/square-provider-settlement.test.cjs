'use strict';
/** Synthetic Square API only. No live account, payment, customer, or network calls. */
const assert=require('node:assert/strict');
const {createSquareSettlementVerifier}=require('../ecosystem/square-provider-settlement.cjs');
const NOW=Date.parse('2026-10-28T19:00:00Z');
const payment={id:'square_payment_999',order_id:'square_order_999',location_id:'square_location_999',
 status:'COMPLETED',created_at:'2026-10-27T19:00:00Z',amount_money:{amount:34900,currency:'USD'},
 refunded_money:{amount:0,currency:'USD'},refund_ids:[]};
function mock({pay=payment,refundPages=[{refunds:[]}],disputePages=[{disputes:[]}],
  failAt='',badBody=false}={}){
 const calls=[];
 const transport=async(url,opt)=>{
  const u=new URL(url),p=u.pathname;calls.push({url:u.href,opts:opt});
  assert.equal(opt.method,'GET');assert.equal(opt.redirect,'error');assert.equal(opt.cache,'no-store');
  assert.equal(opt.headers['Square-Version'],'2026-09-16');
  assert.equal(opt.headers.Authorization,'Bearer square-mock-token-not-real');
  assert.equal(u.origin,'https://connect.squareup.com');
  if(failAt&&p.includes(failAt))return {status:403,text:async()=>JSON.stringify({errors:[{code:'FORBIDDEN'}]})};
  let response;
  if(p.startsWith('/v2/payments/'))response={payment:pay};
  else if(p==='/v2/refunds')response=refundPages[u.searchParams.get('cursor')==='ref-next'?1:0];
  else if(p==='/v2/disputes'){
   assert.equal(u.searchParams.get('location_id'),'square_location_999');
   response=disputePages[u.searchParams.get('cursor')==='dis-next'?1:0];
  }else throw Error('Unexpected API route '+p);
  return {status:200,text:async()=>badBody?'not JSON':JSON.stringify(response)};
 };
 return {calls,transport};
}
const make=(setup)=>createSquareSettlementVerifier({accessToken:'square-mock-token-not-real',
 clock:()=>NOW,transport:setup.transport,...(setup.options||{})});
async function reject(opts,code){
 const m=mock(opts);
 await assert.rejects(()=>make(m).verifyLiveSettlement({paymentId:payment.id}),new RegExp(code));
 return m;
}
(async()=>{
 let m=mock(),proof=await make(m).verifyLiveSettlement({paymentId:payment.id});
 assert.deepEqual(proof,{source:'SQUARE_PAYMENT_PROVIDER_GET',status:'COMPLETED',settled:true,
  refunded:false,disputed:false,paymentId:payment.id,squareOrderId:payment.order_id,
  locationId:payment.location_id,currency:'USD',amountCents:34900,verifiedAt:new Date(NOW).toISOString()});
 assert.equal(m.calls.length,3);
 await reject({pay:{...payment,status:'PENDING'}},'CAPTURE_IDENTITY_OR_STATUS_INVALID');
 await reject({pay:{...payment,id:'other_payment'}},'CAPTURE_IDENTITY_OR_STATUS_INVALID');
 await reject({pay:{...payment,amount_money:{amount:34900,currency:'CAD'}}},'CAPTURE_IDENTITY_OR_STATUS_INVALID');
 await reject({pay:{...payment,refunded_money:{amount:1,currency:'USD'}}},'PAYMENT_REFUNDED_OR_UNVERIFIABLE');
 await reject({pay:{...payment,refund_ids:['refund_1']}},'PAYMENT_REFUND_EXISTS');
 await reject({pay:{...payment,created_at:'2024-01-01T00:00:00Z'}},'PAYMENT_OUTSIDE_VERIFIABLE_REFUND_WINDOW');
 await reject({refundPages:[{refunds:[{payment_id:payment.id,status:'PENDING'}]}]},'PAYMENT_REFUND_EXISTS');
 await reject({disputePages:[{disputes:[{disputed_payment:{payment_id:payment.id},state:'WON'}]}]},'PAYMENT_DISPUTE_EXISTS');
 await reject({failAt:'disputes'},'PROVIDER_READ_UNAVAILABLE');
 await reject({failAt:'refunds'},'PROVIDER_READ_UNAVAILABLE');
 await reject({badBody:true},'PROVIDER_READ_UNAVAILABLE');
 await reject({refundPages:[{refunds:[{}],cursor:'ref-next'},{refunds:[{payment_id:payment.id}]}]},'PAYMENT_REFUND_EXISTS');
 await reject({disputePages:[{disputes:[],cursor:'dis-next'},{disputes:[{disputed_payment:{payment_id:payment.id}}]}]},'PAYMENT_DISPUTE_EXISTS');
 m=mock({refundPages:[{refunds:[],cursor:'same'}]});
 await assert.rejects(()=>make({...m,options:{maxPages:1}}).verifyLiveSettlement({paymentId:payment.id}),/PAGINATION_INCOMPLETE/);
 m=mock({refundPages:[{}]});
 await assert.rejects(()=>make(m).verifyLiveSettlement({paymentId:payment.id}),/PAGINATION_INVALID/);
 m=mock({disputePages:[{disputes:[],cursor:'dis-next'},{disputes:[]}]});
 assert.equal((await make(m).verifyLiveSettlement({paymentId:payment.id})).settled,true);
 assert.equal(m.calls.length,4);
 await assert.rejects(()=>make(mock()).verifyLiveSettlement({paymentId:'https://host.internal?'}),/PAYMENT_ID_INVALID/);
 assert.throws(()=>createSquareSettlementVerifier({accessToken:'short'}),/CONFIGURATION_INVALID/);
 assert.throws(()=>createSquareSettlementVerifier({accessToken:'square-mock-token-not-real',
  environment:'production\nhttps:'}),/CONFIGURATION_INVALID/);
 const sandbox=createSquareSettlementVerifier({accessToken:'square-mock-token-not-real',environment:'sandbox',
  transport:async(url)=>{
   assert(url.startsWith('https://connect.squareupsandbox.com/v2/'));
   return {status:200,text:async()=>JSON.stringify(url.includes('/payments/')?{payment}:
     url.includes('/refunds')?{refunds:[]}:{disputes:[]})};
  },clock:()=>NOW});
 assert.equal((await sandbox.verifyLiveSettlement({paymentId:payment.id})).settled,true);
 console.log('[SBC SQUARE PROVIDER GET] PASS: captured payment, refunds/disputes, pagination, permissions, bounds, fixed HTTPS hosts, no network');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
