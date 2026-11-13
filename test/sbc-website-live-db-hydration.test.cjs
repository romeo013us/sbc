'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createLiveDbView}=require('../enterprise/sbc-live-db-view.cjs');
const SALES=require('../enterprise/sbc-website-sales-board.cjs');
const CALLS=require('../enterprise/sbc-website-call-desk.cjs');
const APPOINTMENTS=require('../enterprise/sbc-website-appointments.cjs');
const PRODUCTION=require('../enterprise/sbc-website-production-routes.cjs');
const owner={id:'owner',tenantId:1,role:'owner',active:true};
const salesman={id:'sales',tenantId:1,role:'caller',active:true};
const worker={id:'worker',tenantId:1,role:'fulfillment',active:true};
const lead=(id,tenantId=1)=>({id,tenantId,businessName:'Business '+id,contactName:'Owner',phone:'3055550199',
 status:'Lead',verificationStatus:'Sales Ready',assignedTo:'sales',leadIntelligence:{researchBrief:{googleBusinessPresence:'found',websitePresence:'not_found',ownerContactVerified:true}}});
const site={id:'site-1',tenantId:1,customerId:'lead-1',slug:'site-1-abcdef1234',status:'Approved',offerTier:'essentials'};
async function harness(registerRoutes){
 let active={customers:[],orders:[],users:[],appointments:[]};
 const db=createLiveDbView(()=>active);
 let store={websiteDemos:[site],websiteSalesCalls:[],websiteProductionOrders:[]},saves=0;
 const app=express();app.use(express.json());
 app.use((req,res,next)=>{const a=req.header('x-test-user');req.user=a==='owner'?owner:a==='caller'?salesman:a==='worker'?worker:null;next()});
 const auth=(req,res,next)=>req.user?next():res.status(401).json({ok:false});
 const ownerOnly=(req,res,next)=>req.user?.role==='owner'?next():res.status(403).json({ok:false});
 const opts={auth,ownerOnly,requireTenant:req=>req.user.tenantId,db,getStore:()=>store,
  saveStore:async m=>{store=m;saves++;return {ok:true}},saveData:async()=>{saves++;return {ok:true}},
  writerReady:()=>true,now:()=> '2026-11-12T22:00:00.000Z',paidGuard:(o,tid)=>{if(o?.tenantId!==tid||!o.providerCaptured)throw Error('PAYMENT_EVIDENCE_REQUIRED')}};
 registerRoutes(app,opts);
 const srv=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
 async function call(method,route,user='owner',body){
  const r=await fetch('http://127.0.0.1:'+srv.address().port+route,{
   method,headers:{...(user?{'x-test-user':user}:{}),'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
  return {status:r.status,body:await r.json()};
 }
 return {call,get active(){return active},replace:x=>{active=x},get store(){return store},saves:()=>saves,
  close:()=>new Promise(resolve=>srv.close(resolve))};
}

test('MySQL startup replaces db, but both new sales panels still read current 748-style authoritative tenant records',async()=>{
 const h=await harness((app,o)=>{SALES.register(app,o);CALLS.register(app,o)});
 try{
  // Server.js starts with db=loadLocal(), mounts routes, then readRelational()
  // replaces db with normalize({customers: SQL rows}).
  h.replace({customers:[lead('lead-1'),lead('lead-2'),lead('foreign',2)],orders:[],users:[owner,salesman],appointments:[]});
  const sales=await h.call('GET','/api/website-production/sales-board');
  const callDesk=await h.call('GET','/api/website-production/call-desk','caller');
  assert.equal(sales.status,200);assert.equal(callDesk.status,200);
  assert.equal(sales.body.metrics.totalLeads,2,'Must not use stale local db nor leak foreign rows');
  assert.equal(callDesk.body.total,2,'Assigned caller must see their authoritative tenant CRM');
  assert(!JSON.stringify(sales.body).includes('Business foreign'));
  assert(!JSON.stringify(callDesk.body).includes('Business foreign'));
  const after=await h.call('POST','/api/website-production/call-desk/lead-1/outcome','caller',{kind:'BAD_NUMBER'});
  assert.equal(after.status,201);
  assert.equal(h.active.customers[0].websiteSalesBadNumberUntil,'2026-11-27T22:00:00.000Z',
    'Writes must target current hydrated customer, not abandoned local object');
  assert.equal(h.store.websiteSalesCalls.length,1);
  // Simulate later MySQL rehydration; no stale records may remain visible.
  h.replace({customers:[lead('different-tenant',2)],orders:[],users:[owner],appointments:[]});
  assert.equal((await h.call('GET','/api/website-production/sales-board')).body.metrics.totalLeads,0);
  assert.equal((await h.call('GET','/api/website-production/call-desk','caller')).body.total,0);
 }finally{await h.close()}
});
test('booking ten-minute walkthrough uses current CRM after startup and writes to current appointment array',async()=>{
 const h=await harness((app,o)=>APPOINTMENTS.register(app,o));
 try{
  h.replace({customers:[lead('lead-1')],orders:[],users:[owner,salesman],appointments:[]});
  const made=await h.call('POST','/api/website-production/appointments','caller',{customerId:'lead-1',websiteId:'site-1',startAt:'2026-11-14T20:00:00.000Z',prospectConfirmed:true});
  assert.equal(made.status,201,JSON.stringify(made.body));
  assert.equal(h.active.appointments.length,1);
  assert.equal(h.active.appointments[0].websiteId,'site-1');
 }finally{await h.close()}
});
test('post-payment website fulfillment sees current verified order and workers, without weakening payment proof',async()=>{
 const h=await harness((app,o)=>PRODUCTION.register(app,o));
 try{
  h.replace({customers:[lead('lead-1')],orders:[{id:'order-1',tenantId:1,customerId:'lead-1',providerCaptured:true,price:349}],users:[owner,worker],appointments:[]});
  const made=await h.call('POST','/api/website-production/work-orders','owner',{orderId:'order-1',websiteId:'site-1'});
  assert.equal(made.status,201,JSON.stringify(made.body));
  const assigned=await h.call('POST','/api/website-production/work-orders/'+made.body.workOrder.id+'/assign','owner',{task:'content',userId:'worker'});
  assert.equal(assigned.status,200,JSON.stringify(assigned.body));
  const bad=await h.call('POST','/api/website-production/work-orders','owner',{orderId:'nonexistent',websiteId:'site-1'});
  assert.equal(bad.status,404);
 }finally{await h.close()}
});
test('isolated release stage rewires all four Website Production modules to a live database view',()=>{
 const script=require('../scripts/v66-stage-website-live-db.cjs');
 const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const patched=script.patchServer(source);
 assert(patched.includes(script.MARK));assert.equal(script.patchServer(patched),patched);
 new vm.Script(patched);
 for(const n of ['sbc-website-production-routes','sbc-website-appointments','sbc-website-call-desk','sbc-website-sales-board']){
  assert.match(patched,new RegExp("require\\('\\./enterprise/"+n+"\\.cjs'\\)\\.register\\(app,\\{[^\\n]+db:SBC_LIVE_DB"));
 }
 if(process.env.SBC_LIVE_DB_EXPECT_STAGED==='YES')assert.equal(patched,source);
});
