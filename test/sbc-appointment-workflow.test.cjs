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

test('account-manager appointments are writable only when their session is active and recovery is off',()=>{
 assert.equal(mod.canWriteAppointment({role:'account_manager',active:true},{}),true);
 assert.equal(mod.canWriteAppointment({role:'account_manager',active:false},{}),false);
 assert.equal(mod.canWriteAppointment({role:'owner',active:true},{readOnly:true}),false);
 assert.equal(mod.canWriteAppointment({role:'owner',active:true},{recoveryRequired:true}),false);
 assert.equal(mod.canWriteAppointment({role:'lead_researcher',active:true},{}),false);
});

test('call-screen appointment panel uses explicit readable foreground and background, not inherited white text',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../public/sbc-appointment-workflow-v1.js'),'utf8');
 assert.match(source,/\.sbc-appt-call\{[^}]*background:#f8fafc;[^}]*color:#172033/);
 assert.match(source,/\.sbc-appt-call \.mini\{[^}]*color:#475569/);
 assert.match(source,/\.sbc-appt-call select\{[^}]*background:#fff;[^}]*color:#172033/);
});

test('call-screen appointment card stays dark and readable even when legacy theme styles override generic panels',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../public/sbc-appointment-workflow-v1.js'),'utf8');
 assert.match(source,/#sbcCallAppointments\{[^}]*background:#162c46!important;[^}]*color:#f6fbff!important/);
 assert.match(source,/#sbcCallAppointments :is\(h3,h4,p,label,strong,\.mini\)\{[^}]*color:#f6fbff!important/);
 assert.match(source,/#sbcCallAppointments select\{[^}]*background:#0b1d32!important;[^}]*color:#fff!important/);
});
