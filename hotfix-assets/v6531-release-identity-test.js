'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const patch=require('./apply-v6531-release-identity'),root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6531-test-'));
try{
 fs.mkdirSync(path.join(root,'public'),{recursive:true});fs.mkdirSync(path.join(root,'config'),{recursive:true});
 fs.writeFileSync(path.join(root,'public','index.html'),'<!doctype html><html><head><meta name="description" content="Old description"><title>SBC Business Command Center — V65.1.26</title></head></html>');
 fs.writeFileSync(path.join(root,'public','sw.js'),"const CACHE='sbc-static-v56-25-1'; self.addEventListener('activate',e=>e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>/^sbc-static-v(?:55|56)-/.test(k)&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();})()));");
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'sbc-business-command-center',version:'65.1.30',description:'old'}));
 fs.writeFileSync(path.join(root,'package-lock.json'),JSON.stringify({version:'65.1.30',packages:{'':{version:'65.1.30'}}}));
 fs.writeFileSync(path.join(root,'config','release-identity.js'),"const RELEASE_VERSION = '65.1.30'; const RELEASE_NAME = 'WRITER_LEASE_MARKER_FIX'; const RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:30}); module.exports = { RELEASE_VERSION, RELEASE_NAME, RELEASE };");
 const r=patch.apply(root);assert.equal(r.version,'65.1.31');
 assert.ok(fs.readFileSync(path.join(root,'public','index.html'),'utf8').includes('<title>SBC Business Command Center — V65.1.31</title>'));
 assert.ok(fs.readFileSync(path.join(root,'public','sw.js'),'utf8').includes("const CACHE='sbc-static-v65-1-31';"));
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,'65.1.31');
 assert.ok(fs.readFileSync(path.join(root,'config','release-identity.js'),'utf8').includes('patch:31'));
 console.log('[SBC V65.1.31] title, cache and release identity PASS');
}finally{fs.rmSync(root,{recursive:true,force:true});}
