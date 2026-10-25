'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {apply,VERSION}=require('../hotfix-assets/apply-v6634-versioned-asset-cache-fix.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6634-cache-'));
const put=(rel,s)=>{const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)};
try {
 const server=String.raw`app.use(express.static(path.join(__dirname,'public'),{dotfiles:'ignore',setHeaders:(res,file)=>{if(/\.(js|css|png|jpg|jpeg|webp|svg|woff2?)$/i.test(file)&&/[?&]v=|\.[a-f0-9]{8,}\./i.test(String(res.req?.url||'')))res.setHeader('Cache-Control','public,max-age=31536000,immutable');else res.setHeader('Cache-Control','no-store') }}));`;
 put('server.js',server);
 for(const dir of ['public','browser_public']){
  const num=dir==='public'?130:12;
  const tags=Array.from({length:num},(_,i)=>(i%2?'<link rel="stylesheet" href="/sbc'+i+'.css?v=old">':'<script src="/sbc'+i+'.js?v=old"></script>')).join('\n');
  put(dir+'/index.html','<!doctype html><html><head>'+tags+'</head><body></body></html>');
  put(dir+'/sw.js',"const CACHE='sbc-static-v66-old';");
 }
 const result=apply(root);assert.equal(result.immutableOnlyForContentHashedFilenames,true);
 const serverAfter=fs.readFileSync(path.join(root,'server.js'),'utf8');
 assert.match(serverAfter,/SBC_V6634_VERSIONED_ASSET_CACHE_FIX/);
 assert.match(serverAfter,/a-f0-9\]\{12,64\}/);
 assert.doesNotMatch(serverAfter,/\/\[\?&\]v=/);
 for(const dir of ['public','browser_public']){
  const html=fs.readFileSync(path.join(root,dir,'index.html'),'utf8');
  assert.doesNotMatch(html,/\?v=old/);
  assert.match(html,new RegExp('v='+VERSION));
  assert.match(fs.readFileSync(path.join(root,dir,'sw.js'),'utf8'),/v66-34-content-revalidated/);
 }
 assert.throws(()=>apply(root),/duplicate application/);
 console.log('V6634 immutable static cache only for hashed filenames; both entrypoint URLs and SW busted PASS');
}finally {fs.rmSync(root,{recursive:true,force:true})}