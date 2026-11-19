'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const mod=require('../public/sbc-appointment-workflow-v1.js');
test('appointments are scoped to one customer and ordered without changing source',()=>{
 const rows=[{id:'b',customerId:'12',startAt:'2026-12-15T18:00:00Z',status:'Scheduled'},
 {id:'x',customerId:'123',startAt:'2026-12-03T18:00:00Z'},
 {id:'a',customerId:'12',startAt:'2026-12-12T18:00:00Z',status:'Scheduled'},
 {id:'c',customerId:'12',startAt:'2026-12-01T18:00:00Z',status:'Cancelled'}];
 assert.deepEqual(mod.forCustomer(rows,'12').map(x=>x.id),['a','b','c']);
 assert.equal(rows[0].id,'b');assert.deepEqual(mod.forCustomer(rows,''),[]);
});
test('schedule/edit payload validates customer, time order, and status',()=>{
 const f={customerId:'customer1',title:' Discovery call ',startAt:'2026-12-10T10:00',endAt:'2026-12-10T10:30',location:' Phone ',notes:' Website discussion '};
 const p=mod.payload(f,true,Date.parse('2026-11-19T12:00:00Z'));
 assert.equal(p.customerId,'customer1');assert.equal(p.title,'Discovery call');assert.equal(p.location,'Phone');
 assert.match(p.startAt,/Z$/);assert.equal(Date.parse(p.endAt)-Date.parse(p.startAt),1800000);
 assert.throws(()=>mod.payload({...f,customerId:''},true,0),/existing customer/);
 assert.throws(()=>mod.payload({...f,endAt:'2026-12-10T09:00'},true,0),/after the start/);
 assert.throws(()=>mod.payload({...f,startAt:'2000-01-01T10:00'},true,Date.now()),/future/);
 assert.equal(mod.payload({...f,status:'Cancelled'},false).status,'Cancelled');
 assert.throws(()=>mod.payload({...f,status:'Unknown'},false),/valid appointment status/);
});
test('existing ISO timestamps convert to datetime-local without shifting instant',()=>{
 const v='2026-12-10T15:30:00Z',local=mod.localInput(v);
 assert.match(local,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
 assert.equal(new Date(local).getTime(),Date.parse(v));
});
test('both web asset directories expose identical appointment behavior',()=>{
 const fs=require('node:fs');
 assert.equal(fs.readFileSync(require.resolve('../public/sbc-appointment-workflow-v1.js'),'utf8'),
 fs.readFileSync(require.resolve('../browser_public/sbc-appointment-workflow-v1.js'),'utf8'));
});
