'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6557-safe-recovery-'));
function put(rel,s){const f=path.join(dir,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
function get(rel){return fs.readFileSync(path.join(dir,rel),'utf8')}
try{
 put('package.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.56',scripts:{'test:all':'node bootstrap.js --verify'}}));
 put('package-lock.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.56',lockfileVersion:3,packages:{'':{name:'sbc-business-command-center',version:'65.1.56',scripts:{}}}}));
 put('public/index.html','<html><head><script src="/app.js?v=65.1.56-voice-sdk-v2-local"></script></head><body>V65.1.56</body></html>');
 put('browser_public/index.html','<html><head><script src="/app.js?v=65.1.56-voice-sdk-v2-local"></script></head><body>V65.1.56</body></html>');
 put('public/app.js',"async function boot(){await load();}");
 put('browser_public/app.js',"async function boot(){await load();}");
 put('public/sw.js',"const CACHE='sbc-static-v65-1-56-local';");
 put('browser_public/sw.js',"const CACHE='sbc-static-v65-1-56-local';");
 put('server.js',"const SBC_RUNTIME_ROLE=String(process.env.SBC_RUNTIME_ROLE||'readonly'); const SBC_RUNTIME_WRITER_LEASE_REQUIRED=true; const MYSQL_RECOVERY_REQUIRED=true;");
 put('config/release-identity.js',"const RELEASE_VERSION = '65.1.56'; const RELEASE_NAME = 'TWILIO_VOICE_SDK_V2_LOCAL_BUNDLE'; const RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:56});");
 put('VERSION','V65.1.56');
 const r=require('./apply-v6557-owner-force-unlock.js').apply(dir);
 assert.equal(r.version,'65.1.57');assert.equal(r.forceUnlockRouteInjected,false);assert.equal(r.automaticUnlockInjected,false);assert.equal(r.persistentOwnerOverrideInjected,false);
 assert.equal(JSON.parse(get('package.json')).version,'65.1.57');
 assert.equal(JSON.parse(get('package-lock.json')).version,'65.1.57');
 for(const f of ['public/app.js','browser_public/app.js']){assert.doesNotMatch(get(f),/sbcV6557OwnerForceUnlockOnce|\/api\/owner\/recovery\/force-unlock/);}
 for(const f of ['public/index.html','browser_public/index.html'])assert.match(get(f),/65.1.57-recovery-control-removed/);
 assert.match(get('public/sw.js'),/sbc-static-v65-1-57-recovery-control-removed/);
 assert.match(get('server.js'),/SBC_RUNTIME_WRITER_LEASE_REQUIRED/);
 console.log('[SBC V65.1.57 RECOVERY CONTROL REMOVAL] PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
