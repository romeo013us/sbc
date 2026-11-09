'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const P=require('../routes/sbc-nextday-outbound-v1.cjs');
function mock(){
 const routes=new Map(),db={customers:[
  {id:'lead1',tenantId:1,businessName:'Real Repair Shop',industry:'Auto repair',phone:'3055550112',email:'hello@example.com',source:'Public business listing',status:'Lead',verificationStatus:'Verified'},
  {id:'lead2',tenantId:2,businessName:'Other Tenant',industry:'Food',phone:'3055550199',email:'other@example.com',status:'Lead',verificationStatus:'Verified'},
  {id:'lead3',tenantId:1,businessName:'Opted Out',phone:'3055550123',status:'Do Not Call',email:'dnc@example.com'}
 ],users:[{id:'caller1',tenantId:1,role:'caller',name:'Caller One',active:true}],tasks:[],appointments:[],callReports:[],
 megaOpsStore:{websiteDemos:[{id:'demo1',customerId:'lead1',slug:'real-repair-shop-lead1',status:'Ready',archived:false}]}};
 let persisted=0,blocked=false;
 const app={get(p,...h){routes.set('GET '+p,h)},post(p,...h){routes.set('POST '+p,h)}};
 P.register(app,{auth:(req,res,next)=>next(),ownerOnly:(req,res,next)=>next(),
  getDb:()=>db,saveData:async()=>{persisted++;if(blocked)throw Error('DATABASE_UNAVAILABLE')},
  requireTenant:req=>req.tenantId,requireWriter:()=>{},makeId:p=>p+'_'+Math.random().toString(36).slice(2),
  now:()=>new Date().toISOString()});
 const invoke=async(method,url,params={})=>{
  const r={code:200,body:null,status(n){this.code=n;return this},
   json(x){this.body=x;return this},setHeader(){}};
  const h=routes.get(method+' '+url);assert.ok(h,method+' '+url+' registered');
  const req={user:{id:'owner',role:'owner'},tenantId:1,query:params.query||{},body:params.body||{}};
  await h[h.length-1](req,r);return r;
 };
 return {db,routes,invoke,persisted:()=>persisted,setBlocked:x=>{blocked=x}};
}
(async()=>{
 const email=P.intro({id:'x',businessName:'A shop',industry:'Auto repair'});
 assert.match(email.text,/Jonathan Jones/);
 assert.match(email.text,/info@sbcmia.com/);
 assert.doesNotMatch(email.text,/we have also prepared a sample website preview/i);
 const demoEmail=P.intro({id:'x',businessName:'A shop',industry:'Auto repair'},{ready:true});
 assert.match(demoEmail.text,/prepared a sample website preview/i);
 assert.equal(P.blocked({status:'Do Not Call'}),true);
 assert.equal(P.phone('(305) 555-0144'),'+13055550144');
 const m=mock();
 let res=await m.invoke('GET','/api/owner/nextday/preview',{query:{limit:20}});
 assert.equal(res.body.candidates.length,1);
 assert.equal(res.body.candidates[0].demo.ready,true);
 assert.match(res.body.candidates[0].draft.text,/website preview/i);
 assert.equal(m.db.tasks.length,0,'read-only preview must not create tasks');
 const day=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
 res=await m.invoke('POST','/api/owner/nextday/prepare',{body:{leadIds:['lead1'],callDate:day,assignedTo:'caller1',confirm:'OWNER_REVIEWED_PREP'}});
 assert.equal(res.body.ok,true);
 assert.equal(res.body.created,1);
 assert.equal(res.body.emailSent,0);
 assert.equal(m.db.tasks.length,1);
 assert.equal(m.db.customers[0].assignedTo,'caller1');
 res=await m.invoke('POST','/api/owner/nextday/prepare',{body:{leadIds:['lead1'],callDate:day,assignedTo:'caller1',confirm:'OWNER_REVIEWED_PREP'}});
 assert.equal(res.body.created,0,'repeat is idempotent');
 m.db.callReports.push({id:'call1',customerId:'lead1',appointmentRequested:true,createdAt:new Date().toISOString()});
 res=await m.invoke('GET','/api/owner/nextday/priorities');
 assert.equal(res.body.ok,true);
 assert.ok(res.body.appointmentRequests>=1);
 assert.equal(res.body.records[0].kind,'APPOINTMENT_REQUEST');
 res=await m.invoke('POST','/api/owner/nextday/appointment',{body:{customerId:'lead1',startAt:new Date(Date.now()+5*86400000).toISOString(),customerConfirmed:false}});
 assert.equal(res.code,422,'no unconfirmed customer booking');
 const date=new Date(Date.now()+5*86400000).toISOString();
 res=await m.invoke('POST','/api/owner/nextday/appointment',{body:{customerId:'lead1',startAt:date,customerConfirmed:true}});
 assert.equal(res.code,201);
 assert.equal(m.db.appointments.length,1);
 assert.equal(m.db.tasks.length,2);
 res=await m.invoke('POST','/api/owner/nextday/appointment',{body:{customerId:'lead1',startAt:date,customerConfirmed:true}});
 assert.equal(res.code,409,'duplicate appointment is blocked');
 res=await m.invoke('GET','/api/owner/nextday/priorities');
 assert.equal(res.body.appointmentRequests,0,'scheduled appointment removes request');
 assert.ok(res.body.records.some(x=>x.kind==='APPOINTMENT'));
 for(const p of ['public/index.html','browser_public/index.html']){
  const s=fs.readFileSync(path.join(__dirname,'..',p),'utf8');
  assert.match(s,/sbc-nextday-nav-link/);
  assert.match(s,/sbc-nextday-sales-prep-v1\.js/);
 }
 for(const p of ['public/sbc-nextday-sales-prep-v1.js','browser_public/sbc-nextday-sales-prep-v1.js']){
  const s=fs.readFileSync(path.join(__dirname,'..',p),'utf8');
  assert.match(s,/sbc-nextday-priorities/);
  assert.match(s,/customerConfirmed:true/);
 }
 console.log('PASS SBC next-day outbound: tenant, suppression, real demo, no-send, persistence, duplicate guards, due-first appointments');
})().catch(e=>{console.error(e);process.exitCode=1});
