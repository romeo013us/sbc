'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Readable}=require('node:stream');
const {deflateRawSync}=require('node:zlib');
const vault=require('../enterprise/sbc-ai-zip-proposals.cjs');
const {register,parseZip}=vault;
function crc32(buf){
 let c=~0;
 for(const b of buf){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}
 return (~c)>>>0;
}
function zip(files,method=0){
 let entries=[],directory=[],offset=0;
 for(const [name,value] of Object.entries(files)){
  const data=Buffer.from(value),payload=method===8?deflateRawSync(data):data,label=Buffer.from(name),crc=crc32(data),head=Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50,0);head.writeUInt16LE(20,4);head.writeUInt16LE(0,6);
  head.writeUInt16LE(method,8);head.writeUInt32LE(crc,14);
  head.writeUInt32LE(payload.length,18);head.writeUInt32LE(data.length,22);head.writeUInt16LE(label.length,26);
  entries.push(head,label,payload);
  const cd=Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50,0);cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);
  cd.writeUInt16LE(method,10);cd.writeUInt32LE(crc,16);cd.writeUInt32LE(payload.length,20);cd.writeUInt32LE(data.length,24);
  cd.writeUInt16LE(label.length,28);cd.writeUInt32LE(offset,42);
  directory.push(cd,label);
  offset+=head.length+label.length+payload.length;
 }
 const cdir=Buffer.concat(directory),end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);
 end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);
 end.writeUInt32LE(cdir.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...entries,cdir,end]);
}
function fixture(){
 const storageRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-zip-proposal-'));
 let state={aiSiteUploads:[]},writer=true;
 const db={customers:[{id:'a1',tenantId:1},{id:'b1',tenantId:2}]};
 const routes={};
 const app={get:(url,...handlers)=>{routes['GET '+url]=handlers},post:(url,...handlers)=>{routes['POST '+url]=handlers}};
 const auth=(req,res,next)=>req.user?next():res.status(401).json({ok:false,code:'LOGIN_REQUIRED'});
 const ownerOnly=(req,res,next)=>req.user?.role==='owner'?next():res.status(403).json({ok:false,code:'OWNER_REQUIRED'});
 register(app,{auth,ownerOnly,requireTenant:req=>req.tenantId,db,
  getStore:()=>state,saveStore:async next=>{state=next;return {ok:true}},
  writerReady:()=>writer,serializeSiteMutation:fn=>fn(),storageRoot});
 const url='/api/website-production/customers/:id/ai-proposals';
 async function call(method,suffix,{customerId='a1',tenantId=1,role='owner',tier,uploadId,ticket,rest,buf,origin='https://command.example'}={}){
  const key=method+' '+url+suffix,handlers=routes[key];
  assert(handlers,'route missing: '+key);
  const req=Readable.from(buf?[buf]:[]),headers={'content-type':'application/zip','x-sbc-proposal-upload':'1',host:'command.example',origin};
  Object.assign(req,{params:{id:customerId,tier,uploadId,ticket,0:rest},tenantId,headers,user:role?{role,id:'test-owner'}:null,secure:true});
  const res={statusCode:200,headers:{},status(code){this.statusCode=code;return this},
   setHeader(k,v){this.headers[k]=v},json(body){this.body=body;return this},
   sendFile(filename){this.file=fs.readFileSync(filename);return this}};
  for(const middleware of handlers.slice(0,-1)){
   let nextCalled=false;
   await middleware(req,res,()=>{nextCalled=true});
   if(!nextCalled)return res;
  }
  await handlers.at(-1)(req,res);
  return res;
 }
 return {call,url,root:storageRoot,state:()=>state,setWriter:v=>{writer=v},cleanup:()=>fs.rmSync(storageRoot,{recursive:true,force:true})};
}
test('ZIP parser accepts site assets but does not expose ZIP-bundled test executables',()=>{
 const archive=zip({'README.md':'documentation','index.html':'<html>Hi</html>','assets/style.css':'body{}','tests/test_site.py':'print(1)'});
 const parsed=parseZip(archive);
 const compressed=parseZip(zip({'index.html':'<html>Compressed proposal</html>','assets/style.css':'body {font:inherit}'},8));
 assert.equal(compressed.files[0].content.toString(),'<html>Compressed proposal</html>');
 assert.deepEqual(parsed.files.map(x=>x.name),['index.html','assets/style.css']);
 assert.equal(parsed.files[0].content.toString(),'<html>Hi</html>');
});
test('ZIP parser blocks traversal, missing index, duplicate entries and malformed headers',()=>{
 assert.throws(()=>parseZip(zip({'../index.html':'escape'})),/ZIP_UNSAFE_PATH/);
 assert.throws(()=>parseZip(zip({'README.md':'no homepage'})),/ZIP_INDEX_HTML_REQUIRED/);
 assert.throws(()=>parseZip(zip({'index.html':'ok','evil/../../oops.css':'bad'})),/ZIP_UNSAFE_PATH/);
 assert.throws(()=>parseZip(Buffer.from('not a zip')),/ZIP_SIZE_INVALID/);
 const damaged=zip({'index.html':'valid contents'});
 damaged[40]^=0x01; // corrupt stored content, retaining the original central-directory CRC
 assert.throws(()=>parseZip(damaged),/ZIP_CRC_MISMATCH/);
});
test('upload once, preview and download from the correct owner-only customer account',async()=>{
 const f=fixture();
 try{
  const file=zip({'index.html':'<html><link rel="stylesheet" href="assets/style.css">Proposal</html>','assets/style.css':'body {color:#123}'});
  const put=await f.call('POST','/uploads/:tier',{tier:'199',buf:file});
  assert.equal(put.statusCode,201,JSON.stringify(put.body));assert.equal(put.body.durable,true);
  const id=put.body.upload.id;
  const list=await f.call('GET','/uploads');
  assert.equal(list.body.uploads.length,1);assert.equal(list.body.uploads[0].tier,199);
  assert.match(list.body.uploads[0].previewPath,/\/render\/[A-Za-z0-9_-]{43}\/index.html$/);
  const ticket=list.body.uploads[0].previewPath.match(/\/render\/([^/]+)\/index.html$/)[1];
  // Root cause regression: isolated iframe requests do not carry owner cookies.
  // The old route requires auth, but a minted grant can serve the real site,
  // CSS, JS and navigation without weakening any other account endpoint.
  assert.equal((await f.call('GET','/uploads/:uploadId/preview/*',{uploadId:id,rest:'assets/style.css',role:null})).statusCode,401);
  const sandboxPage=await f.call('GET','/uploads/:uploadId/render/:ticket/*',{uploadId:id,ticket,rest:'index.html',role:null});
  assert.equal(sandboxPage.statusCode,200);
  assert.equal(sandboxPage.headers['Content-Type'],'text/html; charset=utf-8');
  assert.match(sandboxPage.headers['Content-Security-Policy'],/sandbox allow-scripts/);
  assert.match(sandboxPage.headers['Content-Security-Policy'],/form-action 'none'/);
  assert.equal(sandboxPage.headers['Cache-Control'],'private, no-store');
  const sandboxCss=await f.call('GET','/uploads/:uploadId/render/:ticket/*',{uploadId:id,ticket,rest:'assets/style.css',role:null});
  assert.equal(sandboxCss.statusCode,200);
  assert.equal(sandboxCss.headers['Content-Type'],'text/css; charset=utf-8');
  assert.equal(sandboxCss.headers['Access-Control-Allow-Origin'],'*');
  assert.equal(sandboxCss.file.toString(),'body {color:#123}');
  const wrongToken=await f.call('GET','/uploads/:uploadId/render/:ticket/*',{uploadId:id,ticket:'A'.repeat(43),rest:'index.html',role:null});
  assert.equal(wrongToken.statusCode,403);
  const otherCustomer=await f.call('GET','/uploads/:uploadId/render/:ticket/*',{customerId:'b1',uploadId:id,ticket,rest:'index.html',role:null});
  assert.equal(otherCustomer.statusCode,403);
  const otherUpload=await f.call('GET','/uploads/:uploadId/render/:ticket/*',{uploadId:'up_'+'0'.repeat(32),ticket,rest:'index.html',role:null});
  assert.equal(otherUpload.statusCode,403);
  const traversal=await f.call('GET','/uploads/:uploadId/render/:ticket/*',{uploadId:id,ticket,rest:'../original.zip',role:null});
  assert.equal(traversal.statusCode,400);
  const preview=await f.call('GET','/uploads/:uploadId/preview/*',{uploadId:id,rest:'index.html'});
  assert.equal(preview.file.toString().includes('Proposal'),true);
  assert.match(preview.headers['Content-Security-Policy'],/sandbox allow-scripts/);
  assert.match(preview.headers['Content-Security-Policy'],/form-action 'none'/);
  const css=await f.call('GET','/uploads/:uploadId/preview/*',{uploadId:id,rest:'assets/style.css'});
  assert.equal(css.headers['Content-Type'],'text/css; charset=utf-8');
  const dl=await f.call('GET','/uploads/:uploadId/download',{uploadId:id});
  assert.deepEqual(dl.file,file);
  assert.equal((await f.call('GET','/uploads',{role:'caller'})).statusCode,403);
  assert.equal((await f.call('GET','/uploads',{role:null})).statusCode,401);
  assert.equal((await f.call('GET','/uploads',{customerId:'b1',tenantId:1})).statusCode,404);
  assert.equal((await f.call('GET','/uploads/:uploadId/preview/*',{uploadId:id,rest:'../index.html'})).statusCode,400);
 }finally{f.cleanup()}
});
test('tiers and historical uploads stay distinct without changing CRM records',async()=>{
 const f=fixture();
 try{
  for(const tier of [199,499,799,999,199]){
   const r=await f.call('POST','/uploads/:tier',{tier:String(tier),buf:zip({'index.html':'<h1>'+tier+'</h1>'})});
   assert.equal(r.statusCode,201,JSON.stringify(r.body));
  }
  const list=await f.call('GET','/uploads');
  assert.deepEqual(list.body.uploads.map(x=>x.tier).sort(),[199,199,499,799,999]);
  assert.equal(f.state().aiSiteUploads.length,5);
  assert.equal(Object.keys(f.state()).length,1);
 }finally{f.cleanup()}
});
test('rejects invalid inputs and a read-only writer without creating saved uploads',async()=>{
 const f=fixture();
 try{
  const valid=zip({'index.html':'<html>hi</html>'});
  assert.equal((await f.call('POST','/uploads/:tier',{tier:'1000',buf:valid})).statusCode,400);
  assert.equal((await f.call('POST','/uploads/:tier',{tier:'199',buf:valid,origin:'https://attacker.example'})).statusCode,403);
  assert.equal((await f.call('POST','/uploads/:tier',{tier:'199',buf:zip({'../index.html':'bad'})})).statusCode,400);
  f.setWriter(false);
  assert.equal((await f.call('POST','/uploads/:tier',{tier:'199',buf:valid})).statusCode,423);
  assert.equal((await f.call('GET','/uploads')).body.uploads.length,0);
 }finally{f.cleanup()}
});
test('owner proposal UI and global contrast layers remain mirrored for deployment',()=>{
 const root=path.join(__dirname,'..');
 for(const asset of ['sbc-ai-site-handoff-v1.js','sbc-command-center-focus-v1.css']){
  assert.equal(fs.readFileSync(path.join(root,'public',asset),'utf8'),fs.readFileSync(path.join(root,'browser_public',asset),'utf8'));
 }
 const ui=fs.readFileSync(path.join(root,'public/sbc-ai-site-handoff-v1.js'),'utf8');
 assert.match(ui,/Upload &amp; save proposal/);
 assert.match(ui,/id:999,title:'Growth/,'Growth package must be selectable in owner UI');
 assert.match(ui,/fetch\(base\+'\/uploads\/'\+tier/);
 assert.match(ui,/sandbox="allow-scripts"/);
 const css=fs.readFileSync(path.join(root,'public/sbc-command-center-focus-v1.css'),'utf8');
 assert.match(css,/#sbcAiDesk/);
 assert.match(css,/body\[data-theme="dark"\] #modal/);
 assert.match(css,/:focus-visible/);
});

test('new ZIP versions save a persistent preview QA summary without affecting earlier proposals',async()=>{
 const f=fixture();
 try{
  const first=await f.call('POST','/uploads/:tier',{tier:'199',
   buf:zip({'index.html':'<link rel="stylesheet" href="missing.css"><h1>Client draft</h1>'})});
  assert.equal(first.statusCode,201,JSON.stringify(first.body));
  assert.equal(first.body.upload.previewAudit.status,'PREVIEW_LINKS_NEED_REVIEW');
  assert.equal(first.body.upload.previewAudit.issueCount,1);
  const second=await f.call('POST','/uploads/:tier',{tier:'199',
   buf:zip({'index.html':'<h1>Fixed draft</h1>'})});
  assert.equal(second.statusCode,201);
  assert.equal(second.body.upload.previewAudit.status,'PREVIEW_LINKS_OK');
  const list=await f.call('GET','/uploads');
  assert.equal(list.body.uploads.length,2);
  assert.equal(list.body.uploads[0].previewAudit.status,'PREVIEW_LINKS_OK');
  assert.equal(list.body.uploads[1].previewAudit.status,'PREVIEW_LINKS_NEED_REVIEW');
  assert.equal(f.state().aiSiteUploads.length,2);
 }finally{f.cleanup()}
});

test('latest saved website version remains first even when two uploads share the same timestamp',async()=>{
 const f=fixture();
 try{
  const one=await f.call('POST','/uploads/:tier',{tier:'199',buf:zip({'index.html':'<h1>First draft</h1>'})});
  const two=await f.call('POST','/uploads/:tier',{tier:'199',buf:zip({'index.html':'<h1>Later draft</h1>'})});
  assert.equal(one.statusCode,201);assert.equal(two.statusCode,201);
  f.state().aiSiteUploads.forEach(x=>x.createdAt='2026-11-17T10:00:00.000Z');
  const list=await f.call('GET','/uploads');
  assert.equal(list.body.uploads[0].id,two.body.upload.id,'last persisted proposal must be latest on ties');
  assert.equal(list.body.uploads[1].id,one.body.upload.id);
 }finally{f.cleanup()}
});

test('owner browser preview refreshes a short-lived ZIP token rather than reusing an expired iframe URL',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../public/sbc-ai-site-handoff-v1.js'),'utf8');
 assert.match(src,/async function preview\(url,tier,renew=false\)/);
 assert.match(src,/serviceApi\(base\+'\/uploads'\)/);
 assert.match(src,/preview\(b\.dataset\.sbcAiPreview,Number\(b\.dataset\.tier\),true\)/);
 assert.match(src,/sandbox="allow-scripts"/);
 assert.doesNotMatch(src,/allow-same-origin/);
});
