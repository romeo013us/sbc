'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const patch=require('./apply-v6553-command-center-redesign'),root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6553-redesign-'));
function put(r,v){const f=path.join(root,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v)}function get(r){return fs.readFileSync(path.join(root,r),'utf8')}
try{
 put('public/index.html','<html><head><title>SBC Business Command Center — V65.1.49</title></head><body><div class="topbar"><button id="theme">Dark</button></div></body></html>');
 put('public/sw.js',"const CACHE='sbc-static-v65-1-49-kim-launcher-removed';const keys=await caches.keys();keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE);");
 put('package.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.49',scripts:{'test:all':'node bootstrap.js --verify'}},null,2));
 put('package-lock.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.49',lockfileVersion:3,packages:{'':{name:'sbc-business-command-center',version:'65.1.49',scripts:{}}}},null,2));
 put('config/release-identity.js',"const RELEASE_VERSION = '65.1.49'; const RELEASE_NAME = 'REMOVE_FLOATING_ASK_KIM'; const RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:49});");
 put('browser_public/app.js',"const EXPECTED_RELEASE_VERSION = '65.1.49';");put('VERSION','65.1.49');
 put('server.js',"const guards='MYSQL_RECOVERY_REQUIRED SBC_RUNTIME_WRITER_LEASE_REQUIRED';");
 const r=patch.apply(root);assert.equal(r.version,'65.1.53');assert.equal(r.headerRecoveryToggleRemoved,true);assert.equal(r.workflowLogicUnchanged,true);
 const html=get('public/index.html');assert.match(html,/sbc-command-center-redesign-v6553\.css/);assert.match(html,/sbc-v6553-header-recovery-control-guard/);assert.match(html,/V65\.1\.53/);
 const css=get('public/sbc-command-center-redesign-v6553.css');for(const t of ['#173b35','#e87961','.sidebar','.topbar','.card','@media(max-width:760px)','body[data-theme="dark"]'])assert.ok(css.includes(t),'missing design token '+t);assert.doesNotMatch(css,/#sbc-lead-workspace-launcher\{position:static/);assert.match(css,/#sbcKimBottomButton,.sbc-commercial-trigger/);assert.doesNotMatch(get('hotfix-assets/apply-v6553-command-center-redesign.js'),/sbc53-nav-workspace/);
 assert.match(get('public/sw.js'),/sbc-static-v65-1-53-command-center-redesign/);assert.equal(JSON.parse(get('package.json')).version,'65.1.53');assert.equal(JSON.parse(get('package-lock.json')).packages[''].version,'65.1.53');assert.match(get('config/release-identity.js'),/COMMAND_CENTER_REDESIGN/);assert.match(get('browser_public/app.js'),/65\.1\.53/);assert.match(get('server.js'),/MYSQL_RECOVERY_REQUIRED/);assert.match(get('server.js'),/SBC_RUNTIME_WRITER_LEASE_REQUIRED/);
 console.log('[SBC V65.1.53] Command Center redesign regression PASS');
}finally{fs.rmSync(root,{recursive:true,force:true})}
