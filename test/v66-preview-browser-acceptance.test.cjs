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

test('Preview release fingerprint rejects stale, absent or unverified commits before owner authentication',async()=>{
 const {verifyPreviewSourceIdentity}=require('../scripts/v66-preview-browser-acceptance.cjs');
 const target=validatePreviewTarget('https://preview.example.test/','preview.example.test');
 const approved='a'.repeat(40),old='b'.repeat(40);
 const fake=(status,sha,overrides={})=>async(url,opts)=>{
  assert.equal(url,'https://preview.example.test/healthz');
  assert.equal(opts.method,'GET');
  assert.equal(opts.redirect,'error');
  assert.equal(opts.credentials,'omit');
  return {status,headers:{get(name){assert.equal(name,'x-sbc-source-commit');return sha;}},...overrides};
 };
 assert.equal(await verifyPreviewSourceIdentity(target,approved,fake(200,approved)),true);
 await assert.rejects(verifyPreviewSourceIdentity(target,approved,fake(200,old)),/SBC_PREVIEW_RELEASE_MISMATCH/);
 await assert.rejects(verifyPreviewSourceIdentity(target,approved,fake(200,null)),/SBC_PREVIEW_RELEASE_MISMATCH/);
 await assert.rejects(verifyPreviewSourceIdentity(target,approved,fake(503,approved)),/SBC_PREVIEW_RELEASE_MISMATCH/);
 await assert.rejects(verifyPreviewSourceIdentity(target,'not-a-commit',fake(200,approved)),/SBC_PREVIEW_EXPECTED_SOURCE_INVALID/);
});

test('Preview workflow uses the verified master release receipt instead of its packaging commit',()=>{
 const yml=fs.readFileSync(path.join(__dirname,'../.github/workflows/sbc-v66-preview-browser-acceptance.yml'),'utf8');
 assert.doesNotMatch(yml,/SBC_PREVIEW_EXPECTED_SOURCE_SHA|github\\.sha/);
 assert.match(yml,/SBC-DEPLOY-RECEIPT\\.json/);
 assert.doesNotMatch(yml,/uses:\s*actions\/(?:checkout|setup-node|upload-artifact)@v\d+/);
 assert.match(yml,/run:\s*node scripts\/v66-preview-browser-acceptance\.cjs --run/);
});

test('Preview source identity is read from consistent a-sbc-master receipts rather than a GitHub packaging commit',()=>{
 const {readApprovedPreviewSourceCommit}=require('../scripts/v66-preview-browser-acceptance.cjs');
 const os=require('node:os');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-preview-receipt-'));
 const sha='a'.repeat(40),fingerprint='b'.repeat(64),server='c'.repeat(64);
 const receipt={sourceCommit:sha,sourceFingerprint:fingerprint,artifactType:'server.js',
  artifactSha256:server,buildBranch:'a-sbc-master',deployBranch:'a-sbc-master'};
 const identity={sourceCommit:sha,sourceFingerprint:fingerprint,serverSha256:server};
 const write=(name,v)=>fs.writeFileSync(path.join(temp,name),JSON.stringify(v));
 try{
  write('SBC-DEPLOY-RECEIPT.json',receipt);
  write('SBC-FLAT-RELEASE-IDENTITY.json',identity);
  assert.equal(readApprovedPreviewSourceCommit(temp),sha);
  write('SBC-DEPLOY-RECEIPT.json',{...receipt,deployBranch:'main'});
  assert.throws(()=>readApprovedPreviewSourceCommit(temp),/SBC_PREVIEW_RELEASE_RECEIPT/);
  write('SBC-DEPLOY-RECEIPT.json',receipt);
  write('SBC-FLAT-RELEASE-IDENTITY.json',{...identity,sourceCommit:'d'.repeat(40)});
  assert.throws(()=>readApprovedPreviewSourceCommit(temp),/SBC_PREVIEW_RELEASE_RECEIPT/);
  fs.unlinkSync(path.join(temp,'SBC-DEPLOY-RECEIPT.json'));
  assert.throws(()=>readApprovedPreviewSourceCommit(temp),/SBC_PREVIEW_RELEASE_RECEIPT/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
