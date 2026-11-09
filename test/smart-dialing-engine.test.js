'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {eligible, rankQueue, outcomePolicy, windowScore} = require('../lib/smart-dialing-engine');
const now = new Date('2026-11-10T15:30:00Z'); // Tuesday, 10:30 ET
test('never queues blocked, invalid or test leads', () => {
 for (const flag of ['doNotCall','optedOut','consentBlocked','phoneInvalid','isTest']) {
   assert.equal(eligible({phone:'+13055550123',[flag]:true},now),false);
 }
});
test('deferred leads disappear from current queue', () => {
 assert.equal(rankQueue([{phone:'+13055550123',nextCallAt:'2026-11-12T15:30:00Z'}],now).length,0);
});
test('high-quality eligible leads rank first', () => {
 const rows=rankQueue([{phone:'1',qualityScore:10},{phone:'2',qualityScore:90}],now);
 assert.equal(rows[0].lead.phone,'2');
});
test('Tuesday morning receives window preference', () => {
 assert.equal(windowScore(now),20);
});
test('invalid number quarantines without research loop', () => {
 assert.deepEqual(outcomePolicy('invalid',1,now),{action:'quarantine_number',nextCallAt:null,research:false});
});
test('fourth unanswered attempt cools down 15 days', () => {
 assert.equal(outcomePolicy('no_answer',4,now).nextCallAt,'2026-11-25T15:30:00.000Z');
});
test('opt-out always suppresses', () => {
 assert.equal(outcomePolicy('opt_out',1,now).action,'suppress');
});

test('malformed retry date fails closed', () => {
 assert.equal(eligible({phone:'+13055550123',nextCallAt:'not-a-date'},now),false);
});
test('nonfinite quality score does not dominate the queue', () => {
 const rows=rankQueue([{phone:'1',qualityScore:'Infinity'},{phone:'2',qualityScore:50}],now);
 assert.equal(rows[0].lead.phone,'2');
});
