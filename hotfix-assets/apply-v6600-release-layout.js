'use strict';
const fs=require('node:fs'),path=require('node:path');
const VERSION='66.0.0',MARKER='SBC_V6600_RELEASE_LAYOUT';
const CSS=`
/* ${MARKER}: explicit, non-collapsing responsive shell. */
:root{--sbc-nav-width:260px;--sbc-nav-collapsed:72px;--sbc-header-height:64px;--sbc-layout-gap:16px;--sbc-bg-graphite:#141820;--sbc-bg-surface:#1e2635;--sbc-accent-blue:#1677ff;--sbc-accent-cyan:#00dfd8;--sbc-accent-orange:#ff6a00}
html,body{width:100%;min-width:320px;min-height:100%;margin:0}
*,*::before,*::after{box-sizing:border-box}
.dashboard-viewport{display:grid!important;grid-template-columns:var(--sbc-nav-width) minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr)!important;min-height:100vh!important;width:100%!important;max-width:100%!important;overflow:hidden}
.dashboard-viewport>.navigation-rail-container,.dashboard-viewport>aside,.dashboard-viewport>.sidebar{grid-column:1;min-width:0;width:var(--sbc-nav-width);max-width:var(--sbc-nav-width)}
.dashboard-viewport>.main-content-area,.dashboard-viewport>main,.dashboard-viewport>#content,.dashboard-viewport>.content-area{grid-column:2;min-width:0;width:100%;max-width:100%;overflow:auto}
.main-content-area,#content,#main-content,main,.main-content,.main-content-wrapper,.dashboard-content,.page-content,.content-area,.workspace-content{min-width:0;max-width:100%;box-sizing:border-box}
.dashboard-grid,.metrics-grid,.stat-grid,.kpi-grid,.dashboard-cards,.home-grid,.sbc63-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:var(--sbc-layout-gap);min-width:0;width:100%;max-width:100%}
.dashboard-grid>*,.metrics-grid>*,.stat-grid>*,.kpi-grid>*,.dashboard-cards>*,.home-grid>*,.sbc63-grid>*{min-width:0;max-width:100%;overflow-wrap:anywhere}
.navigation-rail-container{flex:0 0 var(--sbc-nav-width);min-width:var(--sbc-nav-width);max-width:var(--sbc-nav-width)}
@media(max-width:900px){:root{--sbc-nav-width:220px;--sbc-layout-gap:12px}.dashboard-viewport{grid-template-columns:var(--sbc-nav-width) minmax(0,1fr)!important}}
@media(max-width:640px){:root{--sbc-nav-width:72px;--sbc-layout-gap:10px}.dashboard-viewport>.navigation-rail-container,.dashboard-viewport>aside,.dashboard-viewport>.sidebar{width:var(--sbc-nav-width);max-width:var(--sbc-nav-width)}.dashboard-grid,.metrics-grid,.stat-grid,.kpi-grid,.dashboard-cards,.home-grid,.sbc63-grid{grid-template-columns:minmax(0,1fr)}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;transition-duration:.01ms!important}}
`;
function alignReleaseIdentity(root){
else if(/\.(?:js|cjs|mjs|json|css|html)$/.test(e.name))out.push(f);
 const guardFiles=walk(root).filter(f=>fs.readFileSync(f,'utf8').includes('RELEASE_IDENTITY_MISMATCH'));
 const browser=path.join(root,'browser_public/app.js');if(fs.existsSync(browser)&&!guardFiles.includes(browser))guardFiles.push(browser);
 let replacements=0;
 for(const f of guardFiles){let s=fs.readFileSync(f,'utf8');const n=s.split('65.1.73').length-1;if(n){s=s.split('65.1.73').join(VERSION);fs.writeFileSync(f,s);replacements+=n}}
 const stale=guardFiles.filter(f=>fs.readFileSync(f,'utf8').includes('RELEASE_IDENTITY_MISMATCH')&&fs.readFileSync(f,'utf8').includes('expected 65.1.73'));
 if(stale.length)throw Error(MARKER+': stale release guard pin remains in '+stale.map(f=>path.relative(root,f)).join(', '));
 return {guardFiles:guardFiles.map(f=>path.relative(root,f)),replacements};
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
 for(const rel of ['package.json','package-lock.json']){
  const f=path.join(root,rel);if(!fs.existsSync(f))continue;const o=JSON.parse(fs.readFileSync(f,'utf8'));o.version=VERSION;if(o.packages&&o.packages[''])o.packages[''].version=VERSION;
  if(rel==='package.json')o.description='SBC OS V66.0.0: responsive dashboard shell and synchronized release identity; business data and writer safeguards preserved.';
  if(rel==='package-lock.json'&&o.packages&&o.packages[''])o.packages[''].description='SBC OS V66.0.0: responsive dashboard shell and synchronized release identity; business data and writer safeguards preserved.';
  fs.writeFileSync(f,JSON.stringify(o,null,2)+'\n');changed.push(rel);
 }
 const v=path.join(root,'VERSION');if(fs.existsSync(v)){fs.writeFileSync(v,VERSION+'\n');changed.push('VERSION')}
 const sw=path.join(root,'public/sw.js');if(fs.existsSync(sw)){let s=fs.readFileSync(sw,'utf8').replace(/65-1-(?:61|72|73)/g,'66-0-0').replace(/65\.1\.(?:61|72|73)/g,VERSION);fs.writeFileSync(sw,s);changed.push('public/sw.js')}
 const releaseIdentity=alignReleaseIdentity(root);\n return {marker:MARKER,version:VERSION,changed,releaseIdentity,crmWrites:false,databaseChanges:false,leaseSafeguardsChanged:false};
}
module.exports={apply,VERSION,MARKER};
