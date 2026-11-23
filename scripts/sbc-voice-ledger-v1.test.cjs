'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const ledger=require('../enterprise/sbc-voice-ledger-v1.cjs');
const calls=[
 {id:'c1',tenantId:1,userId:'owner',userName:'Owner',customerId:'biz1',to:'+13055550100',status:'completed',outcome:'Pending',notes:'spoke to owner',durationSec:29,endedAt:'2026-11-23T14:44:04Z'},
 {id:'c2',tenantId:1,userId:'owner',customerId:'',manualDial:true,to:'+17865550123',status:'failed',outcome:'Pending',notes:'line failed',endedAt:'2026-11-23T15:00:00Z'},
 {id:'c3',tenantId:1,userId:'rep',customerId:'biz1',to:'+13055550100',status:'completed',outcome:'Spanish callback needed',notes:'Spanish requested',endedAt:'2026-11-24T15:00:00Z'},
 {id:'secret',tenantId:2,userId:'owner',customerId:'biz-secret',to:'+13059991111',notes:'private',status:'completed',endedAt:'2026-11-23T15:01:00Z'}
];
const customers=[{id:'biz1',tenantId:1,businessName:'Example Shop'},{id:'biz-secret',tenantId:2,businessName:'Hidden'}];
test('saved call history includes manual and failed calls but excludes foreign tenant',()=>{
 const r=ledger.list(calls,customers,{tenantId:1,actorId:'owner',isOwner:true});
 assert.equal(r.total,3);assert.equal(r.rows.some(x=>x.number==='+17865550123'&&x.manualDial),true);
 assert.equal(JSON.stringify(r).includes('secret'),false);
});
test('individual staff see their own calls only',()=>{
 const r=ledger.list(calls,customers,{tenantId:1,actorId:'rep'});
 assert.equal(r.total,1);assert.equal(r.rows[0].id,'c3');
});
test('number, date and outcome queries are exact scoped searches',()=>{
 assert.deepEqual(ledger.list(calls,customers,{tenantId:1,actorId:'owner',isOwner:true,number:'3055550100'}).rows.map(x=>x.id),['c3','c1']);
 assert.deepEqual(ledger.list(calls,customers,{tenantId:1,actorId:'owner',isOwner:true,outcome:'Spanish callback needed'}).rows.map(x=>x.id),['c3']);
 assert.deepEqual(ledger.list(calls,customers,{tenantId:1,actorId:'owner',isOwner:true,from:'2026-11-24'}).rows.map(x=>x.id),['c3']);
});
test('pagination shows history in ordered pages without duplicating rows',()=>{
 const a=ledger.list(calls,customers,{tenantId:1,actorId:'owner',isOwner:true,limit:1});
 const b=ledger.list(calls,customers,{tenantId:1,actorId:'owner',isOwner:true,limit:1,offset:1});
 assert.equal(a.total,3);assert.equal(a.rows.length,1);assert.notEqual(a.rows[0].id,b.rows[0].id);assert.equal(a.nextOffset,1);
});
test('no cross-tenant customer name leakage',()=>{
 const r=ledger.list([{id:'odd',tenantId:1,customerId:'biz-secret',to:'+13057770000',status:'failed'}],customers,{tenantId:1,actorId:'owner',isOwner:true});
 assert.equal(r.rows[0].businessName,'');
});
