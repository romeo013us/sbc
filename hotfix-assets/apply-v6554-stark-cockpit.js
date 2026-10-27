'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6554_STARK_CINEMATIC_COCKPIT',FROM='65.1.53',TO='65.1.54';
const CSS=`/* SBC V65.1.54 Stark Cinematic Cockpit — presentation layer only */
:root{color-scheme:dark;--stark-bg:#06101d;--stark-panel:rgba(10,24,41,.96);--stark-line:rgba(67,190,231,.25);--stark-cyan:#00e5ff;--stark-blue:#2b76ff;--stark-ink:#e7f4ff;--stark-muted:#829db6;--stark-radius:3px;--stark-shadow:0 12px 36px rgba(0,0,0,.24)}
html,body{min-height:100%;background:radial-gradient(ellipse at 72% -12%,rgba(17,87,139,.24),transparent 42%),linear-gradient(145deg,#06101d,#081524 55%,#050c16)!important;color:var(--stark-ink)!important}
.sidebar{background:linear-gradient(180deg,#071321,#050d18)!important;border-right:1px solid var(--stark-line)!important;color:var(--stark-ink)!important}
.topbar{background:rgba(5,14,25,.93)!important;border-bottom:1px solid var(--stark-line)!important;backdrop-filter:blur(16px)!important}
.main{min-width:0!important;background:transparent!important}
.content{width:100%!important;max-width:none!important;margin:0!important;padding:clamp(14px,1.55vw,26px)!important}
.hero{background:linear-gradient(110deg,rgba(8,26,45,.98),rgba(8,40,65,.96) 58%,rgba(8,67,92,.82))!important;border:1px solid var(--stark-line)!important;box-shadow:var(--stark-shadow)!important;color:var(--stark-ink)!important}
.card,.stat,.list-card,.detail-box,.install-tip,.table-wrap,.modal-card,.sbc-product,.sales-builder-package{background:linear-gradient(145deg,rgba(13,30,49,.97),rgba(8,21,36,.97))!important;color:var(--stark-ink)!important;border:1px solid var(--stark-line)!important;border-radius:var(--stark-radius)!important;box-shadow:var(--stark-shadow)!important}
.card-head{background:linear-gradient(90deg,rgba(0,229,255,.055),transparent 75%)!important;border-bottom:1px solid var(--stark-line)!important}
.card-head h2,.card-head h3,.card-head h4{color:#dff5ff!important}
.stat .label,.stat .mini,.stat .sub,.eyebrow{color:var(--stark-cyan)!important;font-family:ui-monospace,SFMono-Regular,Consolas,monospace!important;letter-spacing:.1em!important;text-transform:uppercase!important}
.stat .value{color:#eafaff!important;font-family:ui-monospace,SFMono-Regular,Consolas,monospace!important;text-shadow:0 0 16px rgba(0,229,255,.09)!important}
h1,h2,h3,h4{color:#f0f9ff}
button,.btn,.primary,.sun-btn,.academy-open-btn,input,select,textarea{border-radius:3px!important}
input,select,textarea{background:#071727!important;color:var(--stark-ink)!important;border-color:var(--stark-line)!important}
button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--stark-cyan)!important;outline-offset:2px}
.table th,th{background:rgba(0,229,255,.055)!important;color:var(--stark-cyan)!important;font:700 10px ui-monospace,SFMono-Regular,Consolas,monospace!important;letter-spacing:.1em;text-transform:uppercase}
.table td,td{border-bottom:1px solid rgba(67,190,231,.12)}
.table tr:hover td{background:rgba(0,229,255,.035)!important}
.sbc-build-version{background:rgba(0,229,255,.08)!important;color:#7ff4ff!important;border:1px solid var(--stark-line)!important;border-radius:3px!important;font:700 9px ui-monospace,SFMono-Regular,Consolas,monospace!important}
@media(min-width:1600px){.content{padding-left:clamp(18px,2vw,36px)!important;padding-right:clamp(18px,2vw,36px)!important}}
@media(max-width:900px){.main{margin-left:0!important}.content{padding:14px!important}.stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(max-width:520px){.stats{grid-template-columns:1fr!important}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important}}
`;
function read(root,rel){const f=path.join(root,rel);if(!fs.existsSync(f))throw Error(MARKER+': missing '+rel);return fs.readFileSync(f,'utf8')}
function write(root,rel,s){const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' anchor count '+n);return s.replace(a,b)}
function patchHtml(root,rel){
 let s=read(root,rel);
 if(s.includes(MARKER)||s.includes('sbc-stark-cockpit-v6554.css'))throw Error(MARKER+': patch already applied to '+rel);
 s=once(s,'</head>','<script id="sbc-stark-cockpit-theme-default">try{if(!localStorage.getItem("sbc-theme"))localStorage.setItem("sbc-theme","dark")}catch(e){}</script>\n</head>',rel+' dark default');
 s=once(s,'</body>','<link rel="stylesheet" href="/sbc-stark-cockpit-v6554.css?v=65.1.54-stark-cockpit">\n<!-- '+MARKER+': visual-only theme; workflows retained -->\n</body>',rel+' stylesheet');
 s=s.replace(/65\.1\.53/g,'65.1.54');
 write(root,rel,s);
}
function apply(root){
 const pkg=JSON.parse(read(root,'package.json')),lock=JSON.parse(read(root,'package-lock.json'));
 if(pkg.name!=='sbc-business-command-center'||pkg.version!==FROM||lock.version!==FROM||lock.packages?.['']?.version!==FROM)throw Error(MARKER+': expected package/lock identity '+FROM);
 patchHtml(root,'public/index.html');
 if(fs.existsSync(path.join(root,'browser_public/index.html')))patchHtml(root,'browser_public/index.html');
 write(root,'public/sbc-stark-cockpit-v6554.css',CSS);
 if(fs.existsSync(path.join(root,'browser_public')))write(root,'browser_public/sbc-stark-cockpit-v6554.css',CSS);
 let sw=read(root,'public/sw.js');
 if(!/const CACHE=['"][^'"]+['"]/.test(sw))throw Error(MARKER+': service-worker cache key missing');
 sw=sw.replace(/const CACHE=['"][^'"]+['"]/, "const CACHE='sbc-static-v65-1-54-stark-cockpit'");
 if(!sw.includes("keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE)"))throw Error(MARKER+': old-cache purge guard missing');
 write(root,'public/sw.js',sw);
 if(fs.existsSync(path.join(root,'browser_public/sw.js'))){let s=read(root,'browser_public/sw.js');if(/const CACHE=['"][^'"]+['"]/.test(s))write(root,'browser_public/sw.js',s.replace(/const CACHE=['"][^'"]+['"]/, "const CACHE='sbc-static-v65-1-54-stark-cockpit'"))}
 if(fs.existsSync(path.join(root,'config/release-identity.js'))){let s=read(root,'config/release-identity.js');s=once(s,"const RELEASE_VERSION = '65.1.53';","const RELEASE_VERSION = '65.1.54';",'release version');s=once(s,"const RELEASE_NAME = 'COMMAND_CENTER_REDESIGN';","const RELEASE_NAME = 'STARK_CINEMATIC_COCKPIT';",'release name');s=once(s,'major:65,minor:1,patch:53','major:65,minor:1,patch:54','semantic release version');write(root,'config/release-identity.js',s)}
 if(fs.existsSync(path.join(root,'browser_public/app.js'))){let s=read(root,'browser_public/app.js');if(s.includes('65.1.53'))s=s.replace(/65\.1\.53/g,'65.1.54');write(root,'browser_public/app.js',s)}
 if(fs.existsSync(path.join(root,'VERSION')))write(root,'VERSION',read(root,'VERSION').replace(/65\.1\.53/g,'65.1.54'))
 pkg.version=TO;pkg.description='SBC OS V65.1.54 Stark Cinematic Cockpit; visual-only layer with recovery and writer safeguards preserved';
 pkg.scripts=pkg.scripts||{};pkg.scripts['test:v6554-stark-cockpit']='node hotfix-assets/v6554-stark-cockpit-test.js';
 if(!String(pkg.scripts['test:all']||'').includes('v6554-stark-cockpit-test.js'))pkg.scripts['test:all']=String(pkg.scripts['test:all']||'node bootstrap.js --verify')+' && node hotfix-assets/v6554-stark-cockpit-test.js';
 write(root,'package.json',JSON.stringify(pkg,null,2)+'\n');
 lock.version=TO;lock.packages[''].version=TO;lock.packages[''].description=pkg.description;lock.packages[''].scripts=pkg.scripts;write(root,'package-lock.json',JSON.stringify(lock,null,2)+'\n');
 const server=read(root,'server.js');
 if(!server.includes('MYSQL_RECOVERY_REQUIRED')||!server.includes('SBC_RUNTIME_WRITER_LEASE_REQUIRED'))throw Error(MARKER+': recovery/writer guard markers missing; refusing release');
 write(root,'server.js',server+'\n// '+MARKER+': visual-only release; existing recovery, tenant, and writer safeguards remain.\n');
 const hotfixDir=path.join(root,'hotfix-assets');fs.mkdirSync(hotfixDir,{recursive:true});fs.copyFileSync(__filename,path.join(hotfixDir,'apply-v6554-stark-cockpit.js'));
 const testSource=path.join(__dirname,'v6554-stark-cockpit-test.js');if(!fs.existsSync(testSource))throw Error(MARKER+': regression test source missing');fs.copyFileSync(testSource,path.join(hotfixDir,'v6554-stark-cockpit-test.js'));
 return {marker:MARKER,version:TO,visualOnly:true,fullWidthWorkspace:true,recoveryAndWriterGuardsPreserved:true};
}
module.exports={apply,MARKER,FROM,TO};
