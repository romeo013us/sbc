'use strict';
// One-command, consistent version bump. Prevents stale version-pinned tests.
// Usage:  node scripts/release-bump.js 65.1.14 "RELEASE-NAME"            (dry run: lists changes)
//         node scripts/release-bump.js 65.1.14 "RELEASE-NAME" --apply    (writes changes)
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const [,, next, name, flag]=process.argv;
if(!/^\d+\.\d+\.\d+$/.test(next||'')){console.error('usage: node scripts/release-bump.js <x.y.z> "<NAME>" [--apply]');process.exit(2)}
const idPath=path.join(root,'config/release-identity.js');
const cur=require(idPath).RELEASE_VERSION;
if(cur===next){console.error('already at '+next);process.exit(2)}
const [maj,min,pat]=next.split('.').map(Number);
const curPatch=Number(cur.split('.')[2]);
const targets=[];
const walk=(d,exts)=>{for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory()){if(!['node_modules','legacy','assets','demo-media'].includes(f.name))walk(p,exts)}else if(exts.some(e=>f.name.endsWith(e)))targets.push(p)}};
walk(path.join(root,'scripts'),['.js']);walk(path.join(root,'public'),['.js','.html','.css']);
['package.json','VERSION'].forEach(f=>targets.push(path.join(root,f)));
const changed=[];
for(const p of targets){const s=fs.readFileSync(p,'utf8');const esc=v=>v.replace(/\./g,'\\.');let n=s.split(cur).join(next);n=n.replace(new RegExp('(patch\\s*(?::|===|==)\\s*)'+curPatch+'\\b','g'),'$1'+pat);n=n.split(esc(cur)).join(esc(next));if(n===s)continue;changed.push(path.relative(root,p));if(flag==='--apply')fs.writeFileSync(p,n)}
// authoritative identity (server.js derives BUILD_VERSION from it; history comments are never rewritten)
let id=fs.readFileSync(idPath,'utf8');
id=id.replace(/RELEASE_VERSION = '[^']*'/,`RELEASE_VERSION = '${next}'`).replace(/major:\d+,minor:\d+,patch:\d+/,`major:${maj},minor:${min},patch:${pat}`);
if(name)id=id.replace(/RELEASE_NAME = '[^']*'/,`RELEASE_NAME = '${name.replace(/'/g,'')}'`);
changed.push('config/release-identity.js');
if(flag==='--apply')fs.writeFileSync(idPath,id);
console.log((flag==='--apply'?'APPLIED':'DRY RUN')+`: ${cur} -> ${next}; ${changed.length} files`);changed.forEach(f=>console.log('  '+f));
if(flag==='--apply'){
  // The tamper-check manifest hashes package.json, server.js and index.html, so it MUST be regenerated after any bump.
  delete require.cache[require.resolve(path.join(root,'enterprise/v4341-kim-resilience-control.js'))];
  const r=require(path.join(root,'enterprise/v4341-kim-resilience-control.js'));r.integrityManifest();
  console.log('  data/sbc-integrity-manifest.json regenerated; verify:',JSON.stringify(r.verifyIntegrity()));
}
if(flag!=='--apply')console.log('Re-run with --apply, then: npm run test:all && npm run predeploy:open-gate');
