'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-stark-test-'));
function put(p,s){const f=path.join(dir,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
function get(p){return fs.readFileSync(path.join(dir,p),'utf8')}
try{
 put('package.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.53',scripts:{'test:all':'node bootstrap.js --verify'}}));
 put('public/index.html','<html><head><title>SBC V65.1.53</title></head><body><main class="main"><div class="content"></div></main></body></html>');
 put('public/sw.js',"const CACHE='sbc-static-v65-1-53';const keys=await caches.keys();keys.filter(k=>/^sbc-static-v(?:55|56)-/.test(k)&&k!==CACHE);");
 put('config/release-identity.js',"const RELEASE_VERSION = '65.1.53'; const RELEASE_NAME = 'COMMAND_CENTER_REDESIGN'; const RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:53});");
 put('VERSION','V65.1.53');put('server.js','MYSQL_RECOVERY_REQUIRED SBC_RUNTIME_WRITER_LEASE_REQUIRED');
 const patch=require('./apply-v6554-stark-cockpit.js'),r=patch.apply(dir);
 assert.equal(r.version,'65.1.54');assert.equal(r.visualOnly,true);assert.equal(r.recoveryAndWriterGuardsPreserved,true);
 assert.match(get('public/index.html'),/sbc-stark-cockpit-v6554\.css/);assert.match(get('public/index.html'),/sbc-stark-theme-default/);
 assert.match(get('public/sbc-stark-cockpit-v6554.css'),/--stark-cyan:#00e5ff/);assert.match(get('public/sbc-stark-cockpit-v6554.css'),/max-width:none/);
 assert.match(get('public/sw.js'),/sbc-static-v65-1-54-stark-cockpit/);assert.equal(JSON.parse(get('package.json')).version,'65.1.54');
 assert.match(get('config/release-identity.js'),/STARK_CINEMATIC_COCKPIT/);assert.match(get('server.js'),/MYSQL_RECOVERY_REQUIRED/);
 console.log('[SBC V65.1.54 STARK CINEMATIC COCKPIT] PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
