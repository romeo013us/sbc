'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {GATEWAY_DEFINITIONS,configuration,summarizeGateways,checkRevenueAccounts,readTwilioAccount} = require('../enterprise/sbc-provider-evidence.cjs');
const inspect = (id,keys) => configuration(GATEWAY_DEFINITIONS.find(g => g.id === id),name => keys.includes(name));

test('the same registry distinguishes partial settings, complete settings and external CI', () => {
  assert.equal(inspect('godaddy',['GODADDY_API_SECRET']).status,'PARTIAL');
  assert.equal(inspect('godaddy',['GODADDY_API_KEY','GODADDY_API_SECRET']).status,'CONFIGURED');
  assert.equal(inspect('redis',['SBC_REDIS_URL']).complete,true);
  assert.equal(inspect('email',['SMTP_HOST']).status,'PARTIAL');
  assert.equal(inspect('twilio',['SBC_TWILIO_ACCOUNT_SID','SBC_TWILIO_AUTH_TOKEN','SBC_TWILIO_FROM']).status,'CONFIGURED');
  assert.equal(inspect('github',[]).status,'EXTERNAL');
  const full=GATEWAY_DEFINITIONS.map(row => configuration(row,() => true));
  assert.equal(summarizeGateways(full).ready,0);
  assert.equal(summarizeGateways(full).configured,full.length-1);
  for(const id of ['square','stripe','twilio','godaddy','google','windsor','email','github','openai']) assert(full.some(row=>row.id===id));
});
test('identity, status, and scope are required even after a successful HTTP response',async () => {
  const sid='AC'+'1'.repeat(32);
  const check = (square,twilio) => checkRevenueAccounts({locationId:'location-1',squareEnvironment:'sandbox',sid,
    squareRead:async path=>{assert.equal(path,'/v2/locations/location-1');return square;},twilioRead:async()=>twilio});
  const verified=await check({location:{id:'location-1',status:'ACTIVE'}},{sid,status:'active'});
  assert.deepEqual(verified.map(x=>x.status),['VERIFIED','VERIFIED']);
  assert.equal(verified[0].environment,'sandbox');
  for(const [square,twilio] of [[{},{}],[{id:'wrong',status:'ACTIVE'},{sid:'other',status:'active'}],[{id:'location-1',status:'INACTIVE'},{sid,status:'suspended'}]]) {
    assert.deepEqual((await check({location:square},twilio)).map(x=>x.status),['UNVERIFIED','UNVERIFIED']);
  }
});
test('provider failures are isolated and do not disclose response bodies or credentials',async () => {
  const result=await checkRevenueAccounts({sid:'test',locationId:'loc',squareRead:async()=>{throw Error('private failure details');},twilioRead:null});
  assert.deepEqual(result.map(x=>x.status),['UNAVAILABLE','UNCONFIGURED']);
  assert(!JSON.stringify(result).includes('private'));
  await assert.rejects(readTwilioAccount('test','fixture',async(url,options)=>{
    assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
    assert.equal(new URL(url).origin,'https://api.twilio.com');
    return {ok:false};
  }),/TWILIO_ACCOUNT_READ_FAILED/);
});
