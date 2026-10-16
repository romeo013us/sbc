'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6554-stark-'));
function put(r,s){const f=path.join(root,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
function get(r){return fs.readFileSync(path.join(root,r),'utf8')}
try{
 put('package.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.53',scripts:{'test:all':'node bootstrap.js --verify'}}));
 put('package-lock.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.53',lockfileVersion:3,packages:{'':{name:'sbc-business-command-center',version:'65.1.53',scripts:{}}}}));
 put('public/index.html','<html><head><title>SBC V65.1.53</title></head><body><main class="main"><div class="content"></div></main></body></html>');
 put('public/sw.js',"const CACHE='sbc-static-v65-1-53-command-center-redesign';const keys=await caches.keys();keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE);");
 put('config/release-identity.js',"const RELEASE_VERSION = '65.1.53'; const RELEASE_NAME = 'COMMAND_CENTER_REDESIGN'; const RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:53});");
 put('browser_public/index.html','<html><head></head><body>V65.1.53</body></html>');put('browser_public/sw.js',"const CACHE='sbc-static-v65-1-53-command-center-redesign';");
 put('browser_public/app.js','// browser version 65.1.53');put('VERSION','V65.1.53');
 put('server.js','MYSQL_RECOVERY_REQUIRED SBC_RUNTIME_WRITER_LEASE_REQUIRED');
 const r=require('./apply-v6554-stark-cockpit.js').apply(root);
 assert.equal(r.version,'65.1.54');assert.equal(r.visualOnly,true);assert.equal(r.recoveryAndWriterGuardsPreserved,true);
 assert.match(get('public/index.html'),/sbc-stark-cockpit-v6554\.css/);assert.match(get('public/index.html'),/sbc-stark-cockpit-theme-default/);
 assert.match(get('browser_public/index.html'),/sbc-stark-cockpit-v6554\.css/);
 const css=get('public/sbc-stark-cockpit-v6554.css');for(const t of ['#06101d','#00e5ff','max-width:none','prefers-reduced-motion'])assert.ok(css.includes(t),'missing style token '+t);
 assert.match(get('public/sw.js'),/sbc-static-v65-1-54-stark-cockpit/);assert.equal(JSON.parse(get('package.json')).version,'65.1.54');assert.equal(JSON.parse(get('package-lock.json')).packages[''].version,'65.1.54');
 assert.match(get('config/release-identity.js'),/STARK_CINEMATIC_COCKPIT/);assert.match(get('browser_public/app.js'),/65\.1\.54/);assert.match(get('server.js'),/MYSQL_RECOVERY_REQUIRED/);assert.match(get('server.js'),/SBC_RUNTIME_WRITER_LEASE_REQUIRED/);
 console.log('[SBC V65.1.54 STARK CINEMATIC COCKPIT] PASS');
}finally{fs.rmSync(root,{recursive:true,force:true})}
