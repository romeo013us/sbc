'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6562-executive-deck-'));
function put(rel,s){const f=path.join(dir,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
function get(rel){return fs.readFileSync(path.join(dir,rel),'utf8')}
try{
 put('package.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.61',scripts:{'test:all':'node bootstrap.js --verify'}}));
 put('package-lock.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.61',lockfileVersion:3,packages:{'':{name:'sbc-business-command-center',version:'65.1.61',scripts:{}}}}));
 put('public/index.html','<html><head><title>SBC V65.1.61</title></head><body><div id="content"><div class="hero"></div><div id="sbcProductionControlDashboard"></div></div></body></html>');
 put('browser_public/index.html','<html><head></head><body>V65.1.61</body></html>');
 put('public/sw.js',"const CACHE='sbc-static-v65-1-61-brand-system';");put('browser_public/sw.js',"const CACHE='sbc-static-v65-1-61-brand-system';");
 put('config/release-identity.js',"const RELEASE_VERSION = '65.1.61'; const RELEASE_NAME = 'OBSIDIAN_COBALT_EMBER_BRAND_SYSTEM'; const RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:61});");
 put('VERSION','65.1.61');put('server.js','const MYSQL_RECOVERY_REQUIRED=true;const SBC_RUNTIME_WRITER_LEASE_REQUIRED=true;');put('hotfix-assets/v6562-executive-dashboard-test.js','// placeholder');
 const patch=require('./apply-v6562-executive-dashboard.js'),r=patch.apply(dir);assert.equal(r.version,'65.1.62');assert.equal(r.executiveLayout,true);assert.equal(r.recoveryAndWriterGuardsPreserved,true);
 for(const f of ['public/index.html','browser_public/index.html'])assert.match(get(f),/sbc-v6562-executive-dashboard\.css\?v=65\.1\.62-executive-deck/);
 for(const f of ['public/sbc-v6562-executive-dashboard.css','browser_public/sbc-v6562-executive-dashboard.css']){const s=get(f);for(const t of ['#content:has(> #sbcProductionControlDashboard)','grid-template-columns:repeat(5,minmax(0,1fr))','--sbc62-blue','#2677F5','#F47721','@media(max-width:760px)','prefers-reduced-motion'])assert.ok(s.includes(t),'missing executive layout/responsive token '+t)}
 assert.match(get('public/sw.js'),/sbc-static-v65-1-62-executive-deck/);assert.equal(JSON.parse(get('package.json')).version,'65.1.62');assert.equal(JSON.parse(get('package-lock.json')).packages[''].version,'65.1.62');assert.match(get('config/release-identity.js'),/EXECUTIVE_COMMAND_DECK/);assert.equal(get('VERSION').trim(),'65.1.62');assert.match(get('server.js'),/MYSQL_RECOVERY_REQUIRED/);assert.match(get('server.js'),/SBC_RUNTIME_WRITER_LEASE_REQUIRED/);
 cp.execFileSync(process.execPath,['--check',path.join(__dirname,'apply-v6562-executive-dashboard.js')]);console.log('[SBC V65.1.62 EXECUTIVE COMMAND DECK] PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
