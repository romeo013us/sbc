'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {compile,verify,COMPONENTS}=require('../scripts/v66-owner-ui-css-bundle.cjs');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const cssLinks=html=>[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(m=>m[0]);
const cssHref=link=>/href="([^"]+)"/.exec(link)?.[1]||'';
test('the owner dashboard uses ONE content-addressed CSS bundle instead of SIX late stylesheets',()=>{
 for(const base of ['public','browser_public']){
  const html=read(base+'/index.html');
  const links=cssLinks(html);
  assert.equal(links.length,6,'Expected the five verified owner stylesheets plus one focused-workspace stylesheet');
  assert.equal(links.filter(x=>x.includes('/sbc-command-center-focus-v1.css?')).length,1,'Focused workspace CSS must load once');
  const last=links.at(-1);
  assert.match(last,/sbc-v66-owner-ui-core\.[a-f0-9]{16}\.css/);
  assert.match(last,/data-sbc-contrast-rescue="global"/);
  assert.match(last,/data-sbc-executive-ui="global"/);
  assert.match(last,/data-sbc-website-spotlight="true"/);
  assert.match(last,/data-sbc-website-contrast="scoped"/);
  for(const file of COMPONENTS)assert(!html.includes('href="/'+file),'Old stylesheet still being loaded: '+file);
  const names=[...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*>/g)].map(m=>m[1]);
  assert(names.length<=107,'No further synchronous/legacy frontend JS bloat until verified bundling');
 }
});
test('owner CSS bundle is an exact, ordered, deterministic copy of source rules with source integrity checked',()=>{
 const {filename,content,hash}=compile(root);
 assert.equal(hash.length,64);
 assert.equal(filename,'sbc-v66-owner-ui-core.'+hash.slice(0,16)+'.css');
 for(const base of ['public','browser_public']){
  assert.equal(read(base+'/'+filename),content);
  const html=read(base+'/index.html');
  assert(html.includes('/'+filename));
 }
 const result=verify(root);
 assert.equal(result.components,6);
 assert.equal(result.stylesheetRequestsSaved,5);
 assert.equal(result.bundleSha256,hash);
 const positions=COMPONENTS.map(x=>content.indexOf('/* '+x+' */'));
 assert(positions.every(x=>x>=0),'Source filenames must annotate bundle boundaries');
 assert(positions.every((x,i)=>i===0||x>positions[i-1]),'CSS cascade must keep exact original order');
});
test('bundling preserves all protected UI components and reduced-motion support',()=>{
 const {content}=compile(root);
 for(const selector of ['#sbcManualDialer','#sbcOwnerStaffLauncher','sbc-website-production-nav','.sbc-factory-light-panel','sbc-factory-meeting-label','sbc-nav-group']){
  assert(content.includes(selector),'Missing working feature styles: '+selector);
 }
 assert.match(content,/prefers-reduced-motion/);
});
test('compiler refuses nontransparent CSS transformations and detects stale mirrored bundle',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v66-css-'));
 try{
  for(const base of ['public','browser_public'])fs.mkdirSync(path.join(tmp,base));
  for(const file of COMPONENTS)fs.copyFileSync(path.join(root,'public',file),path.join(tmp,'public',file));
  const {filename,content}=compile(tmp);
  for(const base of ['public','browser_public']){
   fs.writeFileSync(path.join(tmp,base,filename),content);
   fs.writeFileSync(path.join(tmp,base,'index.html'),'<link rel="stylesheet" href="/'+filename+'">');
  }
  assert.doesNotThrow(()=>verify(tmp,{checkIndex:false}));
  fs.appendFileSync(path.join(tmp,'public',COMPONENTS[0]),'\n#integrity-test{color:red}');
  assert.throws(()=>verify(tmp,{checkIndex:false}),/stale|checksum|mismatch/i);
  fs.appendFileSync(path.join(tmp,'public',COMPONENTS[0]),'\n@import url("https://example.com/unsafe.css");');
  assert.throws(()=>compile(tmp),/import|url|unsupported/i);
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});
