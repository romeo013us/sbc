'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../enterprise/sbc-smart-dialing-projection-v1.cjs');
const now=new Date('2026-11-10T15:30:00Z');
const lead={id:'l1',businessName:'Barber',canCall:true,leadTemperature:'Warm'};
const ctx={userId:'u1',tenantId:7};
const r=(outcome,createdAt='2026-11-10T15:00:00Z',extra={})=>({customerId:'l1',callerId:'u1',tenantId:7,outcome,createdAt,...extra});
test('no answer defers lead without deletion',()=>{
 const v=P.evaluate(lead,[r('No Answer')],ctx,now);
 assert.equal(v.canCall,false);assert.equal(v.queueStatus,'cooldown');assert.equal(v.nextEligibleAt,'2026-11-11T15:00:00.000Z');
});
test('recorded do not call persists as a projection even after later report',()=>{
 const v=P.evaluate(lead,[r('Do Not Call','2026-11-08T15:00:00Z'),r('Conversation','2026-11-10T15:00:00Z')],ctx,now);
 assert.equal(v.queueStatus,'suppressed');assert.equal(v.canCall,false);
});
test('overdue callback becomes eligible, future callback deferred',()=>{
 const f=P.evaluate(lead,[r('Follow-up Requested','2026-11-09T15:00:00Z',{callbackAt:'2026-11-12T15:30:00Z'})],ctx,now);
 const d=P.evaluate(lead,[r('Follow-up Requested','2026-11-09T15:00:00Z',{callbackAt:'2026-11-10T14:30:00Z'})],ctx,now);
 assert.equal(f.queueStatus,'scheduled');assert.equal(d.queueStatus,'callback_due');
});
test('legacy reports from other caller cannot cross tenants',()=>{
 assert.equal(P.evaluate(lead,[{customerId:'l1',callerId:'other',outcome:'Do Not Call',createdAt:'2026-11-09T15:00:00Z'}],ctx,now).queueStatus,'ready');
});
test('explicit cross tenant report ignored',()=>{
 assert.equal(P.evaluate(lead,[r('Do Not Call','2026-11-09T15:00:00Z',{tenantId:8})],ctx,now).queueStatus,'ready');
});
test('bad number quarantines rather than referring to researcher automatically',()=>{
 const v=P.evaluate(lead,[r('Bad Number')],ctx,now);assert.equal(v.queueStatus,'quarantined');
});
test('attempt cap requires owner review',()=>{
 const reports=Array.from({length:5},(_,i)=>r('No Answer',new Date(now.getTime()-i*3600000).toISOString()));
 assert.equal(P.evaluate(lead,reports,ctx,now).queueReason,'MAX_ATTEMPTS_OWNER_REVIEW');
});
test('unconfirmed callback time is not treated as due',()=>{
 assert.equal(P.evaluate(lead,[r('Follow-up Requested')],ctx,now).queueStatus,'review');
});
test('ready leads rank above parked, callback due above other ready',()=>{
 const l=P.rank([{...lead,canCall:false,queueStatus:'cooldown'},{...lead,canCall:true,queueStatus:'ready'},{...lead,canCall:true,queueStatus:'callback_due'}]);
 assert.equal(l[0].queueStatus,'callback_due');assert.equal(l[2].queueStatus,'cooldown');
});
