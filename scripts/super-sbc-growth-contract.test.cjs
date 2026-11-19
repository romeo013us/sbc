'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const S=require('../enterprise/sbc-super-growth-contract.cjs');

test('creates tagged, HTTPS, account-safe organic URLs for the correct SBC destination',()=>{
  const fb=S.campaignUrl({channel:'facebook',destination:'websites',content:'morning'});
  const u=new URL(fb);
  assert.equal(u.hostname,'sbcmia.com');
  assert.equal(u.searchParams.get('utm_source'),'facebook');
  assert.equal(u.searchParams.get('utm_medium'),'organic_social');
  assert.equal(u.searchParams.get('utm_campaign'),'super_sbc_growth');
  assert.equal(u.searchParams.get('utm_content'),'morning');
  const hosting=new URL(S.campaignUrl({channel:'linkedin',destination:'hosting',content:'dns-tip'}));
  assert.equal(hosting.hostname,'sbcwebsites.com');
  assert.equal(hosting.searchParams.get('utm_source'),'linkedin');
});

test('rejects external destinations, unsupported channels and unsafe tracking labels',()=>{
  assert.throws(()=>S.campaignUrl({channel:'instagram',destination:'websites'}),/unsupported channel/i);
  assert.throws(()=>S.campaignUrl({channel:'facebook',destination:'https:\/\/evil.example'}),/unsupported destination/i);
  assert.throws(()=>S.campaignUrl({channel:'facebook',destination:'websites',content:'name@example.com'}),/invalid content/i);
});

test('verifies exact connected account identity and refuses old Facebook and client listings',()=>{
  assert.equal(S.verifyAccount({channel:'facebook',accountId:'1473280249199334',name:'Successful By Choice'}).ok,true);
  assert.equal(S.verifyAccount({channel:'facebook',accountId:'156807434186301',name:'Successful By Choice'}).ok,false);
  assert.equal(S.verifyAccount({channel:'linkedin',accountId:'146995513',name:'Successful By Choice LLC'}).ok,true);
  assert.equal(S.verifyAccount({channel:'google',accountId:'locations/13855744202836197259',name:'Successful By Choice'}).ok,false);
});

test('preserves zero as real data and missing downstream revenue as unknown',()=>{
  const s=S.measuredSnapshot({ga4:{active_users:25,sessions:41,conversions:0},search:{impressions:15,clicks:0},crm:{},payments:{}});
  assert.equal(s.website.sessions,41);
  assert.equal(s.website.ga4KeyEvents,0);
  assert.equal(s.search.clicks,0);
  assert.equal(s.crm.leads,null);
  assert.equal(s.payments.capturedOrders,null);
  assert.equal(s.payments.revenue,null);
  assert.equal(s.payments.netContribution,null);
});

test('refuses negative and nonnumeric external metrics rather than inventing numbers',()=>{
  const s=S.measuredSnapshot({ga4:{sessions:-3,active_users:'N/A',conversions:undefined},search:{impressions:'7'}});
  assert.equal(s.website.sessions,null);
  assert.equal(s.website.activeUsers,null);
  assert.equal(s.website.ga4KeyEvents,null);
  assert.equal(s.search.impressions,7);
});
