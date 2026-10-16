'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6555-hud-'));
function put(r,s){const f=path.join(dir,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}function get(r){return fs.readFileSync(path.join(dir,r),'utf8')}
try{
 put('package.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.54',scripts:{'test:all':'node bootstrap.js --verify'}}));put('package-lock.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.54',packages:{'':{name:'sbc-business-command-center',version:'65.1.54',scripts:{}}}}));
 put('public/index.html','<html><head><title>SBC V65.1.54</title></head><body>V65.1.54</body></html>');put('browser_public/index.html','<html><head></head><body>V65.1.54</body></html>');
 const app="function leadWorkbench(){return '<button class=\\\"btn orange\\\" onclick=\\\"state.view='leadimport';render()\\\">Import Leads</button><button>Open CRM</button>'}";
 put('public/app.js',app);put('browser_public/app.js',app);put('public/sw.js',"const CACHE='sbc-static-v65-1-54-stark-cockpit';const keys=await caches.keys();keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE);");put('browser_public/sw.js',"const CACHE='sbc-static-v65-1-54-stark-cockpit';");put('config/release-identity.js',"const RELEASE_VERSION = '65.1.54'; const RELEASE_NAME = 'STARK_CINEMATIC_COCKPIT'; const RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:54});");put('VERSION','V65.1.54');put('server.js','MYSQL_RECOVERY_REQUIRED SBC_RUNTIME_WRITER_LEASE_REQUIRED');put('hotfix-assets/v6555-theme-contrast-test.js','// placeholder');
 const r=require('./apply-v6555-theme-contrast.js').apply(dir);assert.equal(r.version,'65.1.55');assert.equal(r.themeContrastFixed,true);assert.equal(r.hudGridScanlineAndPulses,true);assert.equal(r.importLeadsButtonRemoved,true);
 for(const f of ['public/app.js','browser_public/app.js']){assert.doesNotMatch(get(f),/Import Leads/);assert.match(get(f),/Open CRM/)}
 for(const f of ['public/index.html','browser_public/index.html'])assert.match(get(f),/sbc-theme-contrast-v6555\.css/);
 const css=get('public/sbc-theme-contrast-v6555.css');for(const t of ['body[data-theme="dark"]','body[data-theme="light"]','radial-gradient(circle at 1px 1px','sbcHudScan','sbcHudPulse','#sbc-lead-workspace-launcher','prefers-reduced-motion'])assert.ok(css.includes(t),'missing '+t);
 assert.match(get('public/sw.js'),/sbc-static-v65-1-55-theme-contrast-hud/);assert.equal(JSON.parse(get('package.json')).version,'65.1.55');assert.match(get('config/release-identity.js'),/THEME_CONTRAST_HUD_MOTION/);assert.match(get('server.js'),/MYSQL_RECOVERY_REQUIRED/);assert.match(get('server.js'),/SBC_RUNTIME_WRITER_LEASE_REQUIRED/);
 console.log('[SBC V65.1.55 GOD-TIER HUD + THEME CONTRAST + SHORTCUT CLEANUP] PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
