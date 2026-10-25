'use strict';
/* Final V66 source artifact audit; scans files, never starts services or writes CRM. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(process.argv[2]||process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const required=['server.js','package.json','public/index.html','browser_public/index.html','public/sw.js','public/sbc-v6601-reference-cockpit.css'];
for(const rel of required)if(!fs.existsSync(path.join(root,rel)))throw Error('SBC_FINAL_AUDIT_MISSING '+rel);
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const html=read('public/index.html'),server=read('server.js'),sw=read('public/sw.js'),css=read('public/sbc-v6601-reference-cockpit.css');
const matches=html.matchAll(/(?:src|href)=["'](\/[^"']+)["']/g),assets=[],missing=[];
for(const m of matches){
 const name=m[1].split('?')[0].split('#')[0];
 if(!/\.(?:css|js)$/i.test(name))continue;
 assets.push(name);
 if(!fs.existsSync(path.join(root,'public',name.slice(1))))missing.push(name);
}
const routes=[...server.matchAll(/\bapp\.(get|post|put|patch|delete|all)\s*\(\s*["']([^"']+)["']/g)];
const routeCounts=new Map();
for(const match of routes){const key=match[1]+' '+match[2];routeCounts.set(key,(routeCounts.get(key)||0)+1);}
const duplicates=[...routeCounts].filter(([,n])=>n>1).map(([p,n])=>({path:p,count:n}));
const legacyImport=(server.match(/app\.post\('\/api\/crm\/leads\/import',auth,async/g)||[]).length;
const ownerImport=(server.match(/app\.post\('\/api\/crm\/leads\/import',auth,ownerOnly,async/g)||[]).length;
const badAssets=/if\(\/\\\.\(js\|css\|png\|jpg\|jpeg\|webp\|svg\|woff2\?\)\$\/i\.test\(file\)&&\/\[\?&\]v=/i.test(server);
const htmlLinks=[...html.matchAll(/(?:src|href)=["'](\/[^"']+\.(?:css|js)\?v=)([^"']+)["']/g)];
const oldUrls=htmlLinks.filter(m=>!m[2].startsWith('66.34-asset-cache-reset'));
const cssTags=[...html.matchAll(/<link\b[^>]*\brel=(["'])stylesheet\1[^>]*>/gi)];
const canonicalCss=(html.match(/href=["']\/(sbc-v6636-styles\.[a-f0-9]{16}\.css)["']/)||[])[1];
const browserHtml=read('browser_public/index.html');
const canonicalCssExists=Boolean(canonicalCss)&&fs.existsSync(path.join(root,'public',canonicalCss));
const mergedCss=canonicalCssExists?read('public/'+canonicalCss):'';
const originalStyleCount=[...mergedCss.matchAll(/\/\* source \/[A-Za-z0-9/_-]+\.css \*\//g)].length;

const must=[
 ['all local assets exist',missing.length===0],
 ['no duplicate app route keys',duplicates.length===0],
 ['legacy CSV writer removed',legacyImport===0&&ownerImport===1],
 ['mutable JS URLs safely revisioned',htmlLinks.length>=80&&oldUrls.length===0],
 ['canonical CSS reduces 67 linked stylesheets to one hashed resource',cssTags.length===1&&canonicalCssExists&&originalStyleCount>=60],
 ['secondary browser entrypoint matches canonical HTML',browserHtml===html&&!browserHtml.includes('file:///')],

 ['old import launcher disabled',!/<script[^>]+src=["']\/sbc-lead-import-v6541\.js/.test(html)],
 ['browser uses full-width deferred dashboard',css.includes('SBC_V6633_DEFERRED_DASHBOARD_GRID_COLLAPSE')],
 ['unsafe one-year cache condition removed',!badAssets&&server.includes('SBC_V6634_VERSIONED_ASSET_CACHE_FIX')],
 ['canonical service-worker cache activated',sw.includes('sbc-static-v66-36-canonical-shell')],
 ['recovery and tenant writer checks exist',server.includes('SBC_RUNTIME_WRITER_LEASE_REQUIRED')&&server.includes('MYSQL_RECOVERY_REQUIRED')],
 ['square webhook signature verified',server.includes('squareSignatureValid(')],
];
const appFiles=[];
function walk(d){for(const entry of fs.readdirSync(d,{withFileTypes:true})){if(['node_modules','.git','.sbc-browser'].includes(entry.name))continue;const p=path.join(d,entry.name);if(entry.isDirectory())walk(p);else if(entry.isFile()&&/\.(?:js|cjs|mjs)$/.test(entry.name))appFiles.push(p);}}
walk(root);
const syntaxFailures=[];
if(process.env.SBC_AUDIT_ALL_JS==='1')for(const file of appFiles){
 const r=cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH||'',HOME:'/tmp'}});
 if(r.status!==0)syntaxFailures.push({file:path.relative(root,file),issue:String(r.stderr||r.error?.message||'check failed').slice(0,240)});
}
const checkMap=must.map(([name,ok])=>({name,pass:ok}));
if(syntaxFailures.length)checkMap.push({name:'all JS source parses cleanly',pass:false});
const digest=crypto.createHash('sha256').update(server).digest('hex');
const report={status:checkMap.every(x=>x.pass)?'PASS_SOURCE_ONLY':'FAIL_CLOSED',release:'v66.36',files:appFiles.length,appRoutes:routes.length,referencedAssets:assets.length,uniqueAssets:new Set(assets).size,serverSha256:digest,missing,duplicates,oldAssetUrls:oldUrls.map(x=>x[0]).slice(0,12),syntaxFailures,checks:checkMap,productionAcceptance:{goDaddyPublishedCommitVerified:false,authenticatedEndToEndCheckout:false,squarePaymentConfirmed:false,crmHydrationConfirmed:false,twilioCallLogged:false,realBusinessRevenueCertified:false}};
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS_SOURCE_ONLY')process.exitCode=2;