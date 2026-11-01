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
assert.doesNotMatch(code,/await saveData\(|squareApi\('\/v2\/online-checkout\/payment-links',\s*\{\s*method:\s*'POST'/,'QA reconciliation cannot create links or write records');
assert.match(code,/squareApi\('\/v2\/orders\/search',\{method:'POST'/,'Provider SearchOrders is a read-only POST');
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
const qa={id:'qa-1',tenantId:7,price:1,createdAt:new Date(Date.now()-60000).toISOString(),product:'SBC Launch QA - $1 Test Service',
 notes:JSON.stringify({sbcLaunchQa:{kind:'OWNER_ONLY_ONE_DOLLAR_CHECKOUT',version:1}})};
const order={id:'square-1',reference_id:'qa-1',location_id:'location-1',total_money:{amount:100,currency:'USD'}};
const matched={id:'link-1',order_id:'square-1',url:'https://square.link/u/internal-qa',
 payment_note:'SBC Order qa-1'};
function fixture({links=[],pages=null,sOrders={},searchOrders=[],searchPages=null,providerError=false,readonly=false,blocked=false,
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
  squareApi:async (p,options={})=>{
    paths.push(p);
    if(providerError)throw Error('NO_NETWORK');
    if(p==='/v2/orders/search'){
      assert.equal(options.method,'POST');
      const f=options.body?.query?.filter?.date_time_filter?.created_at?.start_at;
      assert.ok(f&&Number.isFinite(Date.parse(f)),'Date-scoped QA Square order search');
      assert.equal(options.body?.query?.sort?.sort_field,'CREATED_AT');
      assert.equal(options.body?.location_ids?.[0],'location-1');
      const cursor=String(options.body.cursor||'');
      return searchPages?searchPages[cursor]||{orders:[]}:{orders:searchOrders};
    }
    if(p.startsWith('/v2/online-checkout/payment-links')){
      const cursor=new URL('https://test.invalid'+p).searchParams.get('cursor')||'';
      return pages?pages[cursor]||{payment_links:[]}: {payment_links:links};
    }
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
 assert.equal(manual.paths.length,1,'No QA provider order means unrelated payment links never scanned');
 assert.equal(manual.paths[0],'/v2/orders/search');
 const confirmed=fixture({links:[matched],sOrders:{'square-1':order},searchOrders:[order]});
 r=await confirmed.call();
 assert.equal(r.code,200);assert.equal(r.body.status,'MATCHED');assert.equal(r.body.canCreate,false);
 assert.equal(r.body.url,matched.url);assert.equal(r.body.squareOrderId,'square-1');
 assert.equal(confirmed.paths.length,3);
 const mismatched=fixture({links:[matched],sOrders:{'square-1':{...order,reference_id:'other-qa'}},searchOrders:[{...order,reference_id:'other-qa'}]});
 r=await mismatched.call();assert.equal(r.body.status,'NONE');assert.equal(r.body.canCreate,true);
 const wrongAmount=fixture({links:[matched],sOrders:{'square-1':{...order,total_money:{amount:200,currency:'USD'}}},searchOrders:[{...order,total_money:{amount:200,currency:'USD'}}]});
 r=await wrongAmount.call();assert.equal(r.body.status,'BLOCKED');assert.equal(r.body.reason,'SQUARE_QA_ORDER_DETAILS_MISMATCH');
 const wrongLocation=fixture({links:[matched],sOrders:{'square-1':{...order,location_id:'foreign-location'}},searchOrders:[{...order,location_id:'foreign-location'}]});
 r=await wrongLocation.call();assert.equal(r.body.status,'BLOCKED');assert.equal(r.body.reason,'SQUARE_QA_ORDER_DETAILS_MISMATCH');
 const duplicate=fixture({links:[matched,{...matched,id:'link-2',url:'https://square.link/u/duplicate'}],sOrders:{'square-1':order},searchOrders:[order]});
 r=await duplicate.call();assert.equal(r.code,409);assert.equal(r.body.status,'BLOCKED');assert.equal(r.body.canCreate,false);
 // An exact match buried beyond page one is recovered without an extra link.
 const longAccount=fixture({pages:{
   '':{payment_links:[{id:'generic',order_id:'other',url:'https://square.link/u/generic'}],cursor:'next'},
   next:{payment_links:[matched]}
 },sOrders:{'square-1':order},searchOrders:[order]});
 r=await longAccount.call();assert.equal(r.code,200);
 assert.equal(r.body.status,'MATCHED');assert.equal(r.body.canCreate,false);
 assert.equal(longAccount.paths.length,4);
 assert.match(longAccount.paths[2],/cursor=next/);
 // Duplicate links across different pages remain blocked.
 const crossPageDuplicate=fixture({pages:{
   '':{payment_links:[matched],cursor:'second'},
   second:{payment_links:[{...matched,id:'second',url:'https://square.link/u/second'}]}
 },sOrders:{'square-1':order},searchOrders:[order]});
 r=await crossPageDuplicate.call();assert.equal(r.code,409);
 assert.equal(r.body.reason,'MULTIPLE_MATCHING_SQUARE_LINKS');
 assert.match(r.body.message,/Multiple Square links/);
 assert.equal(r.body.canCreate,false);
 // A repeated cursor must fail closed rather than looping or authorizing checkout.
 const repeated=fixture({pages:{
   '':{payment_links:[],cursor:'loop'},
   loop:{payment_links:[],cursor:'loop'}
 },searchOrders:[order]});
 r=await repeated.call();assert.equal(r.code,409);
 assert.equal(r.body.reason,'SQUARE_LINK_CURSOR_REPEATED');assert.equal(r.body.canCreate,false);
 // Even with the documented page size, a truly massive account stays blocked.
 const giant=fixture({searchOrders:[order]});
 giant.context.squareApi=async p=>{giant.paths.push(p);
   if(p==='/v2/orders/search')return {orders:[order]};
   return {payment_links:[],cursor:String(giant.paths.length)};
 };
 r=await giant.call();assert.equal(r.code,409);
 assert.equal(r.body.reason,'SQUARE_LINK_PAGINATION_INCOMPLETE');
 assert.match(r.body.message,/inventory is incomplete/);
 assert.equal(giant.paths.length,21);
 assert.equal(r.body.canCreate,false);
 // Unrelated historical links do not block a newly created QA order.
 const unrelated=fixture({searchOrders:[{...order,reference_id:'other'}],pages:{
   '':{payment_links:[],cursor:'endless'}
 }});
 r=await unrelated.call();assert.equal(r.code,200);
 assert.equal(r.body.status,'NONE');assert.equal(r.body.canCreate,true);
 assert.equal(unrelated.paths.length,1);
 // Existing provider order with no recovered link must fail closed.
 const unrecovered=fixture({searchOrders:[order],links:[]});
 r=await unrecovered.call();assert.equal(r.code,409);
 assert.equal(r.body.reason,'SQUARE_QA_PROVIDER_ORDER_LINK_NOT_FOUND');
 assert.equal(r.body.canCreate,false);
 const orderLoop=fixture({searchPages:{
   '':{orders:[],cursor:'again'},again:{orders:[],cursor:'again'}
 }});
 r=await orderLoop.call();assert.equal(r.code,409);
 assert.equal(r.body.reason,'SQUARE_ORDER_SEARCH_CURSOR_REPEATED');assert.equal(r.body.canCreate,false);
 const twoOrders=fixture({searchOrders:[order,{...order,id:'second-square-order'}]});
 r=await twoOrders.call();assert.equal(r.code,409);
 assert.equal(r.body.reason,'MULTIPLE_MATCHING_SQUARE_ORDERS');assert.equal(r.body.canCreate,false);
 const noTimestamp=fixture({dbOrder:{...qa,createdAt:''}});
 r=await noTimestamp.call();assert.equal(r.code,409);
 assert.equal(r.body.reason,'SQUARE_QA_CREATION_TIMESTAMP_UNAVAILABLE');
 assert.equal(noTimestamp.paths.length,0);
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
 console.log('[SBC V6625 SQUARE QA] PASS: date-scoped Square order proof, no unrelated link scans, duplicate order and mismatch safeguards, no charges or writes');
})().catch(e=>{console.error(e);process.exitCode=1});
