'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {localCallingWindow,canPresentForDialing,buildCallerQueue} = require('../lib/smart-dialing-workspace');
const now = new Date('2026-11-10T15:30:00Z');
const lead = {phone:'+13055550123',phoneVerified:true,dncChecked:true,callingAuthorized:true,prospectTimeZone:'America/New_York',qualityScore:80};
test('fail closed on missing authorization and timezone',()=>{
 assert.equal(canPresentForDialing({...lead,dncChecked:false},now),false);
 assert.equal(canPresentForDialing({...lead,prospectTimeZone:null},now),false);
});
test('reject outside local calling window',()=>{
 assert.equal(localCallingWindow(new Date('2026-11-10T02:00:00Z'),'America/New_York'),false);
});
test('only eligible leads appear',()=>{
 assert.equal(buildCallerQueue([lead,{...lead,optedOut:true}],now).length,1);
});
