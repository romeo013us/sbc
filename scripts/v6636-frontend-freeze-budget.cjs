'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(process.argv[2]||process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const pub=path.join(root,'public');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('public/index.html'),mirror=read('browser_public/index.html');
const refs=(pattern)=>[...html.matchAll(pattern)].map(m=>m[1]);
const scripts=refs(/<script\b[^>]*\bsrc=["'](\/[^"']+\.js(?:\?[^"']*)?)["'][^>]*>/gi);
const styles=refs(/<link\b[^>]*\bhref=["'](\/[^"']+\.css(?:\?[^"']*)?)["'][^>]*>/gi);
const paths=refs(/(?:href|src)=["'](\/[^"']+)["']/gi);
const bytes=xs=>xs.reduce((n,x)=>{
 const local=path.join(pub,x.split('?')[0].slice(1));
 if(!fs.existsSync(local))throw Error('MISSING_BUDGET_ASSET '+local);
 return n+fs.statSync(local).size;
},0);
const jsBytes=bytes(scripts),cssBytes=bytes(styles);
const css=styles[0]||'',hashed=/\/sbc-v6636-styles\.[a-f0-9]{16}\.css$/.test(css);
const match=css.match(/([a-f0-9]{16})\.css$/);
const hash=match?crypto.createHash('sha256').update(fs.readFileSync(path.join(pub,css.slice(1)))).digest('hex').slice(0,16):'';
const checks={
 canonicalEntrypoints:mirror===html,
 noFileSystemPaths:!html.includes('file:///')&&!mirror.includes('file:///'),
 renderBlockingStylesheetsAtMostOne:styles.length===1,
 contentAddressedBundle:hashed&&hash===match?.[1],
 externalJsRequestsNotIncreased:scripts.length<=90,
 startupJsBudget:jsBytes<=1100000,
 stylesheetBytesBudget:cssBytes<=400000,
 noLegacyImportModal:!html.includes('/sbc-lead-import-v6541.js'),
 allStaticPathsPresent:paths.filter(s=>/\.(?:css|js)(?:\?|$)/.test(s)).every(s=>fs.existsSync(path.join(pub,s.split('?')[0].slice(1)))),
 retainedSignedNav:html.includes('sbc-nav-geometry-v6612.js')
};
const report={result:Object.values(checks).every(Boolean)?'PASS_SOURCE_BUDGET':'FAIL_CLOSED',ui:'canonical V66.36',legacyScriptRequests:scripts.length,linkedStylesheets:styles.length,scriptBytes:jsBytes,stylesheetBytes:cssBytes,checks,note:'These are uncompressed static source budgets only; not live GoDaddy browser performance or company/SaaS certification.'};
console.log(JSON.stringify(report,null,2));if(report.result!=='PASS_SOURCE_BUDGET')process.exitCode=2;