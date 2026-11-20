'use strict';
// Read-only provenance contract tests. No database, networking, credentials,
// leads, customer data, or payment operations.
const test=require('node:test');
const assert=require('node:assert/strict');
const S=require('../enterprise/sbc-super-growth-contract.cjs');

test('validates only the three authorized Super SBC organic attribution channels',()=>{
  for(const [source,medium] of [['facebook','organic_social'],['linkedin','organic_social'],['google','organic_gbp']]){
    const parsed=S.inboundAttribution({source,medium,campaign:'super_sbc_growth',content:'morning'});
    assert.deepEqual(parsed,{source,medium,campaign:'super_sbc_growth',content:'morning'});
  }
});

test('refuses paid, client-supplied, unknown, and malformed campaign values',()=>{
  for(const raw of [
    undefined,null,[],{},'facebook',
    {source:'facebook',medium:'paid_social',campaign:'super_sbc_growth',content:'morning'},
    {source:'old_facebook',medium:'organic_social',campaign:'super_sbc_growth'},
    {source:'google',medium:'organic_social',campaign:'super_sbc_growth'},
    {source:'facebook',medium:'organic_social',campaign:'wrong'},
    {source:['facebook'],medium:'organic_social',campaign:'super_sbc_growth'},
    {source:'linkedin',medium:'organic_social',campaign:22},
  ])assert.equal(S.inboundAttribution(raw),null);
});

test('never echoes personal data, external URLs or injection strings in attribution content',()=>{
  for(const value of ['alice@example.com','https://evil.test/','<img src=x>',String.fromCharCode(10)+'owner','a'.repeat(100)]){
    const result=S.inboundAttribution({source:'facebook',medium:'organic_social',campaign:'super_sbc_growth',content:value,email:'client@example.com'});
    assert.equal(result.content,'general');
    assert.equal(Object.prototype.hasOwnProperty.call(result,'email'),false);
    assert.equal(JSON.stringify(result).includes(value),false);
  }
});

test('keeps the original accepted campaign on repeat inquiries and updates only safe last touch',()=>{
  const first=S.inboundAttribution({source:'facebook',medium:'organic_social',campaign:'super_sbc_growth',content:'morning'});
  const afterFirst=S.mergeInboundAttribution(null,first);
  assert.deepEqual(afterFirst,{first,last:first});
  const second=S.inboundAttribution({source:'google',medium:'organic_gbp',campaign:'super_sbc_growth',content:'business_tip'});
  const updated=S.mergeInboundAttribution(afterFirst,second);
  assert.deepEqual(updated.first,first);
  assert.deepEqual(updated.last,second);
  const rejected=S.mergeInboundAttribution(updated,{source:'facebook',medium:'paid_social',campaign:'super_sbc_growth'});
  assert.deepEqual(rejected,updated,'unsupported attribution must not overwrite CRM history');
});

test('missing campaign remains unknown rather than being invented as a direct conversion',()=>{
  assert.deepEqual(S.mergeInboundAttribution(null,{}),{first:null,last:null});
  assert.equal(S.inboundAttribution({source:'facebook',medium:'organic_social',campaign:'super_sbc_growth'}).content,'general');
});

test('Miami Next Level inbound attribution preserves Facebook launch and accepted cross-channel source without paid spoofing',()=>{
 for(const [source,medium] of [['facebook','organic_social'],['linkedin','organic_social'],['google','organic_gbp']]){
  const x=S.inboundAttribution({source,medium,campaign:'miami_next_level_2026',content:'hero'});
  assert.deepEqual(x,{source,medium,campaign:'miami_next_level_2026',content:'hero'});
 }
 assert.deepEqual(S.inboundAttribution({source:'facebook',medium:'organic',campaign:'miami_next_level_2026',content:'general'}),
  {source:'facebook',medium:'organic_social',campaign:'miami_next_level_2026',content:'general'});
 assert.equal(S.inboundAttribution({source:'facebook',medium:'paid_social',campaign:'miami_next_level_2026'}),null);
 assert.equal(S.inboundAttribution({source:'facebook',medium:'organic',campaign:'rockstar_partner'}),null);
 assert.match(S.campaignUrl({channel:'facebook',campaign:'miami_next_level_2026',content:'starter'}),/utm_campaign=miami_next_level_2026/);
 assert.throws(()=>S.campaignUrl({channel:'facebook',campaign:'gta_official'}),/Unsupported campaign/);
});
