'use strict';
/* SBC V6606 mock route acceptance test: no HTTP server, DB, or Square calls. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'..','server.js'),'utf8');
const transform=require('./v6606-quote-server-hardening.cjs');
const result=transform.patch(source);
const patched=result.source;
assert.match(patched,/sbcV6606QuoteCreateGate/);
assert.match(patched,/sbcV6606QuoteUpdateGuard/);
assert.match(patched,/clientRequestId:req.sbcClientRequestId/);
assert.match(patched,/tenantId:requireRequestTenant\(req\),itemId:b.itemId/);
const marker='/* SBC_V6606_QUOTE_WRITER_HARDENING: draft is not a payment or provisioning approval. */';
const start=patched.indexOf(marker);
const end=patched.indexOf("app.post('/api/quotes',auth,ownerOnly,sbcV6606QuoteCreateGate",start);
assert.ok(start>=0&&end>start);
const block=patched.slice(start,end);
let economicCalls=0,allowEconomic=true;
const db={quotes:[]};
const context={
  SBC_RUNTIME_READ_ONLY:false,sbcShutdownStarted:false,mysqlPool:{},
  MYSQL_RECOVERY_EVALUATED:true,MYSQL_RECOVERY_REQUIRED:false,sbcWriterLeaseReady:true,
  db,requireRequestTenant:req=>req.tenantId,
  FINANCIAL_GOVERNOR:{middleware(action){return (req,res,next)=>{
    economicCalls++;
    assert.ok(['quote_generation','quote_status_change'].includes(action));
    if(allowEconomic)next();
    else res.status(423).json({ok:false,error:'MARGIN_TOO_LOW'});
  };}}
};
vm.createContext(context);
vm.runInContext(block,context);
const create=context.sbcV6606QuoteCreateGate,update=context.sbcV6606QuoteUpdateGuard;
assert.equal(typeof create,'function');assert.equal(typeof update,'function');
const response=()=>({code:200,status(v){this.code=v;return this},json(v){this.body=v;return this}});
function request(status='Draft',tenantId=1){
  return {tenantId,params:{},body:{status,clientRequestId:'stable-request-12345',
    items:[{name:'SBC TEST ITEM',qty:1,unitPrice:1,paymentUrl:'https://square.link/test'}],
    paymentUrl:'https://square.link/test'}};
}
let req=request(),res=response(),proceeded=0;
create(req,res,()=>proceeded++);
assert.equal(proceeded,1);
assert.equal(economicCalls,0,'draft must not invoke payment margin gate');
assert.equal(req.body.paymentUrl,'');
assert.equal(req.body.items[0].paymentUrl,'');
assert.equal(req.sbcDraftUnpriced,true);
assert.equal(req.sbcClientRequestId,'stable-request-12345');
for(const status of ['Paid','Completed','Unknown']){
  req=request(status);res=response();proceeded=0;
  create(req,res,()=>proceeded++);
  assert.equal(proceeded,0);
  assert.equal(res.code,409);
}
context.SBC_RUNTIME_READ_ONLY=true;
req=request();res=response();create(req,res,()=>{throw Error('read-only must not save')});
assert.equal(res.code,423);
context.SBC_RUNTIME_READ_ONLY=false;
context.MYSQL_RECOVERY_REQUIRED=true;
req=request();res=response();create(req,res,()=>{throw Error('recovery must not save')});
assert.equal(res.code,423);
context.MYSQL_RECOVERY_REQUIRED=false;
db.quotes.push({id:'quote-1',tenantId:1,clientRequestId:'stable-request-12345',status:'Draft',
  items:[{name:'SBC TEST ITEM',qty:1,unitPrice:1}],total:1});
req=request();res=response();proceeded=0;
create(req,res,()=>proceeded++);
assert.equal(proceeded,0);
assert.equal(res.code,200);
assert.equal(res.body.id,'quote-1');
req=request('Draft',2);res=response();proceeded=0;
create(req,res,()=>proceeded++);
assert.equal(proceeded,1,'another tenant may not use the same idempotency identity');
db.quotes[0].clientRequestId='different-request';
req={tenantId:2,params:{id:'quote-1'},body:{status:'Paid'}};res=response();proceeded=0;
update(req,res,()=>proceeded++);assert.equal(res.code,404);assert.equal(proceeded,0);
req={tenantId:1,params:{id:'quote-1'},body:{status:'Paid'}};res=response();
update(req,res,()=>{throw Error('manual Paid must never proceed')});
assert.equal(res.code,409);assert.equal(res.body.error,'PAYMENT_PROOF_REQUIRED');
req={tenantId:1,params:{id:'quote-1'},body:{status:'Won',total:1}};res=response();
update(req,res,()=>{throw Error('immutable amount write must never proceed')});
assert.equal(res.code,422);assert.equal(res.body.error,'QUOTE_FINANCIAL_FIELDS_IMMUTABLE');
req={tenantId:1,params:{id:'quote-1'},body:{status:'Won'}};res=response();proceeded=0;
allowEconomic=false;const costCallBefore=economicCalls;
update(req,res,()=>proceeded++);
assert.equal(proceeded,0);assert.equal(res.code,423);
assert.equal(economicCalls,costCallBefore+1);
allowEconomic=true;req={tenantId:1,params:{id:'quote-1'},body:{status:'Won'}};res=response();proceeded=0;
update(req,res,()=>proceeded++);
assert.equal(proceeded,1);assert.equal(req.body.items,undefined,'the update handler must never receive synthetic mutable line-items');
db.quotes[0].status='Paid';
req={tenantId:1,params:{id:'quote-1'},body:{status:'Draft'}};res=response();proceeded=0;
update(req,res,()=>proceeded++);
assert.equal(proceeded,0);assert.equal(res.code,409);
console.log('[SBC V6606] PASS: draft saved without economic mutation, no manual Paid, quote idempotency, tenant isolation, recovery locks, immutable amounts, margin approval.');
