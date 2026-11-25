'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createSquareOrderHandlers}=require('../routes/sbc-square-order-handlers-v1.cjs');
function fixture(){
 const order={id:'one',tenantId:1,price:199,salesRepId:'caller-1',paymentStatus:'Pending'};
 const other={id:'other',tenantId:2,price:999};
 const calls=[];
 const context={db:{orders:[order,other]},requireRequestTenant:r=>{if(!r.tenantId)throw Error('missing');return r.tenantId;},createSquarePaymentLinkForOrder:async o=>{calls.push(['link',o.id]);return {paymentUrl:'https://example.invalid/test'};},squareConfigured:()=>true,orderParsed:()=>({squareOrderId:'sq_order'}),squarePaymentRecords:()=>[],squareApi:async endpoint=>{calls.push(['read',endpoint]);return endpoint.includes('/orders/')?{order:{id:'sq_order'}}:{payment:{id:'pay_test'}};},SBC_SQUARE_SAFETY:{findCapturedTender:async()=>null},squareMoneyCents:n=>Math.round(n*100),handleSquarePaymentEvent:async event=>{calls.push(['settle',event]);return {ok:true,status:'PAID'};}};
 const handlers=createSquareOrderHandlers(()=>context);
 function req(id='one',role='owner',tenantId=1){return {params:{orderId:id},user:{id:'caller-1',role},tenantId};}
 async function invoke(name,request){
  const res={code:200,headers:{},status(n){this.code=n;return this;},json(v){this.body=v;return this;},setHeader(k,v){this.headers[k]=v;}};
  await handlers[name](request,res);return res;
 }
 return {context,calls,order,req,invoke};
}
test('all order routes deny cross-tenant and missing tenant before provider reads',async()=>{
 const f=fixture();
 for(const name of ['createLink','order','refresh','ownerMarkPaid']){
  assert.equal((await f.invoke(name,f.req('other'))).code,404);
  assert.equal((await f.invoke(name,{...f.req(),tenantId:undefined})).code,403);
 }
 assert.deepEqual(f.calls,[]);
});
test('caller assignment remains enforced and live context is read each time',async()=>{
 const f=fixture();
 assert.equal((await f.invoke('createLink',f.req('one','caller'))).code,200);
 f.context.db={orders:[{...f.order,salesRepId:'different'}]};
 assert.equal((await f.invoke('createLink',f.req('one','caller'))).code,403);
 assert.deepEqual(f.calls,[['link','one']]);
});
test('owner refresh cannot mark paid without matching captured payment',async()=>{
 const f=fixture();
 const no=await f.invoke('refresh',f.req());
 assert.equal(no.body.verification,'NO_CONFIRMED_MATCHING_PAYMENT');
 assert.equal(f.calls.some(x=>x[0]==='settle'),false);
 f.context.SBC_SQUARE_SAFETY.findCapturedTender=async(order,read,criteria)=>{
  assert.equal(order.id,'sq_order');assert.equal(criteria.squareOrderId,'sq_order');assert.equal(criteria.expectedAmountCents,19900);
  return read('pay_test');
 };
 const yes=await f.invoke('refresh',f.req());
 assert.equal(yes.body.status,'PAID');assert.equal(f.calls.filter(x=>x[0]==='settle').length,1);
 f.context.squareApi=async()=>{throw Error('provider unavailable');};
 assert.equal((await f.invoke('refresh',f.req())).code,503);
 assert.equal(f.calls.filter(x=>x[0]==='settle').length,1);
});
test('manual mark paid remains blocked and readback is non-mutating',async()=>{
 const f=fixture();
 const blocked=await f.invoke('ownerMarkPaid',f.req());
 assert.equal(blocked.code,409);assert.equal(blocked.body.code,'SBC_PROVIDER_PAYMENT_PROOF_REQUIRED');
 assert.equal(blocked.headers['Cache-Control'],'no-store');
 assert.equal((await f.invoke('order',f.req())).body.order.paymentStatus,'Pending');
 assert.deepEqual(f.calls,[]);
});
test('server retains exact middleware chains and single registration for extracted handlers',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 for(const [route,chain] of [
  ['/api/payments/square/create-link/:orderId',"auth,v25SalesAccess,FINANCIAL_GOVERNOR.middleware('square_payment_link'),SBC_SQUARE_ORDER_HANDLERS.createLink"],
  ['/api/payments/square/order/:orderId','auth,SBC_SQUARE_ORDER_HANDLERS.order'],
  ['/api/payments/square/refresh/:orderId','auth,ownerOnly,SBC_SQUARE_ORDER_HANDLERS.refresh'],
  ['/api/payments/square/owner-mark-paid/:orderId','auth,ownerOnly,SBC_SQUARE_ORDER_HANDLERS.ownerMarkPaid']
 ]){
  assert.equal(s.split("'"+route+"'").length-1,1);
  assert.ok(s.includes("'"+route+"',"+chain+");"));
 }
});
