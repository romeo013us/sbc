'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {verifyReleaseSync,verifyHostHeaders}=require('../scripts/verify-release-sync.cjs');
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-release-sync-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const files={};const put=(name,data)=>{const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,data);};
 for(const name of ['server.js','package.json','public/app.js','public/index.html','browser_public/index.html','sbc-godaddy-flat-entrypoint.cjs','scripts/v6611-verify-stage-inventory.cjs','enterprise/financial-governor-v56-25-3.js','enterprise/sbc-margin-policy.cjs','public/sbc-website-production-v1.js','public/sales-caller.js','public/sbc-website-revenue-shortcuts-v1.css',...Array.from({length:100},(_,i)=>'test/fixture-'+i+'.txt')]){
  const value=name==='package.json'?JSON.stringify({main:'sbc-godaddy-flat-entrypoint.cjs',scripts:{start:'node sbc-godaddy-flat-entrypoint.cjs'}}):name;
  put(name,value);files[name]=sha(value);
 }
 const sourceCommit='a'.repeat(40),sourceFingerprint='b'.repeat(64);
 const inv=JSON.stringify({schema:1,sourceCommit,files})+'\n';
 const id={schema:1,sourceCommit,sourceFingerprint,serverSha256:files['server.js'],stagedInventorySha256:sha(inv),candidateOnly:true,productionCertified:false};
 put('SBC-STAGED-INVENTORY.json',inv);put('SBC-FLAT-RELEASE-IDENTITY.json',JSON.stringify(id));put('SBC-DEPLOY-RECEIPT.json',JSON.stringify({sourceCommit,sourceFingerprint,artifactType:'server.js',artifactSha256:id.serverSha256,buildBranch:'a-sbc-master',deployBranch:'a-sbc-master'}));
 return {root,id,put};
}
test('only sealed runtime with independently pinned source is release-sync verified',t=>{
 const f=fixture(t),p=verifyReleaseSync(f.root,f.id.sourceCommit);
 assert.equal(p.sourceCommit,f.id.sourceCommit);assert.equal(p.serverSha256,f.id.serverSha256);assert.equal(p.candidateOnly,true);assert.equal(p.productionCertified,false);
 assert.throws(()=>verifyReleaseSync(f.root,'c'.repeat(40)),/SOURCE_PIN_MISMATCH/);
 assert.throws(()=>verifyReleaseSync(f.root,''),/SOURCE_PIN_REQUIRED/);
 f.put('browser_public/index.html','new frontend without matching inventory');
 assert.throws(()=>verifyReleaseSync(f.root,f.id.sourceCommit),/checksum mismatch/);
});
test('host identity requires exact independent source, server, fingerprint and inventory pins',t=>{
 const {root,id}=fixture(t);const expected=verifyReleaseSync(root,id.sourceCommit);
 const headers=new Headers({'x-sbc-source-commit':id.sourceCommit,'x-sbc-server-sha256':id.serverSha256,'x-sbc-source-fingerprint':id.sourceFingerprint,'x-sbc-inventory-sha256':id.stagedInventorySha256,'x-sbc-release-candidate':'true','cache-control':'no-store'});
 assert.equal(verifyHostHeaders(headers,expected).productionCertified,false);
 for(const name of ['x-sbc-source-commit','x-sbc-server-sha256','x-sbc-source-fingerprint','x-sbc-inventory-sha256','x-sbc-release-candidate','cache-control']){
  const bad=new Headers(headers);bad.delete(name);assert.throws(()=>verifyHostHeaders(bad,expected),/HOST_RELEASE_MISMATCH/);
 }
 const stale=new Headers(headers);stale.set('x-sbc-source-commit','c'.repeat(40));assert.throws(()=>verifyHostHeaders(stale,expected),/HOST_RELEASE_MISMATCH/);
});
test('candidate runtime records verified bytes without claiming production certification',t=>{
 const {id}=fixture(t);const code=fs.readFileSync(path.join(__dirname,'../config/deployed-build.cjs'),'utf8');
 const ctx={module:{exports:{}},Object};vm.runInNewContext(code,ctx);
 const mod=ctx.module.exports;let headers={};const res={setHeader:(k,v)=>headers[k.toLowerCase()]=v};
 mod.healthHeaders({},res,()=>{});assert.equal(headers['x-sbc-server-sha256'],undefined);
 assert.throws(()=>mod.recordVerifiedRelease({...id,serverSha256:'wrong'}));
 mod.recordVerifiedRelease(id);mod.healthHeaders({},res,()=>{});
 assert.equal(headers['x-sbc-server-sha256'],id.serverSha256);assert.equal(headers['x-sbc-release-candidate'],'true');assert.equal(headers['x-sbc-source-commit'],id.sourceCommit);
 assert.throws(()=>mod.recordVerifiedRelease({...id,serverSha256:'f'.repeat(64)}));
});
