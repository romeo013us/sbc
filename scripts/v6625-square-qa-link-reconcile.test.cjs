'use strict';
// SBC V66.25: isolated Square $1 QA reconciliation contract.
// No Square credentials, live requests, writes, fulfillment or payments.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(require('node:path').resolve(__dirname,'../server.js'),'utf8');
const marker='// SBC_V6625_OWNER_QA_LINK_RECONCILIATION:';
const start=s.indexOf(marker),end=s.indexOf('async function createSquarePaymentLinkForOrder(o,req){',start);
assert(start>=0&&end>start,'compiled read-only QA reconciliation must exist');
const code=s.slice(start,end);
assert.match(code,/app.get\('\/api\/owner\/launch-qa\/reconcile\/:orderId',auth,ownerOnly/);
assert.doesNotMatch(code,/await saveData\(|squareApi\([^,]+,\s*\{\s*method:\s*'POST'/,'GET cannot create checkout or write records');
assert.match(s,/if\(reconciliation.status!=='NONE'\)/,'link creation must independently recheck provider before POST');
assert.match(s,/o.fulfillmentStatus=isOwnerQa\?'QA - NO VENDOR FULFILLMENT':'Awaiting Customer Payment'/);
assert.match(s,/fulfillmentStatus:sbcLaunchQaDurable\?'QA - NO VENDOR FULFILLMENT':'Ready for Fulfillment'/);
assert.match(s,/SQUARE_QA_OWNER_REQUIRED/,'QA link operations must be owner-only');
assert.match(s,/SQUARE_QA_NO_VERIFIED_LINK_TO_ATTACH/,'recover_only may never create a new checkout');
assert.match(s,/squareOrderId:found/,'provider-verified linkage must be persisted for webhook reconciliation');
assert.match(s,/await saveData\(\)/,'verified POST recovery must persist linkage');
assert.match(code,/SQUARE_ORDERS_READ_PERMISSION_OR_LOCATION_REJECTED/);
assert.match(code,/SQUARE_ACCESS_TOKEN_REJECTED/);
assert.match(code,/SQUARE_PROVIDER_RATE_LIMITED/);
const qa={id:'qa-1',tenantId:7,price:1,product:'SBC Launch QA - $1 Test Service',
 notes:JSON.stringify({sbcLaunchQa:{kind:'OWNER_ONLY_ONE_DOLLAR_CHECKOUT',version:1}})};
const order={id:'square-1',reference_id:'qa-1',location_id:'location-1',total_money:{amount:100,currency:'USD'}};
const matched={id:'link-1',order_id:'square-1',url:'https://square.link/u/internal-qa',
 payment_note:'SBC Order qa-1'};
function fixture({links=[],sOrders={},providerError=false,readonly=false,blocked=false,
  orderNotes=qa.notes,dbOrder=qa}={}){
 const paths=[],app={};
 const requestOrder={...dbOrder,notes:orderNotes};
 const db={orders:[requestOrder],squarePayments:[]};
 const context={app,auth:'AUTH',ownerOnly:'OWNER_ONLY',db,URL,encodeURIComponent,
  process:{env:{SQUARE_LOCATION_ID:'location-1'}},
  squareConfigured:()=>true,squareMoneyCents:v=>Math.round(Number(v)*100),
  orderParsed:o=>JSON.parse(o.notes),
  RUNTIME_GATE:{blocked:()=>blocked},SBC_RUNTIME_READ_ONLY:readonly,
  sbcShutdownStarted:false,mysqlPool:{},MYSQL_RECOVERY_EVALUATED:true,MYSQL_RECOVERY_REQUIRED:false,
  sbcWriterLeaseReady:true,requireRequestTenant:()=>7,
  squareApi:async p=>{
    paths.push(p);
    if(providerError)throw Error('NO_NETWORK');
    if(p.startsWith('/v2/online-checkout/payment-links'))return {payment_links:links};
    if(p.startsWith('/v2/orders/'))return {order:sOrders[p.split('/').pop()]||null};
    throw Error('UNEXPECTED_PATH '+p);
  }};
 app.get=(path,auth,ownerOnly,handler)=>{
  assert.equal(path,'/api/owner/launch-qa/reconcile/:orderId');
  assert.equal(auth,'AUTH');assert.equal(ownerOnly,'OWNER_ONLY');app.handler=handler;
 };
 vm.runInNewContext(code,context,{timeout:5000});
 function res(){
   return {code:200,headers:{},setHeader(k,v){this.headers[k]=v},
     status(c){this.code=c;return this},json(o){this.body=o;return this}};
 }
 async function call(oid='qa-1'){
   const r=res();
   await app.handler({params:{orderId:oid}},r);
   return r;
 }
 return {context,paths,db,call};
}
(async()=>{
 const manual=fixture({links:[{id:'manual-1',order_id:'other-square',url:'https://square.link/u/generic-1'}],sOrders:{'other-square':order}});
 let r=await manual.call();
 assert.equal(r.code,200);assert.equal(r.body.status,'NONE');assert.equal(r.body.canCreate,true);
 assert.equal(manual.paths.length,1,'Generic manual links are not attachable and must not trigger Square order guesses');
 const confirmed=fixture({links:[matched],sOrders:{'square-1':order}});
 r=await confirmed.call();
 assert.equal(r.code,200);assert.equal(r.body.status,'MATCHED');assert.equal(r.body.canCreate,false);
 assert.equal(r.body.url,matched.url);assert.equal(r.body.squareOrderId,'square-1');
 assert.equal(confirmed.paths.length,2);
 const mismatched=fixture({links:[matched],sOrders:{'square-1':{...order,reference_id:'other-qa'}}});
 r=await mismatched.call();assert.equal(r.body.status,'NONE');assert.equal(r.body.canCreate,true);
 const wrongAmount=fixture({links:[matched],sOrders:{'square-1':{...order,total_money:{amount:200,currency:'USD'}}}});
 r=await wrongAmount.call();assert.equal(r.body.status,'NONE');
 const wrongLocation=fixture({links:[matched],sOrders:{'square-1':{...order,location_id:'foreign-location'}}});
 r=await wrongLocation.call();assert.equal(r.body.status,'NONE');
 const duplicate=fixture({links:[matched,{...matched,id:'link-2',url:'https://square.link/u/duplicate'}],sOrders:{'square-1':order}});
 r=await duplicate.call();assert.equal(r.code,409);assert.equal(r.body.status,'BLOCKED');assert.equal(r.body.canCreate,false);
 const offline=fixture({providerError:true});
 r=await offline.call();assert.equal(r.code,503);assert.equal(r.body.canCreate,false);
 assert.equal(r.body.code,'SQUARE_PAYMENT_LINK_LOOKUP_FAILED');
 const denied=fixture({providerError:true});
 denied.context.squareApi=async()=>{throw Object.assign(Error('PRIVATE_ERROR'),{status:403})};
 r=await denied.call();assert.equal(r.code,503);
 assert.equal(r.body.code,'SQUARE_ORDERS_READ_PERMISSION_OR_LOCATION_REJECTED');
 assert.equal(r.body.canCreate,false);
 assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_ERROR/);
 const invalidToken=fixture({providerError:true});
 invalidToken.context.squareApi=async()=>{throw Object.assign(Error('PRIVATE_TOKEN'),{status:401})};
 r=await invalidToken.call();assert.equal(r.body.code,'SQUARE_ACCESS_TOKEN_REJECTED');
 const rateLimited=fixture({providerError:true});
 rateLimited.context.squareApi=async()=>{throw Object.assign(Error('PRIVATE_PROVIDER'),{status:429})};
 r=await rateLimited.call();assert.equal(r.body.code,'SQUARE_PROVIDER_RATE_LIMITED');
 const locked=fixture({readonly:true});
 r=await locked.call();assert.equal(r.code,200);assert.equal(r.body.status,'NONE');assert.equal(r.body.canCreate,false);
 const killed=fixture({blocked:true});
 r=await killed.call();assert.equal(r.body.canCreate,false);
 const uncertain=fixture({orderNotes:JSON.stringify({sbcLaunchQa:{kind:'OWNER_ONLY_ONE_DOLLAR_CHECKOUT'},checkoutLinkStatus:'RECONCILIATION_REQUIRED'})});
 r=await uncertain.call();assert.equal(r.code,409);assert.equal(r.body.canCreate,false);
 const crossTenant=fixture({dbOrder:{...qa,tenantId:8}});
 r=await crossTenant.call();assert.equal(r.code,404);
 const wrongOrder=fixture();
 r=await wrongOrder.call('qa-other');assert.equal(r.code,404);
 for(const f of [manual,confirmed,mismatched,duplicate,offline]){
   assert.equal(f.db.orders.length,1);assert.equal(f.db.squarePayments.length,0);
 }
 console.log('[SBC V6625 SQUARE QA] PASS: provider-matched reference/location/$1, generic links ignored, no duplicate, fail-closed, tenant/owner, no charges or writes');
})().catch(e=>{console.error(e);process.exitCode=1});
