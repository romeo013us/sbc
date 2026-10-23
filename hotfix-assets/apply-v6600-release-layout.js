'use strict';
const fs=require('node:fs'),path=require('node:path');
const VERSION='66.0.0',MARKER='SBC_V6600_RELEASE_LAYOUT',FORM_MARKER='SBC_V6600_FORM_FIELD_IDENTITY';
const FORM_SCRIPT="<script id=\"sbc-v6600-form-field-identity\" data-sbc-v6600-form-field-identity=\"true\">(function(){\n\"use strict\";\nif(window.__SBC_V6600_FORM_FIELD_IDENTITY__)return;window.__SBC_V6600_FORM_FIELD_IDENTITY__=true;var seq=0;\nfunction repair(root){(root||document).querySelectorAll(\"input,select,textarea\").forEach(function(el){var id=String(el.id||\"\").trim(),name=String(el.getAttribute(\"name\")||\"\").trim();if(id&&name)return;var base=\"sbc-field-\"+String(el.type||el.tagName||\"input\").toLowerCase().replace(/[^a-z0-9_-]/g,\"\")+\"-\"+(++seq);if(!id){id=base;while(document.getElementById(id))id=base+\"-\"+(++seq);el.id=id;}if(!name){var candidate=id,n=1;while(Array.prototype.some.call(document.querySelectorAll(\"[name]\"),function(x){return x!==el&&x.getAttribute(\"name\")===candidate;}))candidate=id+\"-\"+(++n);el.setAttribute(\"name\",candidate);}});}\nfunction start(){repair(document);if(window.MutationObserver){var observer=new MutationObserver(function(records){records.forEach(function(r){r.addedNodes.forEach(function(n){if(n.nodeType===1){if(n.matches&&n.matches(\"input,select,textarea\")&&(!n.id||!n.getAttribute(\"name\")))repair(n.parentNode||document);else if(n.querySelectorAll)repair(n);}});});});observer.observe(document.documentElement,{childList:true,subtree:true});}}\nif(document.readyState===\"loading\")document.addEventListener(\"DOMContentLoaded\",start,{once:true});else start();\n})();</script>";
const CSS=`
/* ${MARKER}: responsive shell containment; never override application visibility state. */
:root{--sbc-nav-width:260px;--sbc-nav-collapsed:72px;--sbc-header-height:64px;--sbc-layout-gap:16px;--sbc-bg-graphite:#141820;--sbc-bg-surface:#1e2635;--sbc-accent-blue:#1677ff;--sbc-accent-cyan:#00dfd8;--sbc-accent-orange:#ff6a00}
html,body{width:100%;min-width:320px;min-height:100%;margin:0}
*,*::before,*::after{box-sizing:border-box}
body{overflow-x:hidden}
#sbc-command-center,#sbc-command-center-root,#sbc-sidebar-rail,#sbc-main-viewport,#sbc-main-workspace-viewport,[data-sbc-command-center],.sbc-command-center{min-width:0;max-width:100%;box-sizing:border-box}
#sbc-command-center,#sbc-command-center-root,[data-sbc-command-center],.sbc-command-center{display:flex;width:100%;min-height:100vh;min-height:100dvh;max-width:100%;overflow:hidden}
#sbc-sidebar-rail{flex:0 0 var(--sbc-nav-width,260px);width:var(--sbc-nav-width,260px);min-width:0;max-width:100%;min-height:0;position:relative;z-index:100;transition:width .22s ease,flex-basis .22s ease}
#sbc-main-viewport,#sbc-main-workspace-viewport{flex:1 1 0%;width:auto;min-width:0;min-height:0;max-width:100%;display:flex;flex-direction:column;position:relative;overflow-x:hidden;overflow-y:auto}
.dashboard-viewport{display:grid!important;grid-template-columns:var(--sbc-nav-width) minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr)!important;width:100%;max-width:100%;min-width:0;min-height:100vh;min-height:100dvh;overflow:hidden}
.dashboard-viewport>.navigation-rail-container,.dashboard-viewport>aside,.dashboard-viewport>.sidebar{grid-column:1;grid-row:1;min-width:0;min-height:0;width:100%;max-width:100%;height:100%;overflow-y:auto;overflow-x:hidden;transition:width .18s ease,min-width .18s ease}
.dashboard-viewport:has(>.navigation-rail-container.is-collapsed,>.navigation-rail-container.collapsed,>.navigation-rail-container[data-collapsed="true"],>.navigation-rail-container.sidebar-collapsed,>aside.is-collapsed,>aside.collapsed,>aside[data-collapsed="true"],>aside.sidebar-collapsed,>.sidebar.is-collapsed,>.sidebar.collapsed,>.sidebar[data-collapsed="true"],>.sidebar.sidebar-collapsed){--sbc-nav-width:var(--sbc-nav-collapsed)}
.dashboard-viewport>.navigation-rail-container.is-collapsed,.dashboard-viewport>.navigation-rail-container.collapsed,.dashboard-viewport>.navigation-rail-container[data-collapsed="true"],.dashboard-viewport>.navigation-rail-container.sidebar-collapsed,.dashboard-viewport>aside.is-collapsed,.dashboard-viewport>aside.collapsed,.dashboard-viewport>aside[data-collapsed="true"],.dashboard-viewport>aside.sidebar-collapsed,.dashboard-viewport>.sidebar.is-collapsed,.dashboard-viewport>.sidebar.collapsed,.dashboard-viewport>.sidebar[data-collapsed="true"],.dashboard-viewport>.sidebar.sidebar-collapsed{overflow-x:hidden}
.dashboard-viewport:has(>.navigation-rail-container.is-expanded,>.navigation-rail-container[data-collapsed="false"],>aside.is-expanded,>aside[data-collapsed="false"],>.sidebar.is-expanded,>.sidebar[data-collapsed="false"]){--sbc-nav-width:260px}
.dashboard-viewport>.main-content-area,.dashboard-viewport>main,.dashboard-viewport>#content,.dashboard-viewport>.content-area{grid-column:2;grid-row:1;min-width:0;min-height:0;width:100%;max-width:100%;overflow-x:hidden;overflow-y:auto}
.main-content-area,#content,#main-content,main,.main-content,.main-content-wrapper,.dashboard-content,.page-content,.content-area,.workspace-content{min-width:0;min-height:0;max-width:100%;box-sizing:border-box}
.dashboard-grid,.metrics-grid,.stat-grid,.kpi-grid,.dashboard-cards,.home-grid,.sbc63-grid,.sbc-module-grid-containment{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:var(--sbc-layout-gap);min-width:0;width:100%;max-width:100%;box-sizing:border-box;align-items:start}
.dashboard-grid>*,.metrics-grid>*,.stat-grid>*,.kpi-grid>*,.dashboard-cards>*,.home-grid>*,.sbc63-grid>*,.sbc-module-grid-containment>*{min-width:0;min-height:0;max-width:100%;overflow-wrap:anywhere}
.navigation-rail-container{flex:0 1 auto;min-width:0;max-width:100%;width:100%}.navigation-rail-container.is-collapsed,.navigation-rail-container.collapsed,.navigation-rail-container[data-collapsed="true"],.navigation-rail-container.sidebar-collapsed{flex-basis:var(--sbc-nav-collapsed);width:var(--sbc-nav-collapsed);min-width:var(--sbc-nav-collapsed);max-width:var(--sbc-nav-collapsed)}
@media(max-width:900px){:root{--sbc-nav-width:220px;--sbc-layout-gap:12px}.dashboard-viewport{grid-template-columns:var(--sbc-nav-width) minmax(0,1fr)!important}}
@media(max-width:640px){:root{--sbc-nav-width:72px;--sbc-layout-gap:10px}.dashboard-viewport>.navigation-rail-container,.dashboard-viewport>aside,.dashboard-viewport>.sidebar{width:var(--sbc-nav-width);max-width:var(--sbc-nav-width)}.dashboard-grid,.metrics-grid,.stat-grid,.kpi-grid,.dashboard-cards,.home-grid,.sbc63-grid,.sbc-module-grid-containment{grid-template-columns:minmax(0,1fr)}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;transition-duration:.01ms!important}}
`;
function alignReleaseIdentity(root){
 const walk=(dir,out=[])=>{
  if(!fs.existsSync(dir))return out;
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
   if(['node_modules','data','backups','.git'].includes(e.name)||e.name.startsWith('.sbc-runtime-'))continue;
   const f=path.join(dir,e.name);
   if(e.isDirectory())walk(f,out);
   else if(/\.(?:js|cjs|mjs|json|css|html)$/.test(e.name))out.push(f);
  }
  return out;
 };
 const candidates=walk(root);
 const guardFiles=candidates.filter(f=>/RELEASE_IDENTITY_MISMATCH|ACTIVE_PACKAGE_RELEASE|RELEASE_VERSION/.test(fs.readFileSync(f,'utf8')) && !/(?:-test|\.test)\.(?:js|cjs|mjs)$/i.test(f));
 const browser=path.join(root,'browser_public/app.js');
 if(fs.existsSync(browser)&&!guardFiles.includes(browser))guardFiles.push(browser);
 let replacements=0;
 for(const f of guardFiles){
  const before=fs.readFileSync(f,'utf8');
  const after=before.replace(/65\.1\.(?:71|72|73)/g,VERSION);
  if(after!==before){
   replacements+=(before.match(/65\.1\.(?:71|72|73)/g)||[]).length;
   fs.writeFileSync(f,after);
  }
 }
 const stale=guardFiles.filter(f=>/65\.1\.(?:71|72|73)/.test(fs.readFileSync(f,'utf8')));
 if(stale.length)throw Error(MARKER+': stale release guard pin remains in '+stale.map(f=>path.relative(root,f)).join(', '));
 return {guardFiles:guardFiles.map(f=>path.relative(root,f)),replacements};
}
function injectFormIdentity(root){
 const changed=[];
 for(const rel of ['public/index.html','browser_public/index.html']){
  const file=path.join(root,rel);if(!fs.existsSync(file))continue;
  let html=fs.readFileSync(file,'utf8');
  if(!html.includes(FORM_MARKER)){
   if(/<\/body>/i.test(html))html=html.replace(/<\/body>/i,FORM_SCRIPT+'\n</body>');
   else html+='\n'+FORM_SCRIPT+'\n';
   fs.writeFileSync(file,html);
  }
  if(!html.includes(FORM_MARKER))throw Error(MARKER+': form-field identity script was not installed in '+rel);
  changed.push(rel);
 }
 if(!changed.length)throw Error(MARKER+': no HTML entrypoint available for form-field identity');
 return changed;
}
function installReferenceCockpit(root){
 const marker='SBC_V6601_REFERENCE_COCKPIT';
 const source=path.join(__dirname,'sbc-v6601-reference-cockpit.css');
 if(!fs.existsSync(source))throw Error(marker+': required cockpit stylesheet missing');
 const installed=[];
 for(const rel of ['public','browser_public']){
  const dir=path.join(root,rel);if(!fs.existsSync(dir))continue;
  fs.copyFileSync(source,path.join(dir,'sbc-v6601-reference-cockpit.css'));
  const htmlPath=path.join(dir,'index.html');
  if(fs.existsSync(htmlPath)){
   let html=fs.readFileSync(htmlPath,'utf8');
   html=html.replace(/<link\b[^>]*href=["'][^"']*sbc-v6574-draggable-nav-rail\.css[^>]*>\s*/gi,'');
   html=html.replace(/<script\b[^>]*src=["'][^"']*sbc-v6574-draggable-nav-rail\.js[^>]*><\/script>\s*/gi,'');
   const link='<link rel="stylesheet" data-sbc-v6601-reference-cockpit="true" href="/sbc-v6601-reference-cockpit.css?v=66.0.0">';
   if(!html.includes(marker)&&!html.includes('data-sbc-v6601-reference-cockpit="true"'))html=/<\/head>/i.test(html)?html.replace(/<\/head>/i,link+'\n</head>'):link+'\n'+html;
   fs.writeFileSync(htmlPath,html);
   if(!html.includes('data-sbc-v6601-reference-cockpit="true"'))throw Error(marker+': stylesheet link not installed in '+rel+'/index.html');
   installed.push(rel+'/index.html');
  }
 }
 for(const rel of ['public/sbc-v6574-draggable-nav-rail.css','public/sbc-v6574-draggable-nav-rail.js','browser_public/sbc-v6574-draggable-nav-rail.css','browser_public/sbc-v6574-draggable-nav-rail.js']){const f=path.join(root,rel);if(fs.existsSync(f))fs.rmSync(f,{force:true});}
 return installed;
}
function apply(root){
 const changed=[];
 for(const rel of ['public/index.html','browser_public/index.html']){
  const f=path.join(root,rel);if(!fs.existsSync(f))continue;
  let html=fs.readFileSync(f,'utf8');
  if(!html.includes(MARKER)){const style='<style id="sbc-v6600-release-layout">'+CSS+'</style>';html=/<\/head>/i.test(html)?html.replace(/<\/head>/i,style+'\n</head>'):style+'\n'+html;}
  html=html.replace(/([?&]v=)65\.1\.(?:61|72|73)(?=([&#"'\s]|$))/g,'$1'+VERSION);
  html=html.replace(/((?:release|version|build)[^\r\n]{0,100}?)(V?)65\.1\.(?:61|72|73)/gi,'$1$2'+VERSION);
  html=html.replace(/V?65\.1\.(?:61|72|73)/g,VERSION);
  fs.writeFileSync(f,html);changed.push(rel);
 }
 const formEntrypoints=injectFormIdentity(root);
 for(const rel of ['package.json','package-lock.json']){
  const f=path.join(root,rel);if(!fs.existsSync(f))continue;const o=JSON.parse(fs.readFileSync(f,'utf8'));o.version=VERSION;if(o.packages&&o.packages[''])o.packages[''].version=VERSION;
  if(rel==='package.json')o.description='SBC OS V66.0.0: responsive dashboard shell and synchronized release identity; business data and writer safeguards preserved.';
  if(rel==='package-lock.json'&&o.packages&&o.packages[''])o.packages[''].description='SBC OS V66.0.0: responsive dashboard shell and synchronized release identity; business data and writer safeguards preserved.';
  fs.writeFileSync(f,JSON.stringify(o,null,2)+'\n');changed.push(rel);
 }
 const v=path.join(root,'VERSION');if(fs.existsSync(v)){fs.writeFileSync(v,VERSION+'\n');changed.push('VERSION')}
 const sw=path.join(root,'public/sw.js');if(fs.existsSync(sw)){let s=fs.readFileSync(sw,'utf8').replace(/65-1-(?:61|72|73)/g,'66-0-0').replace(/65\.1\.(?:61|72|73)/g,VERSION);fs.writeFileSync(sw,s);changed.push('public/sw.js')}
 const supportFiles=[
  ['enterprise/v56133-mysql-query-guard.js','enterprise/v56133-mysql-query-guard.js'],
  ['scripts/query-guard-cleanup-regression.test.js','scripts/query-guard-cleanup-regression.test.js']
 ];
 for(const [sourceRel,targetRel] of supportFiles){
  const source=path.join(__dirname,'..',sourceRel),target=path.join(root,targetRel);
  if(!fs.existsSync(source))throw Error(MARKER+': required V66 support file missing: '+sourceRel);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.copyFileSync(source,target);
 }
 const pkgPath=path.join(root,'package.json'),lockPath=path.join(root,'package-lock.json');
 const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8')),lock=JSON.parse(fs.readFileSync(lockPath,'utf8'));
 pkg.scripts=pkg.scripts||{};
 if(!String(pkg.scripts['test:all']||'').includes('query-guard-cleanup-regression.test.js'))pkg.scripts['test:all']=String(pkg.scripts['test:all']||'node bootstrap.js --verify')+' && node scripts/query-guard-cleanup-regression.test.js';
 lock.packages=lock.packages||{};lock.packages['']=lock.packages['']||{};
 lock.packages[''].scripts=pkg.scripts;lock.packages[''].version=VERSION;
 fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');
 fs.writeFileSync(lockPath,JSON.stringify(lock,null,2)+'\n');
 const referenceEntrypoints=installReferenceCockpit(root);
 const releaseIdentity=alignReleaseIdentity(root);
 return {marker:MARKER,version:VERSION,changed,formEntrypoints,referenceEntrypoints,releaseIdentity,crmWrites:false,databaseChanges:false,leaseSafeguardsChanged:false};
}
module.exports={apply,VERSION,MARKER};
