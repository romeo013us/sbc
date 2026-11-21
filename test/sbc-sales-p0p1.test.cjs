'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {register,projectActions,reminderCandidates}=require('../enterprise/sbc-sales-p0p1.cjs');
const ACCESS=require('../enterprise/sbc-account-manager-role-gate-v2.cjs');
const base='2026-11-20T15:00:00.000Z';
const actors={owner:{id:'boss',role:'owner',tenantId:1,active:true},am:{id:'am1',role:'account_manager',tenantId:1,active:true},other:{id:'am2',role:'account_manager',tenantId:1,active:true},foreign:{id:'amX',role:'account_manager',tenantId:2,active:true},researcher:{id:'research',role:'lead_researcher',tenantId:1,active:true}};
const customer=(id,extra={})=>({id,tenantId:1,assignedTo:'am1',businessName:'Synthetic '+id,verificationStatus:'Sales Ready',phone:'+13055550123',email:'synthetic@example.com',status:'Lead',leadIntelligence:{researchBrief:{websitePresence:'not_found',googleBusinessPresence:'found'}},...extra});
function model(){return {customers:[customer('one'),customer('blocked',{doNotContact:true}),customer('other',{assignedTo:'am2'}),customer('foreign',{tenantId:2,assignedTo:'amX'})],appointments:[],callLogs:[]}}
const agent=()=>({agents:[],called:0});
async function harness({duringSave}={}){
 const db=model(),routes=[],saves=[];let writer=true;
 const app={};for(const method of ['get','post','put','delete'])app[method]=(path,...handlers)=>routes.push({method:method.toUpperCase(),path,handlers});
 const auth=(req,res,next)=>req.user?next():res.status(401).json({code:'LOGIN_REQUIRED'});
 register(app,{auth,requireTenant:req=>req.tenantId,db,save:async()=>{if(duringSave)duringSave(db);saves.push(structuredClone(db.appointments));return {ok:true,persisted:true}},writerReady:()=>writer,id:()=>`appt_${db.appointments.length+1}`,now:()=>base});
 const call=async(method,url,user,body)=>{
  const [pathname,queryString]=url.split('?');const query=Object.fromEntries(new URLSearchParams(queryString||''));
  let found=routes.find(r=>r.method===method&&r.path===pathname),params={};
  if(!found){found=routes.find(r=>{if(r.method!==method||!r.path.includes(':id'))return false;const prefix=r.path.split(':id')[0];if(!pathname.startsWith(prefix))return false;params={id:pathname.slice(prefix.length)};return Boolean(params.id)&&!params.id.includes('/')});}
  if(!found)throw Error('ROUTE_NOT_REGISTERED '+method+' '+url);
  const req={user:actors[user]||null,tenantId:actors[user]?.tenantId,body,query,params,headers:{}};
  const res={statusCode:200,data:null,sent:false,status(n){this.statusCode=n;return this},set(){return this},json(data){this.data=data;this.sent=true;return this}};
  for(const fn of found.handlers){if(res.sent)break;if(fn.length>=3){let done=false;await fn(req,res,()=>{done=true});if(!done&&res.sent)break}else await fn(req,res)}
  return {status:res.statusCode,body:res.data};
 };
 return {db,call,saves,close:async()=>{},setWriter:x=>writer=x};
}
const booking=(id='one')=>({customerId:id,title:'10-minute SBC website preview',startAt:'2026-11-23T15:00:00.000Z',endAt:'2026-11-23T15:10:00.000Z',location:'Zoom link to be confirmed'});
test('global AM gate admits only scoped appointment writes/read actions, not deletes',()=>{
 assert.equal(ACCESS.allowed('POST','/api/appointments'),true);
 assert.equal(ACCESS.allowed('PUT','/api/appointments/appt_1'),true);
 assert.equal(ACCESS.allowed('GET','/api/sbc/sales/actions/today'),true);
 assert.equal(ACCESS.allowed('GET','/api/sbc/sales/reminders/preview'),true);
 assert.equal(ACCESS.allowed('DELETE','/api/appointments/appt_1'),false);
 assert.equal(ACCESS.allowed('POST','/api/appointments/%2e%2e'),false);
});
test('Account Manager can book assigned prospect without prebuilt or approved website',async()=>{
 const s=await harness();try{
  const ok=await s.call('POST','/api/appointments','am',booking());
  assert.equal(ok.status,201);assert.equal(ok.body.ok,true);assert.equal(ok.body.durable,true);
  assert.equal(s.db.appointments[0].tenantId,1);assert.equal(s.db.appointments[0].createdBy,'am1');
  assert.equal(s.db.appointments[0].status,'Scheduled');assert.equal(s.saves.length,1);
 }finally{await s.close()}
});
test('cannot book someone else’s account, foreign tenant, suppressed, or unauthenticated',async()=>{
 const s=await harness();try{
  for(const [user,which,code] of [['am','other',404],['am','foreign',404],['am','blocked',403],['researcher','one',403],[null,'one',401]]){
   const r=await s.call('POST','/api/appointments',user,booking(which));assert.equal(r.status,code,[user,which].join('/'));
  }
  assert.equal(s.db.appointments.length,0);
 }finally{await s.close()}
});
test('appointment validation rejects invalid clock times and payload injection',async()=>{
 const s=await harness();try{
  const d=booking();
  assert.equal((await s.call('POST','/api/appointments','am',{...d,startAt:'nope'})).status,400);
  assert.equal((await s.call('POST','/api/appointments','am',{...d,endAt:d.startAt})).status,400);
  assert.equal((await s.call('POST','/api/appointments','am',{...d,startAt:'2025-01-01T00:00:00Z',endAt:'2025-01-01T00:10:00Z'})).status,400);
  assert.equal((await s.call('POST','/api/appointments','am',{...d,tenantId:2,createdBy:'boss',status:'Completed'})).status,400);
  assert.equal(s.db.appointments.length,0);
 }finally{await s.close()}
});
test('AM can reschedule own account; cannot edit other AM or another tenant appointment',async()=>{
 const s=await harness();try{
  const a=await s.call('POST','/api/appointments','am',booking());assert.equal(a.status,201);
  const id=a.body.appointment.id;
  const updated=await s.call('PUT',`/api/appointments/${id}`,'am',{...booking(),startAt:'2026-11-24T15:00:00Z',endAt:'2026-11-24T15:10:00Z',status:'Scheduled'});
  assert.equal(updated.status,200);assert.equal(updated.body.appointment.startAt,'2026-11-24T15:00:00.000Z');
  assert.equal((await s.call('PUT',`/api/appointments/${id}`,'other',{...booking(),status:'Cancelled'})).status,404);
  assert.equal((await s.call('PUT',`/api/appointments/${id}`,'foreign',{...booking(),status:'Cancelled'})).status,404);
  assert.equal(s.db.appointments[0].status,'Scheduled');
 }finally{await s.close()}
});
test('read-only writer gate blocks all booking mutations',async()=>{
 const s=await harness();try{s.setWriter(false);const r=await s.call('POST','/api/appointments','am',booking());assert.equal(r.status,423);assert.equal(s.saves.length,0);assert.equal(s.db.appointments.length,0)}finally{await s.close()}
});
test('daily action queue sorts meeting review, due callback, meeting prep, verified leads and never leaks assignments',()=>{
 const d=model();d.customers.push(customer('callback',{followUp:'2026-11-19'}));
 d.appointments.push({id:'old',tenantId:1,customerId:'one',title:'10-minute SBC website preview',status:'Scheduled',startAt:'2026-11-19T15:00:00Z',endAt:'2026-11-19T15:10:00Z'});
 const r=projectActions({...d,actor:actors.am,tenantId:1,now:base});
 assert.equal(r.rows[0].type,'MEETING_REVIEW');
 assert(r.rows.some(x=>x.type==='DUE_CALLBACK'&&x.customerId==='callback'));
 assert(!r.rows.some(x=>x.customerId==='other'||x.customerId==='blocked'||x.customerId==='foreign'));
 assert.match(r.rows.find(x=>x.type==='MEETING_REVIEW').nextAction,/verify|confirm|review/i);
});
test('meeting reminders are draft-only with explicit consent and meeting link, never sent',()=>{
 const c=customer('one',{appointmentReminderConsent:{email:{verified:true,source:'Customer opted in on booking form',timestamp:'2026-11-20T14:00:00Z'}}});
 const a={id:'a',tenantId:1,customerId:'one',status:'Scheduled',title:'10-minute SBC website preview',startAt:'2026-11-21T15:30:00Z',endAt:'2026-11-21T15:40:00Z',location:'https://zoom.us/j/123456789'};
 const r=reminderCandidates({customers:[c],appointments:[a],actor:actors.am,tenantId:1,now:'2026-11-20T15:30:00Z'});
 assert.equal(r.sendEnabled,false);assert.equal(r.rows.length,1);assert.equal(r.rows[0].channel,'email');assert.equal(r.rows[0].status,'DRAFT_ONLY');assert.match(r.rows[0].idempotencyKey,/^[a-f0-9]{64}$/);
 const blocked=reminderCandidates({customers:[{...c,doNotContact:true}],appointments:[a],actor:actors.am,tenantId:1,now:'2026-11-20T15:30:00Z'});
 assert.equal(blocked.rows.length,0);
});
test('source package connects API, AM UI, mirrors and preserves the owner calling hook',()=>{
 const root=path.join(__dirname,'..');const src=fs.readFileSync(path.join(root,'server.js'),'utf8');
 assert.match(src,/SBC_SALES_P0P1\.register\(/);
 const ui=fs.readFileSync(path.join(root,'public/sbc-account-manager-v1.js'),'utf8');
 assert.match(ui,/Revenue Actions/);assert.match(ui,/api\/sbc\/sales\/actions\/today/);
 assert.match(ui,/Book 10-minute Zoom/);
 assert.equal(ui,fs.readFileSync(path.join(root,'browser_public/sbc-account-manager-v1.js'),'utf8'));
 const call=fs.readFileSync(path.join(root,'public/sbc-website-sales-script-v1.js'),'utf8');
 assert.match(call,/WELL, THE THING IS, I BUILT YOU ONE!/);
 assert.match(fs.readFileSync(path.join(root,'public/sbc-website-call-desk-v1.js'),'utf8'),/SBC_REVENUE_TODAY/);
});


test('latest declined or bad-number call excludes the account from recommended outreach',()=>{
 const d=model();
 d.callLogs=[{customerId:'one',tenantId:1,createdAt:'2026-11-20T14:00:00Z',outcome:'Not interested'},
             {customerId:'other',tenantId:1,createdAt:'2026-11-20T14:00:00Z',outcome:'Bad number'}];
 const p=projectActions({...d,actor:actors.am,tenantId:1,now:base});
 assert(!p.rows.some(x=>x.customerId==='one'));
});
test('two different businesses assigned to one AM cannot occupy the same Zoom slot',async()=>{
 const s=await harness();try{
  s.db.customers.push(customer('same-manager'));
  const first=await s.call('POST','/api/appointments','am',booking('one'));
  assert.equal(first.status,201);
  const collision=await s.call('POST','/api/appointments','am',booking('same-manager'));
  assert.equal(collision.status,409);assert.equal(collision.body.code,'APPOINTMENT_SLOT_CONFLICT');
  assert.equal(s.db.appointments.length,1);
 }finally{await s.close()}
});

 test('booking save failure preserves an independently recorded meeting',async()=>{
 const s=await harness({duringSave(db){db.appointments.push({id:'independent',tenantId:1,customerId:'other',status:'Scheduled'});throw Error('synthetic storage failure')}});
 const r=await s.call('POST','/api/appointments','am',booking());assert.equal(r.status,503);assert.deepEqual(s.db.appointments.map(a=>a.id),['independent']);
 });
