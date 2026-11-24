'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const contract=path.resolve(__dirname,'../scripts/v6603-flat-release-contract.test.cjs');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-contract-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const put=(name,value)=>{const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof value==='string'?value:JSON.stringify(value));};
 const server="'use strict';\n",sha=crypto.createHash('sha256').update(server).digest('hex');
 put('scripts/check.cjs',fs.readFileSync(contract,'utf8'));
 put('server.js',server);
 put('package.json',{version:'66.0.0',main:'sbc-godaddy-flat-entrypoint.cjs',scripts:{start:'node sbc-godaddy-flat-entrypoint.cjs'}});
 put('.airo/config.json',{serveCommand:'npm start'});
 const id={serverSha256:sha,sourceCommit:'a'.repeat(40),sourceFingerprint:'b'.repeat(64),stagedInventorySha256:'c'.repeat(64)};
 put('SBC-FLAT-RELEASE-IDENTITY.json',id);
 put('config/release-identity.js',"module.exports={RELEASE_VERSION:'66.0.0',RELEASE:{major:66,minor:0,patch:0}};");
 put('sbc-godaddy-flat-entrypoint.cjs','// persistState( ephemeral customer state serverSha256');
 put('bootstrap.js',"require('./sbc-godaddy-flat-entrypoint.cjs')");
 const html='<span id="sbcBuildVersion">V66.0.0 · WEBSITE PRODUCTION</span> sbc-v6636-canonical-styles sbc-light-contrast-v6601.css sbc-browser-view-repair-v6601.js';
 put('public/index.html',html);put('browser_public/index.html',html);
 put('public/v56251-ui-finalize.js',"__SBC_UI_RELEASE__='66.0.0'");
 put('public/sbc-kim-ui-hardening-v6429.js','// no override');
 return {put,id,run:(...args)=>spawnSync(process.execPath,[path.join(root,'scripts/check.cjs'),...args],{encoding:'utf8'})};
}
test('changed source passes only explicitly labeled source review; default strict pin still rejects it',t=>{
 const f=fixture(t);assert.equal(f.run().status,0);
 f.put('server.js',"'use strict';\nconst changed=true;");
 const strict=f.run();assert.notEqual(strict.status,0);assert.match(strict.stderr,/server.js must match pinned launch hash/);
 const source=f.run('--source-only');assert.equal(source.status,0,source.stderr);assert.match(source.stdout,/NOT DEPLOYABLE EVIDENCE/);
 assert.notEqual(f.run('--unexpected').status,0);
});
test('source review rejects broken syntax, invalid hash, mirror drift and stale receipt',t=>{
 const f=fixture(t);f.put('server.js','const =');assert.notEqual(f.run('--source-only').status,0);
 f.put('server.js','const valid=1;');f.put('SBC-FLAT-RELEASE-IDENTITY.json',{...f.id,serverSha256:'invalid'});assert.notEqual(f.run('--source-only').status,0);
 f.put('SBC-FLAT-RELEASE-IDENTITY.json',f.id);f.put('browser_public/index.html','drift');assert.notEqual(f.run('--source-only').status,0);
 const fresh=fixture(t);fresh.put('SBC-DEPLOY-RECEIPT.json',{sourceCommit:'d'.repeat(40),sourceFingerprint:fresh.id.sourceFingerprint,artifactSha256:fresh.id.serverSha256});assert.notEqual(fresh.run('--source-only').status,0);
});
