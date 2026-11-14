'use strict';
// Static UI audit: every asset reference resolves, every inline handler is defined,
// and every /api/... path the frontend calls has a matching server route.
// Static analysis only: it does NOT replace a real browser test.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),pub=path.join(root,'public');
const read=f=>fs.readFileSync(f,'utf8');
const html=read(path.join(pub,'index.html'));
const readModules=dir=>fs.existsSync(dir)
  ? fs.readdirSync(dir).filter(f=>/\.(?:c?js)$/.test(f)).map(f=>read(path.join(dir,f)))
  : [];
// The shipping GoDaddy build patches the pinned server in an isolated stage.
// Audit that exact deterministic patch rather than pretending its API route
// exists in the untouched/pinned source server.js.
const canonicalServer=read(path.join(root,'server.js'));
const hrStage=require('./v66149-stage-hr-workstation.cjs');
const stagedServer=hrStage.patchServer(canonicalServer);
if(!stagedServer.includes(hrStage.MARK))throw Error('HR_ROUTE_ABSENT_IN_STAGED_AUDIT');
const srv=[stagedServer,...readModules(path.join(root,'routes'))].join('\n');
const routes=[...srv.matchAll(/\b(?:app|router)\.(?:get|post|put|patch|delete|all|use)\(\s*['"`]([^'"`]+)['"`]/g)].map(m=>m[1]);
// Registered feature routers build absolute API paths from a constant prefix and
// typed relative routes. Resolve ONLY declarations actually present in the source;
// don't turn off validation or create a blanket static-audit allowlist.
for(const file of ['sbc-account-social-v1.cjs','sbc-lorna-handoff-v1.cjs']){
 const absolute=path.join(root,'routes',file);
 if(!fs.existsSync(absolute))continue;
 const src=read(absolute);
 const prefix=src.match(/const\s+(?:PATH|BASE)\s*=\s*['"](\/api\/[^'"]+)['"]/);
 if(!prefix)continue;
 for(const match of src.matchAll(/\broute\(\s*['"](?:get|post|put|patch|delete)['"]\s*,\s*['"](\/[^'"]+)['"]/g)){
  routes.push(prefix[1]+match[1]);
 }
}
const toRe=r=>new RegExp('^'+r.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/:[A-Za-z_]+/g,'[^/]+').replace(/\*/g,'.*')+'/?$');
// Catch-all routes (containing '*' or mounted at '/') would make EVERY path look valid, so they are excluded.
const specific=routes.filter(r=>!r.includes('*')&&r!=='/'&&r!=='/api');
const reList=specific.map(toRe);
const isRoute=u=>reList.some(r=>r.test(u)||r.test(u+'/x'));
let bad=0;const fail=m=>{bad++;console.log('FAIL',m)};
const refs=[...new Set([...html.matchAll(/(?:src|href)=["']([^"'#]+?)["']/g)].map(m=>m[1]).filter(u=>!/^(https?:|\/\/|data:|mailto:|tel:|javascript:)/.test(u)))];
for(const u of refs){const p=u.split('?')[0].replace(/^\//,'');if(!fs.existsSync(path.join(pub,p))&&!isRoute('/'+p))fail('asset not found and not a server route: '+u)}
const files=refs.filter(u=>/\.js(\?|$)/.test(u)).map(u=>path.join(pub,u.split('?')[0].replace(/^\//,''))).filter(f=>fs.existsSync(f));
const js=files.map(read).join('\n')+'\n'+[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const handlers=new Set();
for(const m of html.matchAll(/\bon(?:click|change|submit|input|keydown|keyup)=["']([^"']+)["']/g))for(const c of m[1].matchAll(/([A-Za-z_$][\w$.]*)\s*\(/g)){const n=c[1];if(!/^(if|return|function|event|this|window\.event|alert|confirm|prompt|setTimeout|document\.|Math\.|JSON\.|console\.)/.test(n))handlers.add(n.replace(/^window\./,''))}
for(const n of handlers){const b=n.split('.')[0];if(!new RegExp('(function\\s+'+b+'\\b|window\\.'+b+'\\s*=|\\b'+b+'\\s*=\\s*(?:async\\s*)?(?:function|\\()|(?:const|let|var)\\s+'+b+'\\b|window\\[[\'"]'+b+'[\'"]\\]\\s*=)').test(js))fail('inline handler not defined in loaded scripts: '+n)}
const allpub=fs.readdirSync(pub).filter(f=>f.endsWith('.js')).map(f=>read(path.join(pub,f))).join('\n');
const calls=new Set([...allpub.matchAll(/['"`](\/api\/[A-Za-z0-9_\/\-\.:]+)(?:\?[^'"`]*)?['"`]/g)].map(m=>m[1].replace(/\/$/,'')));
// Routes mounted through routers/enterprise modules can't be resolved purely from app.get(...) text, so an API path
// also counts as defined when its last two segments appear literally in server/routes/enterprise source (heuristic).
const entDir=path.join(root,'enterprise');
const allSrc=[srv,...readModules(entDir)].join('\n');
const apiDefined=c=>isRoute(c)||allSrc.includes(c.split('/').slice(-2).join('/'));
for(const c of calls)if(!apiDefined(c))fail('frontend calls an API path with no server route: '+c);
console.log(`UI static audit: ${refs.length} asset refs, ${handlers.size} inline handlers, ${calls.size} API paths, ${routes.length} server routes, ${bad} problems`);
process.exit(bad?1:0);
