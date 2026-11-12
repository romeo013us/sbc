'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {prepare,register}=require('../enterprise/sbc-website-appointments.cjs');
const owner={id:'owner',role:'owner',tenantId:1,active:true},caller={id:'sales-1',role:'caller',tenantId:1,active:true};
const customer={id:'c1',tenantId:1,assignedTo:'sales-1',businessName:'Synthetic Detailers',status:'Lead'};
const site={id:'s1',tenantId:1,customerId:'c1',slug:'synthetic-a31a',status:'Approved',offerTier:'essentials'};
const now='2026-11-12T17:00:00.000Z',tomorrow='2026-11-13T19:00:00.000Z';
test('ten-minute walkthrough requires owner-approved website, tenant, assigned caller and affirmative agreement',()=>{
 const input={customer,site,actor:caller,startAt:tomorrow,confirmed:true,now};
 const a=prepare(input);
 assert.equal(a.websiteId,'s1');assert.equal(a.customerId,'c1');assert.equal(a.tenantId,1);
 assert.equal(a.durationMinutes,10);assert.equal(a.status,'Scheduled');assert.equal(a.endAt,'2026-11-13T19:10:00.000Z');
 assert.equal(a.assignedTo,'sales-1');assert.match(a.title,/Website walkthrough/);
 assert.throws(()=>prepare({...input,confirmed:false}),/APPOINTMENT_CONFIRMATION_REQUIRED/);
 assert.throws(()=>prepare({...input,site:{...site,status:'Draft'}}),/WEBSITE_NOT_APPROVED/);
 assert.throws(()=>prepare({...input,site:{...site,tenantId:2}}),/TENANT_CONTEXT_REQUIRED/);
 assert.throws(()=>prepare({...input,customer:{...customer,assignedTo:'other'}}),/NOT_ASSIGNED/);
 assert.throws(()=>prepare({...input,customer:{...customer,doNotContact:true}}),/CONTACT_SUPPRESSED/);
 assert.throws(()=>prepare({...input,startAt:'2025-11-12T19:00:00Z'}),/APPOINTMENT_INVALID_TIME/);
 assert.throws(()=>prepare({...input,startAt:'bogus'}),/APPOINTMENT_INVALID_TIME/);
});
test('approved site creates persistent meeting once; anonymous, unassigned and unconfirmed calls blocked',async()=>{
 const app=express();app.use(express.json());
 const db={appointments:[],customers:[customer]};let store={websiteDemos:[site]},saves=0;
 app.use((req,res,next)=>{const a=req.header('x-test');req.user=a==='owner'?owner:a==='caller'?caller:a==='foreign'?{...caller,tenantId:2}:null;next()});
 const auth=(req,res,next)=>req.user?next():res.status(401).json({ok:false});
 register(app,{auth,requireTenant:req=>req.user.tenantId,db,getStore:()=>store,saveData:async()=>{saves++;return {ok:true}},writerReady:()=>true,now:()=>now});
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
 const request=async(role,body)=>{const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/website-production/appointments',{method:'POST',headers:{'content-type':'application/json',...(role?{'x-test':role}:{})},body:JSON.stringify(body)});return {status:r.status,body:await r.json()}};
 try{
 const body={customerId:'c1',websiteId:'s1',startAt:tomorrow,prospectConfirmed:true};
 assert.equal((await request('foreign',body)).status,404);
 assert.equal((await request('caller',{...body,prospectConfirmed:false})).status,400);
 assert.equal((await request('',body)).status,401);
 const made=await request('caller',body);assert.equal(made.status,201);
 assert.equal(made.body.appointment.status,'Scheduled');assert.equal(db.appointments.length,1);assert.equal(saves,1);
 const again=await request('caller',body);assert.equal(again.status,200);
 assert.equal(again.body.appointment.id,made.body.appointment.id);assert.equal(db.appointments.length,1);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
