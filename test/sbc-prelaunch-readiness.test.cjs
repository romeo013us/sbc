'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {audit}=require('../scripts/sbc-prelaunch-readiness.cjs');
function fixture(name='sbc-office-box'){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-prelaunch-'));
 fs.mkdirSync(path.join(dir,'public'));
 fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({name,main:'server.js'}));
 fs.writeFileSync(path.join(dir,'server.js'),'// test fixture');
 return dir;
}
function page(dir,filename='index.html',html='<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css?v=1"><script src="/app.js" defer></script></head><body><nav aria-label="Main">Navigation</nav><main>Content</main></body></html>'){
 fs.writeFileSync(path.join(dir,'public',filename),html);
 fs.writeFileSync(path.join(dir,'public','styles.css'),'body{}');
 fs.writeFileSync(path.join(dir,'public','app.js'),'');
}
test('clean minimal Office Box entry passes with local assets',()=>{
 const dir=fixture();page(dir);
 assert.deepEqual(audit(dir).errors,[]);
 fs.rmSync(dir,{recursive:true,force:true});
});
test('missing referenced local JavaScript is a release blocker',()=>{
 const dir=fixture();page(dir);fs.unlinkSync(path.join(dir,'public','app.js'));
 assert(audit(dir).errors.some(e=>e.includes('app.js')));
 fs.rmSync(dir,{recursive:true,force:true});
});
test('query strings and remote assets do not create false missing-asset reports',()=>{
 const dir=fixture();page(dir,'index.html','<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.example.test/lib.js"></script><link rel="stylesheet" href="/styles.css?v=4"><main>Hi</main></html>');
 assert.deepEqual(audit(dir).errors,[]);
 fs.rmSync(dir,{recursive:true,force:true});
});
test('invalid relative path traversal is flagged',()=>{
 const dir=fixture();page(dir,'index.html','<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="/../secrets.js"></script><main>Hi</main></html>');
 assert(audit(dir).errors.some(e=>e.includes('unsafe asset path')));
 fs.rmSync(dir,{recursive:true,force:true});
});
test('Command Center staff screens require a noindex directive',()=>{
 const dir=fixture('sbc-business-command-center');page(dir);
 for(const name of ['lead-research.html','sbc-account-manager-v1.html','hr-workstation.html'])page(dir,name);
 const result=audit(dir);
 assert(result.errors.some(e=>e.includes('noindex')));
 fs.rmSync(dir,{recursive:true,force:true});
});
