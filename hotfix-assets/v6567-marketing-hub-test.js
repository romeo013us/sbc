'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6567-marketing-'));
function put(rel,s){const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
function get(rel){return fs.readFileSync(path.join(root,rel),'utf8')}
try{
 put('package.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.65',scripts:{'test:all':'node bootstrap.js --verify'}}));
 put('package-lock.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.65',lockfileVersion:3,packages:{'':{name:'sbc-business-command-center',version:'65.1.65',scripts:{}}}}));
 put('server.js','const MYSQL_RECOVERY_REQUIRED=true;const SBC_RUNTIME_WRITER_LEASE_REQUIRED=true;');
 put('public/index.html','<html><head><title>SBC</title></head><body><aside class="sidebar"><nav></nav></aside><main></main></body></html>');
 put('browser_public/index.html','<html><head></head><body>Browser shell</body></html>');
 put('public/sw.js',"const CACHE='sbc-static-v65-1-65';");
 put('browser_public/sw.js',"const CACHE='sbc-static-v65-1-65';");
 put('config/release-identity.js',"const RELEASE_VERSION = '65.1.64'; const RELEASE_NAME = 'DASHBOARD_LAYOUT_STABILITY'; const RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:64});");
 put('VERSION','65.1.65');
 put('enterprise/v567-nine-nine.js',"const ACTIVE_PACKAGE_RELEASE='65.1.65'; const COMPATIBLE_PACKAGE_RELEASES=Object.freeze(new Set(['65.1.65']));");
 const r=require('./apply-v6567-marketing-hub.js').apply(root);
 assert.equal(r.version,'65.1.66');assert.equal(r.contentStudio,true);assert.equal(r.approvalQueue,true);assert.equal(r.livePublishingEnabled,false);assert.equal(r.recoveryAndWriterGuardsPreserved,true);
 for(const rel of ['public/index.html','browser_public/index.html']){assert.match(get(rel),/sbc-v6567-marketing-hub\.css\?v=65\.1\.66/);assert.match(get(rel),/sbc-v6567-marketing-hub\.js\?v=65\.1\.66/);assert.match(get(rel),/SBC_V6567_MARKETING_HUB/)}
 assert.match(get('public/sbc-v6567-marketing-hub.js'),/Content Studio/);assert.match(get('public/sbc-v6567-marketing-hub.js'),/api\/ai\/chat/);assert.match(get('public/sbc-v6567-marketing-hub.js'),/Draft with Kim/);assert.match(get('public/sbc-v6567-marketing-hub.js'),/Approval Queue/);assert.match(get('public/sbc-v6567-marketing-hub.js'),/publishing remains disabled/i);assert.match(get('public/sw.js'),/sbc-static-v65-1-66-marketing-hub/);assert.equal(JSON.parse(get('package.json')).version,'65.1.66');assert.equal(JSON.parse(get('package-lock.json')).packages[''].version,'65.1.66');assert.match(get('config/release-identity.js'),/RELEASE_VERSION = '65\.1\.66'/);assert.match(get('enterprise/v567-nine-nine.js'),/ACTIVE_PACKAGE_RELEASE='65\.1\.66'/);assert.match(get('enterprise/v567-nine-nine.js'),/COMPATIBLE_PACKAGE_RELEASES=Object\.freeze\(new Set\(\['65\.1\.66'/);
 cp.execFileSync(process.execPath,['--check',path.join(__dirname,'apply-v6567-marketing-hub.js')]);cp.execFileSync(process.execPath,['--check',path.join(__dirname,'v6567-marketing-hub.js')]);
 console.log('[SBC V65.1.66 MARKETING HUB] patch, asset injection, release identity, and publishing guard tests PASS');
}finally{fs.rmSync(root,{recursive:true,force:true})}
