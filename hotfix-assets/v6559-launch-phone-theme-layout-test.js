'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6559-ui-'));
function put(rel,s){const p=path.join(dir,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s)}
function get(rel){return fs.readFileSync(path.join(dir,rel),'utf8')}
try{
 put('package.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.58',scripts:{'test:all':'node bootstrap.js --verify'}}));
 put('package-lock.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.58',packages:{'':{name:'sbc-business-command-center',version:'65.1.58',scripts:{}}}}));
 put('VERSION','V65.1.58');put('server.js','MYSQL_RECOVERY_REQUIRED SBC_RUNTIME_WRITER_LEASE_REQUIRED');
 put('config/release-identity.js',"const RELEASE_VERSION = '65.1.58'; const RELEASE_NAME = 'ECONOMIC_CONTROL_DDL_GATE'; const RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:58});");
 put('enterprise/release-guard.js',"const EXPECTED='65.1.18'; const ERROR='RELEASE_IDENTITY_MISMATCH';");
 const phone="sbcVoiceDevice.on('error',e=>{const message=e?.message||'Unknown phone error';const live=document.querySelector('#sbcPhoneLiveStatus');if(live)live.textContent='Phone error: '+message;toast('Phone error: '+message);});\nasync function startSbcBusinessCall(){try{await call();}catch(e){const message=String(e?.message||'Unknown phone error');const live=document.querySelector('#sbcPhoneLiveStatus');if(live)live.textContent='Call could not start: '+message;toast('Call could not start: '+message);}}";
 put('public/app.js',phone);put('browser_public/app.js',phone+"\nconst oldPin='65.1.18';");
 put('public/index.html','<html><head><title>V65.1.58</title></head><body><div class="content"><section class="card"><h2>LAUNCH &amp; CUSTOMER ACQUISITION OS</h2><div>First-Run Setup</div></section><section class="card"><h2>Sales</h2></section></div></body></html>');
 put('browser_public/index.html','<html><head></head><body>V65.1.58</body></html>');
 put('public/sw.js',"const CACHE='sbc-static-v65-1-58';const keys=await caches.keys();keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE);");
 put('browser_public/sw.js',"const CACHE='sbc-static-v65-1-58';const keys=await caches.keys();keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE);");
 put('hotfix-assets/v6559-launch-phone-theme-layout-test.js','// source test fixture');
 put('hotfix-assets/v6559-burnt-orange-layout.css',fs.readFileSync(path.resolve(__dirname,'v6559-burnt-orange-layout.css'),'utf8'));
 put('hotfix-assets/v6559-ui.js',fs.readFileSync(path.resolve(__dirname,'v6559-ui.js'),'utf8'));
 const patch=require('./apply-v6559-launch-phone-theme-layout.js');const result=patch.apply(dir);
 assert.equal(result.version,'65.1.59');assert.ok(result.releaseGuardPinsUpdated.replaced>=1);
 assert.equal(JSON.parse(get('package.json')).version,'65.1.59');
 assert.match(get('enterprise/release-guard.js'),/65\.1\.59/);assert.doesNotMatch(get('enterprise/release-guard.js'),/65\.1\.18/);
 assert.match(get('public/index.html'),/sbc-v6559-ui\.js\?v=65\.1\.59/);assert.match(get('public/index.html'),/sbc-v6559-burnt-orange-layout\.css/);
 assert.match(get('public/sbc-v6559-ui.js'),/launch & customer acquisition os/);assert.match(get('public/sbc-v6559-ui.js'),/sbc-office-box-section-order-v6559/);
 assert.match(get('public/sbc-v6559-burnt-orange-layout.css'),/#B84E17/);assert.match(get('public/sbc-v6559-burnt-orange-layout.css'),/body\[data-theme="light"\]/);
 assert.match(get('public/app.js'),/Twilio code /);assert.match(get('public/app.js'),/SBC_V6559_PHONE_DIAGNOSTICS/);
 assert.match(get('public/sw.js'),/sbc-static-v65-1-59-launch-phone-theme-layout/);
 assert.match(get('config/release-identity.js'),/65\.1\.59/);assert.match(get('server.js'),/SBC_RUNTIME_WRITER_LEASE_REQUIRED/);
 console.log('[SBC V65.1.59] release identity, launch-panel removal, theme, reorder, phone diagnostics PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
