'use strict';
// V66.73: the same verified GoDaddy app must boot through either the flat
// entrypoint or a previously persisted "node bootstrap.js" serve command.
// Runs entirely in a disposable compiled app; NO production DB or provider I/O.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const load=f=>fs.readFileSync(path.join(root,f),'utf8');
const pkg=JSON.parse(load('package.json'));
const flat=load('sbc-godaddy-flat-entrypoint.cjs');
const alias=load('bootstrap.js');
const release=JSON.parse(load('SBC-FLAT-RELEASE-IDENTITY.json'));
const server=fs.readFileSync(path.join(root,'server.js'));
const sha=crypto.createHash('sha256').update(server).digest('hex');
assert.equal(release.schema,1);
assert.equal(release.serverSha256,sha,'source-verified server fingerprint');
assert.match(release.sourceCommit,/^[a-f0-9]{40}$/);
assert.match(release.sourceFingerprint,/^[a-f0-9]{64}$/);
assert.equal(pkg.main,'sbc-godaddy-flat-entrypoint.cjs');
assert.equal(pkg.scripts.start,'node sbc-godaddy-flat-entrypoint.cjs');
assert(!pkg.scripts.prestart||!pkg.scripts.prestart.includes('bootstrap.js'),'prestart must never launch duplicate app');
const airo=JSON.parse(load('.airo/config.json'));
assert.match(airo.serveCommand,/npm start/);
assert.match(alias,/SBC DEPLOY STARTUP COMPAT/);
assert.match(flat,/SBC DEPLOY IDENTITY/);
new vm.Script(alias,{filename:'bootstrap.js'});
new vm.Script(flat,{filename:'sbc-godaddy-flat-entrypoint.cjs'});
let forwarded=0;
vm.runInNewContext(alias,{
 console:{log(){}},require:p=>{assert.equal(p,'./sbc-godaddy-flat-entrypoint.cjs');forwarded++;}
},{timeout:1000});
assert.equal(forwarded,1,'bootstrap compatibility path must forward exactly once');

function boot(receipt){
 const logs=[],started=[],env={PORT:'20010',SBC_RUNTIME_ROLE:'readonly'};
 const virtualFs={
  existsSync:p=>path.basename(p)==='SBC-DEPLOY-RECEIPT.json'&&receipt!==null,
  readFileSync:(p,encoding)=>{
   if(path.basename(p)==='SBC-DEPLOY-RECEIPT.json')return JSON.stringify(receipt);
   return fs.readFileSync(p,encoding);
  }
 };
 const requireMock=(p)=>{
  if(p==='node:path')return path;
  if(p==='node:os')return {hostname:()=> 'synthetic-host'};
  if(p==='node:crypto')return crypto;
  if(p==='node:fs')return virtualFs;
  if(p==='./SBC-FLAT-RELEASE-IDENTITY.json')return release;
  if(p==='./persistent-state.js')return {persistState:()=>({ephemeral:false})};
  if(p==='./runtime-env-beacon.js')return {buildBeaconLine:()=> '[SBC TEST] synthetic'};
  if(p==='./tenant-rejection-guard.js')return {installTenantRejectionGuard:()=>{}};
  if(p===path.join(root,'server.js')){started.push('server');return {};}
  throw Error('unexpected startup module '+p);
 };
 vm.runInNewContext(flat,{
  __dirname:root,require:requireMock,console:{log:s=>logs.push(String(s))},
  process:{pid:123,env}
 },{timeout:2500});
 assert.equal(started.length,1,'application server must start once');
 assert(logs.some(s=>s.includes('[SBC DEPLOY IDENTITY]')));
 assert(logs.some(s=>s.includes('[SBC FLAT STARTUP]')));
 return logs;
}
const match={sourceCommit:release.sourceCommit,sourceFingerprint:release.sourceFingerprint};
for(let pass=1;pass<=3;pass++){
 const plain=boot(null);
 assert(plain.some(s=>s.includes('receipt=ZIP_INSTALL')));
 const branch=boot(match);
 assert(branch.some(s=>s.includes('receipt=VERIFIED')));
 assert.throws(()=>boot({...match,sourceCommit:'0'.repeat(40)}),/receipt does not match running server/);
 console.log('[SBC V6673] PASS '+pass+'/3: GitHub branch, standalone archive, failed receipt, and legacy startup parity');
}
console.log('[SBC V6673] PASS GoDaddy startup compatibility, flat identity, one runtime instance, and unchanged compiled server');
