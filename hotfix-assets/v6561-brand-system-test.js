'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6561-brand-system-'));
function put(rel,s){const f=path.join(dir,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
function get(rel){return fs.readFileSync(path.join(dir,rel),'utf8')}
try{
 put('package.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.60',scripts:{'test:all':'node bootstrap.js --verify'}}));
 put('package-lock.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.60',lockfileVersion:3,packages:{'':{name:'sbc-business-command-center',version:'65.1.60',scripts:{}}}}));
 put('public/index.html','<html><head><title>SBC V65.1.60</title></head><body>V65.1.60</body></html>');
 put('browser_public/index.html','<html><head></head><body>V65.1.60</body></html>');
 put('public/sw.js',"const CACHE='sbc-static-v65-1-60-live-call-notes';const keys=await caches.keys();keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE);");
 put('browser_public/sw.js',"const CACHE='sbc-static-v65-1-60-live-call-notes';");
 put('config/release-identity.js',"const RELEASE_VERSION = '65.1.60'; const RELEASE_NAME = 'LIVE_CALL_NOTES'; const RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:60});");
 put('server.js','const MYSQL_RECOVERY_REQUIRED=true;const SBC_RUNTIME_WRITER_LEASE_REQUIRED=true;');
 put('hotfix-assets/v6561-brand-system-test.js','// placeholder');
 const patch=require('./apply-v6561-brand-system.js');const r=patch.apply(dir);
 assert.equal(r.version,'65.1.61');assert.equal(r.allLogoColorsUsed,true);assert.equal(r.recoveryAndWriterGuardsPreserved,true);
 for(const f of ['public/index.html','browser_public/index.html'])assert.match(get(f),/sbc-v6561-brand-system\.css\?v=65\.1\.61-brand-system/);
 for(const f of ['public/sbc-v6561-brand-system.css','browser_public/sbc-v6561-brand-system.css']){const s=get(f);for(const t of ['#090B10','#1769E0','#F47721','#FFF','body[data-theme="dark"]','body[data-theme="light"]','prefers-reduced-motion','focus-visible'])assert.ok(s.includes(t),'missing brand/accessibility token '+t)}
 assert.match(get('public/sw.js'),/sbc-static-v65-1-61-brand-system/);assert.match(get('browser_public/sw.js'),/sbc-static-v65-1-61-brand-system/);
 assert.equal(JSON.parse(get('package.json')).version,'65.1.61');assert.equal(JSON.parse(get('package-lock.json')).packages[''].version,'65.1.61');
 assert.match(get('config/release-identity.js'),/OBSIDIAN_COBALT_EMBER_BRAND_SYSTEM/);assert.match(get('server.js'),/MYSQL_RECOVERY_REQUIRED/);assert.match(get('server.js'),/SBC_RUNTIME_WRITER_LEASE_REQUIRED/);
 cp.execFileSync(process.execPath,['--check',path.join(dir,'hotfix-assets/apply-v6561-brand-system.js')]);
 console.log('[SBC V65.1.61 OBSIDIAN / COBALT / EMBER BRAND SYSTEM] PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
