'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const P=require('../enterprise/v66155-public-asset-policy.cjs');
const H=require('./v66155-release-hygiene.cjs');
for(const p of ['public/diag2.html','browser_public/diag2.html','public/index.html.pre-commercial',
 'browser_public/index.html.pre-commercial','.env','data/crm.csv','public/private.key','backups/2025.sql']){
 assert.equal(P.excludedReleasePath(p),true,p)}
assert.equal(P.excludedReleasePath('public/v32-2-upgrade.js'),false);
for(const p of ['/diag2.html','/%64iag2.html','/index.html.pre-commercial','/.env','/orders.csv']){
 assert.equal(P.denyPublicRequest(p),true,p)}
assert.equal(P.denyPublicRequest('/v32-2-upgrade.js'),false);
assert.equal(P.denyPublicRequest('/sales-caller.html'),false);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-release-policy-'));
function put(name,body){const dest=path.join(root,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,body)}
try{
 put('VERSION','66.0.0\n');put('package.json',JSON.stringify({version:'66.0.0'}));
 put('SBC-FLAT-RELEASE-IDENTITY.json',JSON.stringify({version:'66.0.0'}));
 let files=[...H.required];for(const f of files)if(!fs.existsSync(path.join(root,f)))put(f,'test');
 const html='<script src="/app.js"></script>'.repeat(10)+'<script src="/v32-2-upgrade.js"></script><link rel="stylesheet" href="/asset.css">';
 put('public/index.html',html);put('browser_public/index.html',html);
 put('public/asset.css','safe');put('browser_public/asset.css','safe');
 files.push('public/asset.css','browser_public/asset.css');
 while(files.length<100){const p='docs/test-'+files.length+'.txt';put(p,'test');files.push(p)}
 assert.equal(H.verify(root,files,'SBC-V66-QUOTE-SAFETY-STAGING.zip').ok,true);
 put('public/app.js','different');assert.throws(()=>H.verify(root,files,'SBC-V66-QUOTE-SAFETY-STAGING.zip'),/MIRROR_DRIFT/);
 put('browser_public/app.js','different');
 put('public/app.js','sk_live_'+'A'.repeat(25));put('browser_public/app.js','sk_live_'+'A'.repeat(25));
 assert.throws(()=>H.verify(root,files,'SBC-V66-QUOTE-SAFETY-STAGING.zip'),/SENSITIVE_MATERIAL/);
 put('public/app.js','safe');put('browser_public/app.js','safe');
 assert.throws(()=>H.verify(root,[...files,'public/diag2.html'],'SBC-V66-QUOTE-SAFETY-STAGING.zip'),/FORBIDDEN_MEMBER/);
 assert.throws(()=>H.verify(root,files,'SBC-V64-QUOTE-SAFETY-STAGING.zip'),/ZIP_VERSION_DRIFT/);
 const src=fs.readFileSync(path.resolve(__dirname,'../enterprise/sbc-runtime-hardening-v56130.js'),'utf8');
 assert(src.includes('ASSET_POLICY.denyPublicRequest'),'HTTP deny gate missing');
 const active=fs.readFileSync(path.resolve(__dirname,'../public/index.html'),'utf8');
 assert(active.includes('v32-2-upgrade.js'),'legacy file is actively loaded; preserve');
 console.log('PASS release hygiene: deny diagnostics, preserve active operations, parity, versioning, exposed secrets, browser assets');
}finally{fs.rmSync(root,{recursive:true,force:true})}
