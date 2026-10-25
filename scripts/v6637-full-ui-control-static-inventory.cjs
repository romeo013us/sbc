'use strict';
// Static-control census, not a claim that any remote action was completed.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.argv[2]||process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const pub=path.join(root,'public'),html=fs.readFileSync(path.join(pub,'index.html'),'utf8');
function walk(dir){let out=[];for(const x of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,x.name);if(x.isDirectory())out.push(...walk(p));else if(x.isFile())out.push(p);}return out;}
const js=walk(pub).filter(x=>x.endsWith('.js')&&!x.includes('/vendor/'));
const symbols=new Map(),definitions=new Set(),nav=new Set();let buttons=0,inline=0,observers=0,intervals=0;
const files=[];
for(const p of [path.join(pub,'index.html'),...js]){
 const s=fs.readFileSync(p,'utf8');
 const n=(s.match(/<button\b/gi)||[]).length;buttons+=n;
 for(const m of s.matchAll(/onclick\\?=\s*["']([A-Za-z_$][\w.$]*)\s*\(/gi)){symbols.set(m[1],(symbols.get(m[1])||0)+1);inline++;}
 for(const m of s.matchAll(/data-view=["']([^"']+)["']/gi))nav.add(m[1]);
 for(const m of s.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g))definitions.add(m[1]);
 for(const m of s.matchAll(/(?:window\.)?([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g))definitions.add(m[1]);
 observers+=(s.match(/new\s+MutationObserver\s*\(/g)||[]).length;
 intervals+=(s.match(/\bsetInterval\s*\(/g)||[]).length;
 files.push({file:path.relative(pub,p),bytes:fs.statSync(p).size,buttons:n});
}
const unresolved=[...symbols].filter(([name])=>!definitions.has(name)&&!name.startsWith('window.')&&!name.startsWith('document.')&&!name.startsWith('this.'))
 .map(([name,references])=>({name,references,review:'static binding unresolved; test in authenticated browser'}));
const staticRefs=[...html.matchAll(/(?:src|href)=["'](\/[^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi)].map(x=>x[1]);
const missing=staticRefs.filter(u=>!fs.existsSync(path.join(pub,u.split('?')[0].slice(1))));
const sw=fs.readFileSync(path.join(pub,'sw.js'),'utf8'),mega=fs.readFileSync(path.join(pub,'mega.js'),'utf8');
const report={status:missing.length?'FAIL_MISSING_ASSET':'STATIC_INVENTORY_ONLY',
 controls:{allButtonMarkupOccurrences:buttons,inlineCallsRecognized:inline,uniqueActionNames:symbols.size,navViews:nav.size},
 runtime:{jsFiles:js.length,mutationObservers:observers,intervalCalls:intervals},
 networkOnlyServiceWorker:sw.includes('SBC_V6637_NETWORK_ONLY_NO_OFFLINE_MUTATION_REPLAY')&&!sw.includes("indexedDB.open('sbc-offline-v1'"),
 offlineWritesFailClosed:mega.includes('OFFLINE_WRITES_DISABLED')&&!mega.includes("r.sync?.register('sbc-offline-sync')"),
 unresolvedBindingCandidates:unresolved,missingAssets:missing,files,
 certification:{everyButtonClicked:false,everyRemoteActionVerified:false,allAuthenticatedViewsTested:false,liveAccessibilityVerified:false,score:'NOT_CERTIFIED'},
 note:'Static inventory is not proof of control operability or a 9.5/10 rating; live GoDaddy verification required.'};
console.log(JSON.stringify(report,null,2));
if(missing.length||!report.networkOnlyServiceWorker||!report.offlineWritesFailClosed)process.exitCode=2;