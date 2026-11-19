'use strict';
// Super SBC inbound attribution contract: synthetic only; no customer submission,
// no mail, no CRM writes, no external HTTP requests.
const test=require('node:test');
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const site=fs.readFileSync(path.join(root,'index.php'),'utf8');
function phpAttribution(query){
  const php=[
    "$_SERVER['REQUEST_METHOD']='GET'; $_GET=[]; ob_start(); require 'index.php'; ob_end_clean();",
    "echo json_encode(sbcSuperSbcAttribution("+JSON.stringify(query).replace(/\\u/g,'\\u')+"));"
  ].join('\n');
  return JSON.parse(cp.execFileSync('php',['-r',php],{
    cwd:root,encoding:'utf8',timeout:12000,env:{...process.env,SBC_WEBSITE_BRIDGE_KEY:''}
  }));
}
test('organic Facebook, LinkedIn and Google campaign tags survive as PII-free source labels',()=>{
  for(const [source,medium] of [['facebook','organic_social'],['linkedin','organic_social'],['google','organic_gbp']]){
    const x=phpAttribution({utm_source:source,utm_medium:medium,utm_campaign:'super_sbc_growth',utm_content:'morning'});
    assert.deepEqual(x,{source,medium,campaign:'super_sbc_growth',content:'morning'});
  }
});
test('untrusted, paid or forged campaigns do not enter CRM attribution',()=>{
  for(const query of [
    {utm_source:'facebook',utm_medium:'paid_social',utm_campaign:'super_sbc_growth'},
    {utm_source:'facebook',utm_medium:'organic_social',utm_campaign:'other_campaign'},
    {utm_source:'evil.example',utm_medium:'organic_social',utm_campaign:'super_sbc_growth'},
    {utm_source:['facebook'],utm_medium:'organic_social',utm_campaign:'super_sbc_growth'},
    {utm_source:'facebook',utm_medium:'organic_social',utm_campaign:['super_sbc_growth']},
    {}
  ])assert.deepEqual(phpAttribution(query),{});
});
test('attribution content rejects personal details, URLs, control characters and excessive length',()=>{
  for(const value of ['person@example.com','https://evil.example','a'.repeat(80),'bad\nheader','<script>alert(1)</script>']){
    const x=phpAttribution({utm_source:'facebook',utm_medium:'organic_social',utm_campaign:'super_sbc_growth',utm_content:value});
    assert.equal(x.content,'general');
    assert.equal(JSON.stringify(x).includes(value),false);
  }
});
test('both existing website inquiries attach validated campaign tags to signed CRM lead requests',()=>{
  const occurrences=site.split("'marketingAttribution'=>sbcSuperSbcAttribution($_GET)").length-1;
  assert.equal(occurrences,2,'business card and sign inquiries must both preserve the same validated attribution');
  assert.match(site,/sbcCrmLeadAccepted\(\$code,\s*\$json,\s*\$err\)/,'existing CRM receipt acceptance must remain in use');
});
test('public website uses the current customer-facing SBC email, not the legacy address',()=>{
  assert.equal(site.includes('j@sbcmia.com'),false);
  assert.match(site,/info@sbcmia\.com/);
});
