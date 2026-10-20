'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6565-layout-'));
function put(rel,s){const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
function get(rel){return fs.readFileSync(path.join(root,rel),'utf8')}
try{
 put('package.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.63',scripts:{'test:all':'node bootstrap.js --verify'}}));
 put('package-lock.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.63',lockfileVersion:3,packages:{'':{name:'sbc-business-command-center',version:'65.1.63',scripts:{}}}}));
 put('server.js','const MYSQL_RECOVERY_REQUIRED=true;const SBC_RUNTIME_WRITER_LEASE_REQUIRED=true;');
 put('public/index.html','<html><head><title>SBC V65.1.63</title></head><body><div id="content"><div id="sbcProductionControlDashboard"></div></div></body></html>');
 put('browser_public/index.html','<html><head></head><body>V65.1.63</body></html>');
 put('public/sw.js',"const CACHE='sbc-static-v65-1-63';");
 put('browser_public/sw.js',"const CACHE='sbc-static-v65-1-63';");
 put('public/sbc-v6559-ui.js',"function initReorder(){ var roots=[]; }\nfunction run(){removeAcquisition();initReorder()}\nif(document.body)new MutationObserver(function(){run()}).observe(document.body,{childList:true,subtree:true});\n");
 put('browser_public/sbc-v6559-ui.js',"function initReorder(){ var roots=[]; }\nfunction run(){removeAcquisition();initReorder()}\nif(document.body)new MutationObserver(function(){run()}).observe(document.body,{childList:true,subtree:true});\n");
 put('public/sbc-v6562-executive-dashboard.css','#content:has(> #sbcProductionControlDashboard)>:nth-child(6){grid-column:span 7}#content:has(> #sbcProductionControlDashboard)>:nth-child(7){grid-column:span 5}#content:has(> #sbcProductionControlDashboard)>:nth-child(8){grid-column:1/-1;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:18px!important}');
 put('browser_public/sbc-v6562-executive-dashboard.css','#content:has(> #sbcProductionControlDashboard)>:nth-child(6){grid-column:span 7}#content:has(> #sbcProductionControlDashboard)>:nth-child(7){grid-column:span 5}');
 put('hotfix-assets/v6565-dashboard-stability.css','#sbcSalesOperatingModelV6563{display:block!important;grid-column:1/-1!important;width:100%!important;min-width:0!important;max-width:1600px!important;flex:0 0 100%!important;box-sizing:border-box!important}#sbcSalesOperatingModelV6563 .sbc63-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important}@media(max-width:1050px){#sbcSalesOperatingModelV6563 .sbc63-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:600px){#sbcSalesOperatingModelV6563 .sbc63-grid{grid-template-columns:minmax(0,1fr)!important}}');
 put('config/release-identity.js',"const RELEASE_VERSION = '65.1.63'; const RELEASE_NAME = 'SALES_OPERATING_MODEL'; const RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:63});");
 put('VERSION','65.1.63');
 put('browser_public/app.js','// V65.1.63');
 put('enterprise/v567-nine-nine.js',"const ACTIVE_PACKAGE_RELEASE='65.1.63'; const COMPATIBLE_PACKAGE_RELEASES=Object.freeze(new Set(['65.1.63']));");
 const r=require('./apply-v6565-dashboard-stability.js').apply(root);
 assert.equal(r.version,'65.1.64');assert.equal(r.globalDashboardReorderingDisabled,true);assert.equal(r.brittleNthChildRulesRemoved,true);assert.equal(r.recoveryAndWriterGuardsPreserved,true);
 assert.doesNotMatch(get('public/sbc-v6559-ui.js'),/var roots=\[\]/);assert.doesNotMatch(get('public/sbc-v6559-ui.js'),/new MutationObserver/);assert.match(get('public/sbc-v6559-ui.js'),/SBC_V6565_DASHBOARD_LAYOUT_STABILITY/);
 assert.doesNotMatch(get('public/sbc-v6562-executive-dashboard.css'),/>:nth-child\(6\)\{grid-column:span 7\}/);assert.doesNotMatch(get('public/sbc-v6562-executive-dashboard.css'),/>:nth-child\(8\)\{grid-column:1\/-1/);
 assert.match(get('public/index.html'),/sbc-v6565-dashboard-stability\.css\?v=65\.1\.64/);assert.match(get('public/sw.js'),/sbc-static-v65-1-64-dashboard-stability/);
 assert.equal(JSON.parse(get('package.json')).version,'65.1.64');assert.equal(JSON.parse(get('package-lock.json')).packages[''].version,'65.1.64');assert.match(get('config/release-identity.js'),/DASHBOARD_LAYOUT_STABILITY/);assert.equal(get('VERSION').trim(),'65.1.64');assert.match(get('server.js'),/MYSQL_RECOVERY_REQUIRED/);assert.match(get('server.js'),/SBC_RUNTIME_WRITER_LEASE_REQUIRED/);
 cp.execFileSync(process.execPath,['--check',path.join(__dirname,'apply-v6565-dashboard-stability.js')]);console.log('[SBC V65.1.64 DASHBOARD LAYOUT STABILITY] PASS');
}finally{fs.rmSync(root,{recursive:true,force:true})}
