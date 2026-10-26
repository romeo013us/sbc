'use strict';
// Broad inventory only: a static source scan cannot prove actual click behavior.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||process.argv[2]||'.sbc-isolated-runtime');
const pub=path.join(root,'public');
const browser=path.join(root,'browser_public');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?files(path.join(dir,x.name)):x.isFile()?[path.join(dir,x.name)]:[]);}
const sources=[path.join(pub,'index.html'),...files(pub).filter(x=>x.endsWith('.js')&&!x.includes('/vendor/'))];
const summary={status:'STATIC_ONLY_NOT_LIVE_CERTIFIED',buttonMarkupOccurrences:0,interactiveMarkupWithInlineHandler:0,inlineHandlerNames:[],primaryNavRoutes:[],popupFragments:0,localAssetUrls:0,missingReferencedAssets:[],suspectEmptyLinks:[],apparentUnboundInlineHandlers:[],compiledBrowserMirrorsConsistent:false,countsByFile:[]};
const functions=new Set();const inline=new Map();const routes=new Set();const hrefs=[];
const assets=[];
for(const filename of sources){
 const rel=path.relative(pub,filename);const text=fs.readFileSync(filename,'utf8');
 const buttons=[...text.matchAll(/<button\b[^>]*>/gi)];
 const inlineMatches=[...text.matchAll(/onclick\s*=\s*(?:\\?['"])([^'"\\]{1,220})(?:\\?['"])/g)];
 summary.buttonMarkupOccurrences+=buttons.length;summary.interactiveMarkupWithInlineHandler+=inlineMatches.length;
 summary.popupFragments+=(text.match(/(?:openModal\s*\(|role=["']dialog["']|class=["'][^"']*modal)/gi)||[]).length;
 for(const m of inlineMatches){const name=m[1].match(/^(?:return\s+)?(?:window\.)?([a-zA-Z_$][\w$]*)\s*(?:\?\.)?\s*\(/)?.[1];if(name)inline.set(name,(inline.get(name)||0)+1)}
 for(const m of text.matchAll(/(?:window\.)?([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g))functions.add(m[1]);
 for(const m of text.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g))functions.add(m[1]);
 for(const m of text.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g))functions.add(m[1]);
 for(const m of text.matchAll(/data-view=["']([^"']+)["']/g))routes.add(m[1]);
 if(rel==='index.html'){
  for(const m of text.matchAll(/(?:src|href)=["'](\/[^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi))assets.push(m[1]);
 }
 for(const m of text.matchAll(/<a\b[^>]*href\s*=\s*['"]([^'"]*)['"]/gi))hrefs.push({file:rel,href:m[1]});
 summary.countsByFile.push({file:rel,buttons:buttons.length,inline: inlineMatches.length});
}
summary.inlineHandlerNames=[...inline.keys()].sort();summary.primaryNavRoutes=[...routes].sort();
summary.localAssetUrls=assets.length;
summary.missingReferencedAssets=assets.filter(a=>!fs.existsSync(path.join(pub,a.slice(1).split('?')[0])));
summary.suspectEmptyLinks=hrefs.filter(x=>!x.href||x.href==='#'||/^javascript:/i.test(x.href)).slice(0,100);
summary.apparentUnboundInlineHandlers=[...inline].filter(([name])=>!functions.has(name)&&!['alert','print','confirm','prompt','setTimeout','event'].includes(name)).map(([name,occurrences])=>({name,occurrences}));
summary.compiledBrowserMirrorsConsistent=['fantastic4-launch-os.js','sbc-critical-surfaces-guardian-v56-25-3.js'].every(n=>fs.readFileSync(path.join(pub,n),'utf8')===fs.readFileSync(path.join(browser,n),'utf8'));
assert.ok(summary.buttonMarkupOccurrences>100,'SBC markup incomplete');
assert.ok(summary.primaryNavRoutes.length>=20,'Missing major navigation views');
assert.ok(summary.popupFragments>0,'Popup/modal markup removed');
assert.deepEqual(summary.missingReferencedAssets,[],'Broken local asset URLs');
assert.equal(summary.compiledBrowserMirrorsConsistent,true,'Browser mirror mismatch');
assert.ok(summary.inlineHandlerNames.includes('f4RevenueVerify')&&summary.inlineHandlerNames.includes('f4RevenueRefresh'));
assert.ok(!summary.apparentUnboundInlineHandlers.some(x=>['f4RevenueVerify','f4RevenueRefresh'].includes(x.name)),'Critical owner action not bound');
console.log(JSON.stringify(summary,null,2));