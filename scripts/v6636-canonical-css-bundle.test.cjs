'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {apply}=require('../hotfix-assets/apply-v6636-canonical-shell-css-bundle.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6636-'));
try{
 const pub=path.join(root,'public'),mirror=path.join(root,'browser_public');
 fs.mkdirSync(pub,{recursive:true});fs.mkdirSync(mirror,{recursive:true});
 const sourceStyles=Array.from({length:67},(_,i)=>({
  name:'style-'+i+'.css',content:'.sbc-card{padding:'+i+'px}\n@media(max-width:600px){.sbc-card{margin:'+i+'px}}\n'
 }));
 for(const s of sourceStyles)fs.writeFileSync(path.join(pub,s.name),s.content);
 const html='<!doctype html><html><head>'+sourceStyles.map(x=>'<link rel="stylesheet" href="/'+x.name+'?v=old">').join('\n')+
  '</head><body><script src="/app.js?v=old"></script><div class="sbc-card">Sales</div></body></html>';
 fs.writeFileSync(path.join(pub,'index.html'),html);
 fs.writeFileSync(path.join(pub,'app.js'),'window.SBC=true;');
 fs.writeFileSync(path.join(pub,'sw.js'),"const CACHE='sbc-static-v66-35';");
 fs.writeFileSync(path.join(mirror,'index.html'),'<link rel="stylesheet" href="file:///mnt/data/war_test/browser_public/style-0.css">');
 fs.writeFileSync(path.join(mirror,'sw.js'),"const CACHE='stale';");
 const result=apply(root);
 assert.equal(result.stylesheetsBefore,67);assert.equal(result.stylesheetsAfter,1);
 for(const dir of [pub,mirror]){
  const h=fs.readFileSync(path.join(dir,'index.html'),'utf8');
  assert.equal((h.match(/rel=["']stylesheet["']/g)||[]).length,1);
  assert.doesNotMatch(h,/file:\/\/\/|sbc-lead-import-v6541/);
  const m=h.match(/href="\/(sbc-v6636-styles\.[a-f0-9]{16}\.css)"/);
  assert.ok(m);const css=fs.readFileSync(path.join(dir,m[1]),'utf8');
  assert.equal((css.match(/\/\* source /g)||[]).length,67);
  assert.equal(crypto.createHash('sha256').update(css).digest('hex'),result.canonicalAssetHash);
  assert.equal((css.match(/\.sbc-card/g)||[]).length,134);
  assert.match(fs.readFileSync(path.join(dir,'sw.js'),'utf8'),/v66-36-canonical-shell/);
  assert.ok(fs.existsSync(path.join(dir,'app.js')));
 }
 assert.equal(fs.readFileSync(path.join(pub,'index.html'),'utf8'),fs.readFileSync(path.join(mirror,'index.html'),'utf8'));
 assert.throws(()=>apply(root),/already applied/);
 console.log('V6636 CSS consolidation 67=>1, canonical browser mirror, immutable filename hash, original order PASS');
}finally{fs.rmSync(root,{recursive:true,force:true})}