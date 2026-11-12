'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {register}=require('../enterprise/sbc-website-production-routes.cjs');
async function runCase(verify,{paid=true,writer=true}={}){
 const owner={id:'owner',role:'owner',tenantId:1,active:true};
 const worker={id:'worker',role:'fulfillment',tenantId:1,active:true};
 const db={orders:[{id:'ord-1',customerId:'c1',tenantId:1,price:349}],customers:[{id:'c1',tenantId:1}],users:[owner,worker]};
 let store={websiteDemos:[{id:'site-1',customerId:'c1',tenantId:1,status:'Approved',offerTier:'essentials'}],websiteProductionOrders:[]};
 const app=express();app.use(express.json());
 app.use((req,res,next)=>{req.user=req.header('x-test')==='owner'?owner:req.header('x-test')==='worker'?worker:null;next();});
 const auth=(req,res,next)=>req.user?next():res.status(401).json({ok:false});
 const ownerOnly=(req,res,next)=>req.user.role==='owner'?next():res.status(403).json({ok:false});
 register(app,{auth,ownerOnly,requireTenant:req=>req.user.tenantId,db,getStore:()=>store,saveStore:async next=>{store=next;return {ok:true}},writerReady:()=>writer,paidGuard:(order,tenant)=>{if(!paid||tenant!==1)throw Error('PAYMENT_EVIDENCE_REQUIRED')}});
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
 const call=async(method,url,body,role='owner')=>{
  const r=await fetch('http://127.0.0.1:'+server.address().port+url,{method,headers:{'Content-Type':'application/json',...(role?{'x-test':role}:{})},body:body?JSON.stringify(body):undefined});
  return {status:r.status,body:await r.json()};
 };
 try{await verify(call,()=>store)}finally{await new Promise(resolve=>server.close(resolve))}
}
test('only owner on writer with verified payment can begin a website work order',async()=>{
 await runCase(async call=>{
  const noAuth=await call('POST','/api/website-production/work-orders',{orderId:'ord-1',websiteId:'site-1'},'');
  assert.equal(noAuth.status,401);
  const noRole=await call('POST','/api/website-production/work-orders',{orderId:'ord-1',websiteId:'site-1'},'worker');
  assert.equal(noRole.status,403);
  const created=await call('POST','/api/website-production/work-orders',{orderId:'ord-1',websiteId:'site-1'});
  assert.equal(created.status,201);assert.equal(created.body.workOrder.status,'IN_PRODUCTION');
  const duplicate=await call('POST','/api/website-production/work-orders',{orderId:'ord-1',websiteId:'site-1'});
  assert.equal(duplicate.status,200);assert.equal(duplicate.body.workOrder.id,created.body.workOrder.id);
  assert.equal(created.body.workOrder.contractorRequests.length,0);
 });
 await runCase(async call=>{
  const r=await call('POST','/api/website-production/work-orders',{orderId:'ord-1',websiteId:'site-1'});
  assert.equal(r.status,409);assert.equal(r.body.code,'PAYMENT_EVIDENCE_REQUIRED');
 },{paid:false});
 await runCase(async call=>{assert.equal((await call('POST','/api/website-production/work-orders',{orderId:'ord-1',websiteId:'site-1'})).status,423)},{writer:false});
});
test('only assigned staff may see and complete tasks; owner controls external contractor costs',async()=>{
 await runCase(async call=>{
  const made=await call('POST','/api/website-production/work-orders',{orderId:'ord-1',websiteId:'site-1'});
  const key=made.body.workOrder.id;
  assert.equal((await call('GET','/api/website-production/work-orders/'+key,undefined,'worker')).status,404);
  assert.equal((await call('POST','/api/website-production/work-orders/'+key+'/complete',{task:'intake'},'worker')).status,403);
  const assigned=await call('POST','/api/website-production/work-orders/'+key+'/assign',{task:'content',userId:'worker'});
  assert.equal(assigned.status,200);
  const workerRead=await call('GET','/api/website-production/work-orders/'+key,undefined,'worker');
  assert.equal(workerRead.status,200);assert.deepEqual(workerRead.body.workOrder.contractorRequests,[]);
  assert.equal((await call('POST','/api/website-production/work-orders/'+key+'/complete',{task:'content'},'worker')).status,409);
  assert.equal((await call('POST','/api/website-production/work-orders/'+key+'/complete',{task:'intake'})).status,200);
  assert.equal((await call('POST','/api/website-production/work-orders/'+key+'/complete',{task:'content'},'worker')).status,200);
  assert.equal((await call('POST','/api/website-production/work-orders/'+key+'/vendor',{source:'contra',task:'build',estimatedCents:4500,profileUrl:'https://contra.com/some-pro'},'worker')).status,403);
  const req=await call('POST','/api/website-production/work-orders/'+key+'/vendor',{source:'contra',task:'build',estimatedCents:4500,profileUrl:'https://contra.com/some-pro'});
  assert.equal(req.status,200);assert.equal(req.body.workOrder.contractorRequests[0].status,'OWNER_REVIEW_REQUIRED');
 });
});
