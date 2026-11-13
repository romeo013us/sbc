'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const gatePath=path.join(root,'scripts/v66-static-mirror-gate.cjs');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/sbc-v6606-staged-release.yml'),'utf8');

test('the checked-in browser mirror is byte-identical for all mirrored files',()=>{
 const {verifyStaticMirrors}=require(gatePath);
 const result=verifyStaticMirrors(root);
 assert(result.mirrored>=200,'Expected a substantial pre-existing browser mirror');
 assert.equal(result.drift.length,0,'Mirror divergence is never silent');
 assert.equal(result.unexpected.length,0,'New unmirrored files require explicit review');
});
test('the mirror gate fails when a shared asset drifts or a new exception appears',()=>{
 const {verifyStaticMirrors}=require(gatePath);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v66-static-mirror-'));
 try{
  fs.mkdirSync(path.join(dir,'public'));
  fs.mkdirSync(path.join(dir,'browser_public'));
  fs.writeFileSync(path.join(dir,'public','same.js'),'ok');
  fs.writeFileSync(path.join(dir,'browser_public','same.js'),'ok');
  assert.equal(verifyStaticMirrors(dir,{minimumShared:1}).mirrored,1);
  fs.writeFileSync(path.join(dir,'browser_public','same.js'),'changed');
  assert.throws(()=>verifyStaticMirrors(dir,{minimumShared:1}),/drift/i);
  fs.writeFileSync(path.join(dir,'browser_public','same.js'),'ok');
  fs.writeFileSync(path.join(dir,'public','unreviewed.js'),'new');
  assert.throws(()=>verifyStaticMirrors(dir,{minimumShared:1}),/unmirrored|exception/i);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('the staged ZIP helper creates identical bytes across timestamps and insertion order, then detects changes',()=>{
 const result=spawnSync('python3',[path.join(root,'test/v66_reproducible_zip_test.py')],{cwd:root,encoding:'utf8'});
 assert.equal(result.status,0,(result.stdout||'')+'\n'+(result.stderr||''));
 assert.match((result.stdout||'')+(result.stderr||''),/OK/);
});
test('release candidate uses deterministic ZIP writer and a source-mirror gate',()=>{
 assert.match(workflow,/from scripts\.v66_deterministic_zip import create_reproducible_zip/);
 assert.match(workflow,/create_reproducible_zip\(/);
 assert.match(workflow,/v66-static-mirror-gate\.cjs/);
 assert.match(workflow,/v66-release-foundation\.test\.cjs/);
 assert.doesNotMatch(workflow,/z\.write\(root\/rel,str\(rel\)\)/);
});
