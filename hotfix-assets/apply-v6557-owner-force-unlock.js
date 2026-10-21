'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6557_FORCE_UNLOCK_REMOVED',FROM='65.1.56',TO='65.1.57';
function read(root,rel){const f=path.join(root,rel);if(!fs.existsSync(f))throw Error(MARKER+': missing '+rel);return fs.readFileSync(f,'utf8')}
function write(root,rel,s){const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' anchor count '+n);return s.replace(a,b)}
function apply(root){
 const pkg=JSON.parse(read(root,'package.json')),lock=JSON.parse(read(root,'package-lock.json'));
 if(pkg.name!=='sbc-business-command-center'||pkg.version!==FROM||lock.version!==FROM||lock.packages?.['']?.version!==FROM)throw Error(MARKER+': expected package/lock identity '+FROM);
 // Deliberately do NOT inject a force-unlock route, persistent owner override, automatic
 // client request, DDL bypass, or kill-switch clearing behavior.
 for(const rel of ['public/index.html','browser_public/index.html']){
  if(!fs.existsSync(path.join(root,rel)))continue;
  let s=read(root,rel);
  s=s.replace(/app\.js\?v=[^"'\s>]+/g,'app.js?v=65.1.57-recovery-control-removed');
  s=s.replace(/65\.1\.56/g,'65.1.57');
  write(root,rel,s);
 }
 for(const rel of ['public/app.js','browser_public/app.js']){
  if(!fs.existsSync(path.join(root,rel)))continue;
  let s=read(root,rel);
  if(!s.includes('SBC_V6557_REMOVE_RECOVERY_UNLOCK_CONTROL')){
   s += "\n;/* SBC_V6557_REMOVE_RECOVERY_UNLOCK_CONTROL: remove unsafe recovery unlock controls from the UI. */\n(function(){function prune(){try{document.querySelectorAll('button,a,[role=button],input[type=button],input[type=submit]').forEach(function(el){var label=[el.innerText,el.textContent,el.getAttribute('aria-label'),el.getAttribute('title'),el.value].filter(Boolean).join(' ').toLowerCase();if(/force.?unlock|recovery.?lock|recovery.?unlock/.test(label))el.remove();});}catch(_){}}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',prune,{once:true});else prune();try{new MutationObserver(prune).observe(document.documentElement,{subtree:true,childList:true});}catch(_){}})();\n";
   write(root,rel,s);
  }
 }
 for(const rel of ['public/sw.js','browser_public/sw.js']){
  if(!fs.existsSync(path.join(root,rel)))continue;
  let s=read(root,rel);
  if(/const CACHE=['"][^'"]+['"]/.test(s))s=s.replace(/const CACHE=['"][^'"]+['"]/, "const CACHE='sbc-static-v65-1-57-recovery-control-removed'");
  write(root,rel,s);
 }
 const identity='config/release-identity.js';
 if(fs.existsSync(path.join(root,identity))){
  let s=read(root,identity);
  s=s.replace(/const RELEASE_VERSION = '[^']+';/,"const RELEASE_VERSION = '65.1.57';");
  s=s.replace(/const RELEASE_NAME = '[^']+';/,"const RELEASE_NAME = 'RECOVERY_CONTROL_REMOVED';");
  s=s.replace(/major:65,minor:1,patch:\d+/,'major:65,minor:1,patch:57');
  write(root,identity,s);
 }
 if(fs.existsSync(path.join(root,'VERSION')))write(root,'VERSION',read(root,'VERSION').replace(/65\.1\.56/g,'65.1.57'));
 pkg.version=TO;
 pkg.description='SBC OS V65.1.57 removes the unsafe owner force-unlock route and automatic client trigger; normal recovery and writer-lease safeguards remain enforced.';
 pkg.scripts=pkg.scripts||{};
 pkg.scripts['test:v6557-owner-force-unlock']='node hotfix-assets/v6557-owner-force-unlock-test.js';
 if(!String(pkg.scripts['test:all']||'').includes('v6557-owner-force-unlock-test.js'))pkg.scripts['test:all']=String(pkg.scripts['test:all']||'node bootstrap.js --verify')+' && node hotfix-assets/v6557-owner-force-unlock-test.js';
 write(root,'package.json',JSON.stringify(pkg,null,2)+'\n');
 lock.version=TO;lock.packages[''].version=TO;lock.packages[''].description=pkg.description;lock.packages[''].scripts=pkg.scripts;
 write(root,'package-lock.json',JSON.stringify(lock,null,2)+'\n');
 const hd=path.join(root,'hotfix-assets');fs.mkdirSync(hd,{recursive:true});
 fs.copyFileSync(__filename,path.join(hd,'apply-v6557-owner-force-unlock.js'));
 const test=path.join(__dirname,'v6557-owner-force-unlock-test.js');if(!fs.existsSync(test))throw Error(MARKER+': regression test missing');
 fs.copyFileSync(test,path.join(hd,'v6557-owner-force-unlock-test.js'));
 return {marker:MARKER,version:TO,forceUnlockRouteInjected:false,automaticUnlockInjected:false,persistentOwnerOverrideInjected:false,normalRecoveryAndWriterLeaseGuardsPreserved:true};
}
module.exports={apply,MARKER,FROM,TO};
