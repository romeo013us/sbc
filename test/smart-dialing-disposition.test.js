'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {dispositionTransition} = require('../lib/smart-dialing-disposition');
const now = new Date('2026-11-10T15:30:00Z');
const lead = {id:'lead-1',phone:'+13055550123',callAttempts:0};
test('no answer produces atomic patch and queue removal instruction',()=>{
 const result=dispositionTransition(lead,{outcome:'no_answer',actorId:'caller-1'},now);
 assert.equal(result.queueAction,'remove_current');
 assert.equal(result.patch.callAttempts,1);
 assert.equal(result.patch.nextCallAt,'2026-11-11T15:30:00.000Z');
 assert.equal(result.event.leadId,'lead-1');
 assert.equal(lead.callAttempts,0);
});
test('invalid number quarantines without deleting lead',()=>{
 const r=dispositionTransition(lead,{outcome:'invalid'},now);
 assert.equal(r.patch.phoneInvalid,true);
 assert.equal(r.patch.deleted,undefined);
});
test('opt-out suppresses immediately',()=>{
 assert.equal(dispositionTransition(lead,{outcome:'opt_out'},now).patch.doNotCall,true);
});
test('callback must be in the future',()=>{
 assert.throws(()=>dispositionTransition(lead,{outcome:'callback_requested',callbackAt:'2026-11-09'},now),/Future callback/);
});
test('valid callback creates a precise schedule',()=>{
 assert.equal(dispositionTransition(lead,{outcome:'callback_requested',callbackAt:'2026-11-12T16:00:00Z'},now).patch.nextCallAt,'2026-11-12T16:00:00.000Z');
});
test('unknown disposition rejected',()=>{
 assert.throws(()=>dispositionTransition(lead,{outcome:'random'},now),/Invalid/);
});
