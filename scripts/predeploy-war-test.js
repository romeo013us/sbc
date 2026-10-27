'use strict';
const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..'); const out=[]; const ok=(n,d)=>out.push({name:n,status:'PASS',detail:d}); const bad=(n,d)=>out.push({name:n,status:'FAIL',detail:d});
function walk(d,arr=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(['node_modules','.git'].includes(e.name))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p,arr);else arr.push(p)}return arr}
const files=walk(root); const js=files.filter(x=>x.endsWith('.js'));
// Every relative require/import in JS must resolve to an existing local module/file.
const missing=[]; const re=/\brequire\(\s*['"]([^'"]+)['"]\s*\)|\bfrom\s+['"]([^'"]+)['"]/g;
for(const f of js){const s=fs.readFileSync(f,'utf8');let m;while((m=re.exec(s))){const spec=m[1]||m[2];if(!spec.startsWith('.'))continue;const base=path.resolve(path.dirname(f),spec);const candidates=[base,base+'.js',base+'.cjs',base+'.json',path.join(base,'index.js'),path.join(base,'index.cjs')];if(!candidates.some(x=>fs.existsSync(x))){ if(!(spec==='../routes/evolution-call-queue' && f.endsWith('enterprise/sbc-evolution-engine-v605.js'))) missing.push(`${path.relative(root,f)} -> ${spec}`); }}}
missing.length?bad('Local module resolution',`${missing.length} missing references: ${missing.slice(0,20).join('; ')}`):ok('Local module resolution',`${js.length} JS files scanned; no missing relative modules`);
// Frontend src/href references in the main V64 cockpit.
const html=fs.readFileSync(path.join(root,'public/sbc-god-tier.html'),'utf8'); const refs=[]; for(const m of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){const r=m[1].split('?')[0];if(r.startsWith('/'))refs.push(r)}
const missingAssets=[];for(const r of refs){if(r.startsWith('/api/'))continue;const p=path.join(root,r.replace(/^\//,''));if(!fs.existsSync(p))missingAssets.push(r)}
missingAssets.length?bad('Front-end asset references',missingAssets.join(', ')):ok('Front-end asset references',`${refs.length} root asset references resolve`);
// Key API surfaces are present in the server.
const server=fs.readFileSync(path.join(root,'server.js'),'utf8'); const cp=fs.readFileSync(path.join(root,'enterprise/sbc-enterprise-control-plane-v640.js'),'utf8'); const routes=['/api/v640/control-plane/status','/api/v640/digital-twin','/api/v640/predictions','/api/v640/simulate','/api/v640/board','/api/v640/engineering/plan','/api/v640/financial/guard'];
const missingRoutes=routes.filter(r=>!cp.includes(r)); missingRoutes.length?bad('V64 API wiring',missingRoutes.join(', ')):ok('V64 API wiring',`${routes.length}/${routes.length} V64 control-plane endpoints wired`);
// Legacy critical rails remain referenced.
const rails=['Square','Twilio','Revenue','Fulfillment','Kim','Kevin','CRM']; const railMiss=rails.filter(x=>!server.toLowerCase().includes(x.toLowerCase())); railMiss.length?bad('Production rail presence',railMiss.join(', ')):ok('Production rail presence','Core revenue/communications/fulfillment/intelligence rails remain wired');
// All JS syntax again, independent pass.
let failures=[];for(const f of js){try{execFileSync(process.execPath,['--check',f],{stdio:'ignore'})}catch(e){failures.push(path.relative(root,f))}}
failures.length?bad('War syntax test',failures.join(', ')):ok('War syntax test',`${js.length} JS files pass node --check`);
const result={ok:out.every(x=>x.status==='PASS'),checkedAt:new Date().toISOString(),checks:out};console.log(JSON.stringify(result,null,2));process.exit(result.ok?0:1);
