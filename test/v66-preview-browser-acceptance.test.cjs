'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {validatePreviewTarget,requestPolicy,sanitizeReport}=require('../scripts/v66-preview-browser-acceptance.cjs');

test('Preview URL needs HTTPS plus explicitly matched approved hostname and cannot target SBC public storefronts',()=>{
 assert.equal(validatePreviewTarget('https://preview.example.test/','preview.example.test').origin,'https://preview.example.test');
 for(const [url,host] of [
  ['http://preview.example.test','preview.example.test'],
  ['https://preview.example.test','different.example.test'],
  ['https://username:password@preview.example.test','preview.example.test'],
  ['https://preview.example.test?token=something','preview.example.test'],
  ['https://preview.example.test/path','preview.example.test'],
  ['https://sbcmia.com','sbcmia.com'],
  ['https://sbcwebsites.com','sbcwebsites.com'],
  ['https://localhost','localhost'],
  ['https://127.0.0.1','127.0.0.1']
 ])assert.throws(()=>validatePreviewTarget(url,host),/preview|target|host|unsafe|https/i,url);
});

test('Browser route policy permits exactly one authenticated session write and never transmits checkout, CRM, calling or customer messages',()=>{
 const origin='https://preview.example.test';
 assert.equal(requestPolicy('GET',origin+'/api/me',origin),'allow');
 assert.equal(requestPolicy('POST',origin+'/api/login',origin),'login');
 for(const [method,endpoint] of [
  ['POST','/api/communications/sms'],['POST','/api/communications/email'],
  ['POST','/api/checkout'],['POST','/api/voice/token'],
  ['POST','/api/website-production/call-desk/1/outcome'],
  ['PUT','/api/crm/leads/1'],['PATCH','/api/orders/1'],['DELETE','/api/customers/1'],
  ['POST','/api/login-other'],['POST','/api/login?redirect=bad'],
  ['POST','https://outside.example.test/api/login']
 ]){
  const url=endpoint.startsWith('http')?endpoint:origin+endpoint;
  assert.equal(requestPolicy(method,url,origin),'block',method+' '+endpoint);
 }
});

test('Report is allowlisted metrics only and never serializes credentials, URLs, customer data or network payloads',()=>{
 const payload={version:'66',status:'PASS',metrics:{domReadyMs:770,pageErrors:0},checks:[{key:'login',ok:true}],
  ownerUsername:'confidential-owner',ownerPassword:'very-secret',
  customerName:'Personal Name',url:'https://private.preview.test'};
 const clean=sanitizeReport(payload);
 assert.deepEqual(Object.keys(clean).sort(),['checks','metrics','status','version']);
 assert.equal(clean.checks[0].key,'login');
 const output=JSON.stringify(clean);
 for(const secret of ['confidential-owner','very-secret','Personal Name','private.preview.test'])assert(!output.includes(secret));
});

test('Browser acceptance selectors correspond to the owner HTML and current login controller',()=>{
 const index=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 const login=fs.readFileSync(path.join(__dirname,'../public/sbc-login-controller-v6623.js'),'utf8');
 for(const id of ['loginForm','loginUsername','loginPassword','app','sbcNavSales','sbcAdvancedNav','modal','modalBody','sbcThemeToggle','sbc-quick-checkout-nav-link'])
  assert(index.includes('id="'+id+'"'),'Expected actual browser selector: '+id);
 for(const view of ['dashboard','crm','customers'])assert(index.includes('data-view="'+view+'"'));
 assert.match(login,/fetch\('\/api\/login',\{method:'POST'/);
 assert.match(login,/stopImmediatePropagation/);
 assert.match(index,/sbc-v66-legacy-enterprise-controls\.[a-f0-9]{16}\.js/);
});

test('Browser acceptance workflow only runs on manual dispatch and never publishes or passes credentials through CLI args',()=>{
 const yml=fs.readFileSync(path.join(__dirname,'../.github/workflows/sbc-v66-preview-browser-acceptance.yml'),'utf8');
 assert.match(yml,/workflow_dispatch:/);
 assert.doesNotMatch(yml,/\n\s*push:|\n\s*pull_request:/);
 assert.match(yml,/permissions:\s*\n\s*contents:\s*read/);
 assert.match(yml,/SBC_PREVIEW_OWNER_USERNAME:\s*\$\{\{ secrets\.SBC_PREVIEW_OWNER_USERNAME \}\}/);
 assert.match(yml,/SBC_PREVIEW_OWNER_PASSWORD:\s*\$\{\{ secrets\.SBC_PREVIEW_OWNER_PASSWORD \}\}/);
 assert.match(yml,/scripts\/v66-preview-browser-acceptance\.cjs --run/);
 assert.doesNotMatch(yml,/secrets\.GODADDY|GODADDY_API_KEY|deploy|publish|upload-to-godaddy/i);
});
