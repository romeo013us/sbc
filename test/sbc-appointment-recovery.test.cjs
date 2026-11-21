'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {createService}=require('../enterprise/sbc-connected-journey.cjs');
const {createRecovery}=require('../enterprise/sbc-appointment-recovery.cjs');
const owner={id:'boss',tenantId:1,role:'owner',active:true};
async function fixture(){let stamp='2026-11-20T15:00:00Z',enabled=false,failSave=false,sent=0,failSend=false;
 const db={users:[owner],customers:[{id:'one',tenantId:1,assignedTo:'boss',businessName:'Synthetic Test',email:'test@example.invalid',phone:'+13055550123',status:'Lead'}],tasks:[],activities:[],orders:[],appointments:[{id:'a1',tenantId:1,customerId:'one',status:'Scheduled',startAt:'2026-11-20T16:00:00Z',endAt:'2026-11-20T16:10:00Z',location:'https://zoom.us/j/123456789',createdAt:'2026-11-19T10:00:00Z'}]};
 const service=createService({db,id:p=>p+'_test',now:()=>stamp,writerReady:()=>true,save:async()=>{if(failSave)throw Error('storage failed');return {persisted:true}}});
 const sender=async()=>{sent++;if(failSend)throw Error('synthetic uncertain timeout');return {messageId:'synthetic-mail-1',sid:'SM'+'1'.repeat(32),providerStatus:'queued',deliveryConfirmed:false}};
 const recovery=createRecovery(service,{enabled:()=>enabled,senders:{email:sender,sms:sender}});
 await recovery.recordConsent('one',owner,1,{channel:'email',granted:true,proof:'Synthetic explicit appointment opt-in',capturedAt:'2026-11-20T14:00:00Z'});
 return {db,service,recovery,get sent(){return sent},enable:()=>{enabled=true},failSave:()=>{failSave=true},failSend:()=>{failSend=true},setTime:s=>{stamp=s}};
}
test('reminders remain off by default; a consented one-hour reminder is claimed durably once across concurrent runs',async()=>{
 const f=await fixture();assert.equal((await f.recovery.run(1,owner)).processed,0);assert.equal(f.sent,0);
 f.enable();await Promise.all([f.recovery.run(1,owner),f.recovery.run(1,owner)]);assert.equal(f.sent,1);
 const p=f.recovery.preview(owner,1);assert.equal(p.receipts[0].status,'ACCEPTED');assert.equal(p.receipts[0].deliveryConfirmed,false);
 await f.recovery.run(1,owner);assert.equal(f.sent,1);
});
test('quiet hours, suppression, missing meeting links and changed destinations block dispatch',async()=>{
 for(const kind of ['quiet','suppressed','link','destination']){const f=await fixture();f.enable();
  if(kind==='quiet'){f.setTime('2026-11-20T10:00:00Z');f.db.appointments[0].startAt='2026-11-20T11:00:00Z'}
  if(kind==='suppressed')f.db.customers[0].doNotContact=true;
  if(kind==='link')f.db.appointments[0].location='https://untrusted.example.invalid/meeting';
  if(kind==='destination')f.db.customers[0].email='different@example.invalid';
  await f.recovery.run(1,owner);assert.equal(f.sent,0,kind);
 }
});
test('failed claim persistence never sends, and an ambiguous provider attempt is not retried',async()=>{
 const storage=await fixture();storage.enable();storage.failSave();await assert.rejects(storage.recovery.run(1,owner),/NOT_COMMITTED/);assert.equal(storage.sent,0);
 const uncertain=await fixture();uncertain.enable();uncertain.failSend();await uncertain.recovery.run(1,owner);await uncertain.recovery.run(1,owner);
 assert.equal(uncertain.sent,1);const audit=uncertain.recovery.preview(owner,1);assert.equal(audit.receipts[0].status,'UNKNOWN');
 assert.equal(audit.attention.requiresReconciliation,1,'uncertain provider attempts must appear in the owner attention counter');
});
test('revoked consent prevents sending and provider delivery never regresses after delivered',async()=>{
 const f=await fixture();f.enable();await f.recovery.recordConsent('one',owner,1,{channel:'email',granted:false});await f.recovery.run(1,owner);assert.equal(f.sent,0);
 await f.recovery.recordConsent('one',owner,1,{channel:'sms',granted:true,proof:'Synthetic explicit SMS appointment opt-in',capturedAt:'2026-11-20T14:00:00Z'});
 await f.recovery.run(1,owner);await f.recovery.delivery('SM'+'1'.repeat(32),'delivered');await f.recovery.delivery('SM'+'1'.repeat(32),'queued');
 const r=f.recovery.preview(owner,1).receipts[0];assert.equal(r.status,'DELIVERED');assert.equal(r.deliveryConfirmed,true);
 await assert.rejects(f.recovery.run(1,{...owner,role:'account_manager'}),/OWNER_REQUIRED/);
});

test('quiet-hours one-hour reminder is held until the next 8 AM Eastern window, then sent once',async()=>{
 const f=await fixture();f.enable();
 f.db.appointments[0].startAt='2026-11-21T13:30:00Z'; // Saturday 8:30 AM Eastern
 f.db.appointments[0].endAt='2026-11-21T13:40:00Z';
 f.setTime('2026-11-21T12:45:00Z'); // 7:45 AM Eastern (quiet hours)
 assert.equal((await f.recovery.run(1,owner)).reason,'QUIET_HOURS');
 assert.equal(f.sent,0);
 f.setTime('2026-11-21T13:00:00Z'); // First allowed minute
 const rows=f.recovery.preview(owner,1).rows;
 assert.ok(rows.some(row=>row.kind==='1h'&&row.quietHoursHeld===true), 'deferred reminder must remain visible in preview');
 await f.recovery.run(1,owner);
 assert.equal(f.sent,1,'quiet-hour reminder should be delivered to sender once after the window opens');
 await f.recovery.run(1,owner);
 assert.equal(f.sent,1,'later worker ticks must not repeat the send');
});

test('quiet-hours deferred reminder expires safely after 15 minutes and never sends after appointment',async()=>{
 const f=await fixture();f.enable();
 f.db.appointments[0].startAt='2026-11-21T13:30:00Z';
 f.db.appointments[0].endAt='2026-11-21T13:40:00Z';
 f.setTime('2026-11-21T13:20:00Z'); // 8:20 AM, missed the 8:00-8:15 catch-up window
 assert.equal(f.recovery.preview(owner,1).rows.filter(x=>x.kind==='1h').length,0);
 await f.recovery.run(1,owner);
 assert.equal(f.sent,0);
});

test('24-hour reminders due during quiet hours are deferred until 8 AM Eastern',async()=>{
 const f=await fixture();f.enable();
 f.db.appointments[0].startAt='2026-11-22T12:30:00Z'; // Sunday 7:30 AM Eastern
 f.db.appointments[0].endAt='2026-11-22T12:40:00Z';
 f.setTime('2026-11-21T13:00:00Z'); // Saturday 8 AM Eastern
 const pending=f.recovery.preview(owner,1).rows;
 assert.equal(pending.filter(x=>x.kind==='24h'&&x.quietHoursHeld).length,1);
 await f.recovery.run(1,owner);assert.equal(f.sent,1);
});

test('the next allowed quiet-hours window uses Eastern daylight-saving offset, not fixed UTC hours',async()=>{
 const f=await fixture();f.enable();
 f.db.appointments[0].startAt='2027-03-15T02:00:00Z'; // Sunday 10 PM EDT
 f.db.appointments[0].endAt='2027-03-15T02:10:00Z';
 f.setTime('2027-03-14T12:00:00Z'); // First 8 AM EDT after 2027 spring DST jump
 const rows=f.recovery.preview(owner,1).rows;
 assert.equal(rows.filter(x=>x.kind==='24h'&&x.quietHoursHeld).length,1);
 assert.equal(rows.find(x=>x.kind==='24h').scheduledSendAt,'2027-03-14T12:00:00.000Z');
 await f.recovery.run(1,owner);assert.equal(f.sent,1);
});
