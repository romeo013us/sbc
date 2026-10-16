'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6554_STARK_CINEMATIC_COCKPIT',TO='65.1.54';
const CSS=`/* SBC V65.1.54 Stark Cinematic Cockpit — visual layer only */
:root{color-scheme:dark;--stark-bg:#06101d;--stark-panel:rgba(10,24,41,.94);--stark-line:rgba(67,190,231,.24);--stark-cyan:#00e5ff;--stark-blue:#2b76ff;--stark-ink:#e7f4ff;--stark-muted:#829db6}
html,body{min-height:100%;background:radial-gradient(ellipse at 72% -12%,rgba(17,87,139,.24),transparent 42%),linear-gradient(145deg,#06101d,#081524 55%,#050c16)!important;color:var(--stark-ink)}
#app,.app{width:100%;max-width:none}
.main{min-width:0;background:transparent}
.content,.main-content,.workspace,.page-content{width:100%!important;max-width:none!important}
.sidebar{background:linear-gradient(180deg,#071321,#050d18)!important;border-right:1px solid var(--stark-line)!important;color:var(--stark-ink)}
.topbar,header.topbar{background:rgba(5,14,25,.92)!important;border-bottom:1px solid var(--stark-line)!important;backdrop-filter:blur(16px)}
h1,h2,h3{color:#f0f9ff}
.eyebrow,.micro-label,.section-label{color:var(--stark-cyan);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase}
.card,.panel,.kpi-card,.stat-card,.modal-content,.table-container{background:var(--stark-panel)!important;border:1px solid var(--stark-line)!important;box-shadow:0 12px 36px rgba(0,0,0,.22)}
button,.btn,.nav-item,.v56-nav-item,input,select,textarea{border-radius:3px}
button,.btn{transition:border-color .15s ease,background .15s ease}
button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--stark-cyan);outline-offset:2px}
input,select,textarea{background:#071727;color:var(--stark-ink);border-color:var(--stark-line)}
table{width:100%;border-collapse:collapse}th{color:var(--stark-cyan);font:700 10px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase}td,th{border-bottom:1px solid rgba(67,190,231,.12);padding:10px 12px}
@media(min-width:1600px){.content,.main-content,.workspace,.page-content{padding-right:clamp(18px,2vw,36px);padding-left:clamp(18px,2vw,36px)}}
@media(max-width:900px){.main{margin-left:0!important}.content,.main-content,.workspace,.page-content{padding:14px!important}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important}}
`;
function read(root,rel){const p=path.join(root,rel);if(!fs.existsSync(p))throw Error(MARKER+': missing '+rel);return fs.readFileSync(p,'utf8')}
function write(root,rel,s){const p=path.join(root,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s)}
function inject(root,rel){
 let s=read(root,rel);if(s.includes(MARKER))return false;
 if(!s.includes('</head>')||!s.includes('</body>'))throw Error(MARKER+': expected head/body anchors in '+rel);
 s=s.replace('</head>','<script id="sbc-stark-theme-default">try{if(!localStorage.getItem("sbc-theme"))localStorage.setItem("sbc-theme","dark")}catch(e){}</script>\n</head>');
 s=s.replace('</body>','<link rel="stylesheet" href="/sbc-stark-cockpit-v6554.css?v=65.1.54">\n<!-- '+MARKER+': visual-only layer -->\n</body>');
 return (write(root,rel,s),true);
}
function apply(root){
 const pkg=JSON.parse(read(root,'package.json'));
 if(pkg.name!=='sbc-business-command-center'||!['65.1.52','65.1.53'].includes(pkg.version))throw Error(MARKER+': unsupported package baseline '+pkg.version);
 const changed=[];
 for(const rel of ['public/index.html','browser_public/index.html'])if(fs.existsSync(path.join(root,rel))&&inject(root,rel))changed.push(rel);
 if(!changed.length&&!['public/index.html','browser_public/index.html'].some(rel=>fs.existsSync(path.join(root,rel))&&read(root,rel).includes(MARKER)))throw Error(MARKER+': no frontend entry point found');
 write(root,'public/sbc-stark-cockpit-v6554.css',CSS);
 if(fs.existsSync(path.join(root,'browser_public')))write(root,'browser_public/sbc-stark-cockpit-v6554.css',CSS);
 for(const rel of ['public/sw.js','browser_public/sw.js'])if(fs.existsSync(path.join(root,rel))){let s=read(root,rel);s=s.replace(/const CACHE=(["'])[^"']+\1/,"const CACHE='sbc-static-v65-1-54-stark-cockpit'");write(root,rel,s)}
 for(const rel of ['config/release-identity.js','browser_public/app.js','VERSION'])if(fs.existsSync(path.join(root,rel))){let s=read(root,rel).replace(/65\.1\.(52|53)/g,TO).replace(/V65\.1\.(52|53)/g,'V'+TO);if(rel.endsWith('release-identity.js'))s=s.replace('REMOVE_BOTTOM_SHORTCUTS','STARK_CINEMATIC_COCKPIT').replace('COMMAND_CENTER_REDESIGN','STARK_CINEMATIC_COCKPIT');write(root,rel,s)}
 pkg.version=TO;pkg.description='SBC OS V65.1.54 Stark Cinematic Cockpit — visual-only HUD styling with existing workflows and safeguards preserved';
 pkg.scripts=pkg.scripts||{};pkg.scripts['test:v6554-stark-cockpit']='node hotfix-assets/v6554-stark-cockpit-test.js';
 if(!String(pkg.scripts['test:all']||'').includes('v6554-stark-cockpit-test.js'))pkg.scripts['test:all']=String(pkg.scripts['test:all']||'node bootstrap.js --verify')+' && node hotfix-assets/v6554-stark-cockpit-test.js';
 write(root,'package.json',JSON.stringify(pkg,null,2)+'\n');
 const lp=path.join(root,'package-lock.json');if(fs.existsSync(lp)){const lock=JSON.parse(read(root,'package-lock.json'));lock.version=TO;if(lock.packages&&lock.packages[''])lock.packages[''].version=TO;write(root,'package-lock.json',JSON.stringify(lock,null,2)+'\n')}
 const server=read(root,'server.js');if(!server.includes('MYSQL_RECOVERY_REQUIRED')||!server.includes('SBC_RUNTIME_WRITER_LEASE_REQUIRED'))throw Error(MARKER+': recovery/writer safeguards not found; refusing release');
 const dest=path.join(root,'hotfix-assets');fs.mkdirSync(dest,{recursive:true});fs.copyFileSync(__filename,path.join(dest,'apply-v6554-stark-cockpit.js'));
 const test=path.join(__dirname,'v6554-stark-cockpit-test.js');if(fs.existsSync(test))fs.copyFileSync(test,path.join(dest,'v6554-stark-cockpit-test.js'));
 return {marker:MARKER,version:TO,visualOnly:true,changed, recoveryAndWriterGuardsPreserved:true};
}
module.exports={apply,MARKER,TO};
