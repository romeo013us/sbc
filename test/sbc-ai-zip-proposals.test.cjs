'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Readable}=require('node:stream');
const {deflateRawSync,deflateSync}=require('node:zlib');
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
 async function call(method,suffix,{customerId='a1',tenantId=1,role='owner',tier,uploadId,ticket,rest,buf,body,origin='https://command.example',selectHeader=true,editHeader=true,imageHeader=true,imagePath=null,imageMime='image/png',expectedVersion=null}={}){
  const key=method+' '+url+suffix,handlers=routes[key];
  assert(handlers,'route missing: '+key);
  const req=Readable.from(buf?[buf]:[]),headers={'content-type':'application/zip','x-sbc-proposal-upload':'1',host:'command.example',origin};
  Object.assign(req,{params:{id:customerId,tier,uploadId,ticket,0:rest},tenantId,headers:{...headers,...(selectHeader?{'x-sbc-website-version-select':'1'}:{}),...(editHeader?{'x-sbc-website-text-edit':'1'}:{}),...(imageHeader?{'x-sbc-website-image-replace':'1'}:{}),...(imagePath?{'x-sbc-image-asset':encodeURIComponent(imagePath),'x-sbc-expected-version':expectedVersion||uploadId,'content-type':imageMime}:{})},body,user:role?{role,id:'test-owner'}:null,secure:true});
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

test('owner can restore an earlier ZIP as current without changing the ZIP bytes, publishing, or cross-tenant access',async()=>{
 const f=fixture();
 try{
  const first=await f.call('POST','/uploads/:tier',{tier:'199',buf:zip({'index.html':'<h1>First</h1>'})});
  const second=await f.call('POST','/uploads/:tier',{tier:'199',buf:zip({'index.html':'<h1>Second</h1>'})});
  const oldId=first.body.upload.id,latestId=second.body.upload.id;
  let list=await f.call('GET','/uploads');
  assert.equal(list.body.uploads.find(x=>x.active).id,latestId);
  const original=fs.readFileSync(path.join(f.root,'1','a1',oldId,'original.zip'));
  const denied=await f.call('POST','/uploads/:uploadId/select',{uploadId:oldId,body:{expectedActiveId:latestId},role:'caller'});
  assert.equal(denied.statusCode,403);
  const csrf=await f.call('POST','/uploads/:uploadId/select',{uploadId:oldId,body:{expectedActiveId:latestId},selectHeader:false});
  assert.equal(csrf.statusCode,403);
  const stale=await f.call('POST','/uploads/:uploadId/select',{uploadId:oldId,body:{expectedActiveId:oldId}});
  assert.equal(stale.statusCode,409);
  const restored=await f.call('POST','/uploads/:uploadId/select',{uploadId:oldId,body:{expectedActiveId:latestId}});
  assert.equal(restored.statusCode,200,JSON.stringify(restored.body));
  assert.equal(restored.body.published,false);
  assert.equal(restored.body.durable,true);
  assert.equal(restored.body.activeId,oldId);
  list=await f.call('GET','/uploads');
  assert.equal(list.body.uploads.find(x=>x.active).id,oldId);
  assert.deepEqual(fs.readFileSync(path.join(f.root,'1','a1',oldId,'original.zip')),original);
  assert.equal(f.state().aiSiteUploads.length,2);
  const other=await f.call('POST','/uploads/:uploadId/select',{customerId:'b1',tenantId:2,uploadId:oldId,body:{expectedActiveId:oldId}});
  assert.equal(other.statusCode,404);
  const newUpload=await f.call('POST','/uploads/:tier',{tier:'199',buf:zip({'index.html':'<h1>Third</h1>'})});
  assert.equal(newUpload.statusCode,201);
  list=await f.call('GET','/uploads');
  assert.equal(list.body.uploads.find(x=>x.active).id,newUpload.body.upload.id);
 }finally{f.cleanup()}
});
test('restore refuses a tampered archived website without selecting it or losing other versions',async()=>{
 const f=fixture();
 try{
  const first=await f.call('POST','/uploads/:tier',{tier:'499',buf:zip({'index.html':'<h1>Old</h1>'})});
  const second=await f.call('POST','/uploads/:tier',{tier:'499',buf:zip({'index.html':'<h1>New</h1>'})});
  fs.writeFileSync(path.join(f.root,'1','a1',first.body.upload.id,'original.zip'),Buffer.from('tampered'));
  const result=await f.call('POST','/uploads/:uploadId/select',{uploadId:first.body.upload.id,body:{expectedActiveId:second.body.upload.id}});
  assert.equal(result.statusCode,409);
  assert.equal((await f.call('GET','/uploads')).body.uploads.find(x=>x.active).id,second.body.upload.id);
 }finally{f.cleanup()}
});

test('historical ZIP quality check is read-only, tenant-scoped and works while CRM writes are blocked',async()=>{
 const f=fixture();
 try{
  const input=zip({'index.html':'<html><h1>Details pending verification</h1><link rel="stylesheet" href="assets/site.css"></html>','assets/site.css':'body{}'});
  const saved=await f.call('POST','/uploads/:tier',{tier:'199',buf:input});
  assert.equal(saved.statusCode,201);
  const id=saved.body.upload.id;
  const stateBefore=JSON.stringify(f.state());
  f.setWriter(false);
  const result=await f.call('GET','/uploads/:uploadId/qa',{uploadId:id});
  assert.equal(result.statusCode,200,JSON.stringify(result.body));
  assert.equal(result.body.readOnly,true);
  assert.equal(result.body.published,false);
  assert.equal(result.body.previewAudit.issueCount,0);
  assert(result.body.previewAudit.deliveryReview.flags.includes('BUSINESS_FACTS_UNVERIFIED'));
  assert.equal(JSON.stringify(f.state()),stateBefore);
  assert.equal((await f.call('GET','/uploads/:uploadId/qa',{uploadId:id,role:'caller'})).statusCode,403);
  assert.equal((await f.call('GET','/uploads/:uploadId/qa',{uploadId:id,tenantId:2,customerId:'b1'})).statusCode,404);
  fs.writeFileSync(path.join(f.root,'1','a1',id,'original.zip'),Buffer.from('badzip'));
  assert.equal((await f.call('GET','/uploads/:uploadId/qa',{uploadId:id})).statusCode,409);
 }finally{f.cleanup()}
});

test('owner-only no-code text editor writes a NEW ZIP version and keeps the previous intact',async()=>{
 const f=fixture();
 try{
  const input=zip({'index.html':'<!doctype html><html><head><title>Shop</title></head><body><h1>Phil&#39;s Auto</h1><p>Details pending</p><script>window.sample=true;</script></body></html>','assets/site.css':'h1{color:red}'});
  const saved=await f.call('POST','/uploads/:tier',{tier:'199',buf:input});
  assert.equal(saved.statusCode,201);
  const id=saved.body.upload.id;
  const prior=fs.readFileSync(path.join(f.root,'1','a1',id,'original.zip'));
  const list=await f.call('GET','/uploads/:uploadId/text-fields',{uploadId:id});
  assert.equal(list.statusCode,200);
  assert.equal(list.body.current,true);
  assert.equal(list.body.readOnly,true);
  assert(list.body.fields.some(x=>x.text==="Phil's Auto"));
  assert(!JSON.stringify(list.body).includes('window.sample'));
  const line=list.body.fields.find(x=>x.text==='Details pending');
  const edit=await f.call('POST','/uploads/:uploadId/text-edit',{
   uploadId:id,body:{expectedActiveId:id,page:'index.html',nodeId:line.id,text:'Trusted & <professional>'}
  });
  assert.equal(edit.statusCode,201,JSON.stringify(edit.body));
  assert.equal(edit.body.published,false);
  assert.equal(edit.body.durable,true);
  const newId=edit.body.upload.id;
  assert.notEqual(newId,id);
  assert.equal(f.state().aiSiteUploads.length,2);
  const after=await f.call('GET','/uploads');
  assert.equal(after.body.uploads.find(x=>x.active).id,newId);
  assert.deepEqual(fs.readFileSync(path.join(f.root,'1','a1',id,'original.zip')),prior);
  const newer=await f.call('GET','/uploads/:uploadId/download',{uploadId:newId});
  const parsed=parseZip(newer.file);
  assert.match(parsed.files.find(x=>x.name==='index.html').content.toString(),/Trusted &amp; &lt;professional&gt;/);
  assert.match(parsed.files.find(x=>x.name==='index.html').content.toString(),/window.sample=true/);
  assert.equal(parsed.files.find(x=>x.name==='assets/site.css').content.toString(),'h1{color:red}');
  const stale=await f.call('POST','/uploads/:uploadId/text-edit',{
   uploadId:id,body:{expectedActiveId:id,page:'index.html',nodeId:line.id,text:'Another change'}
  });
  assert.equal(stale.statusCode,409);
 }finally{f.cleanup()}
});
test('text editing stays owner-only, same-origin, tenant-scoped and blocks stale or invalid submissions',async()=>{
 const f=fixture();
 try{
  const input=zip({'index.html':'<html><body><h1>Original headline</h1></body></html>'});
  const saved=await f.call('POST','/uploads/:tier',{tier:'499',buf:input});
  const id=saved.body.upload.id;
  const field=(await f.call('GET','/uploads/:uploadId/text-fields',{uploadId:id})).body.fields[0];
  const inputBody={expectedActiveId:id,page:'index.html',nodeId:field.id,text:'Updated headline'};
  assert.equal((await f.call('GET','/uploads/:uploadId/text-fields',{uploadId:id,role:null})).statusCode,401);
  assert.equal((await f.call('GET','/uploads/:uploadId/text-fields',{uploadId:id,role:'caller'})).statusCode,403);
  assert.equal((await f.call('POST','/uploads/:uploadId/text-edit',{uploadId:id,role:'caller',body:inputBody})).statusCode,403);
  assert.equal((await f.call('POST','/uploads/:uploadId/text-edit',{uploadId:id,editHeader:false,body:inputBody})).statusCode,403);
  assert.equal((await f.call('POST','/uploads/:uploadId/text-edit',{uploadId:id,origin:'https://evil.example',body:inputBody})).statusCode,403);
  assert.equal((await f.call('POST','/uploads/:uploadId/text-edit',{uploadId:id,tenantId:2,customerId:'b1',body:inputBody})).statusCode,404);
  assert.equal((await f.call('POST','/uploads/:uploadId/text-edit',{uploadId:id,body:{...inputBody,nodeId:'0'.repeat(32)}})).statusCode,409);
  assert.equal((await f.call('POST','/uploads/:uploadId/text-edit',{uploadId:id,body:{...inputBody,text:'x\n<script>'}})).statusCode,400);
  f.setWriter(false);
  assert.equal((await f.call('POST','/uploads/:uploadId/text-edit',{uploadId:id,body:inputBody})).statusCode,423);
  assert.equal((await f.call('GET','/uploads/:uploadId/text-fields',{uploadId:id})).statusCode,200);
  assert.equal(f.state().aiSiteUploads.length,1);
 }finally{f.cleanup()}
});

function testPng(rgb=[0,32,225]){
 const signature=Buffer.from('89504e470d0a1a0a','hex');
 function chunk(type,data){
  const label=Buffer.from(type),head=Buffer.alloc(4),crc=Buffer.alloc(4);
  head.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([label,data])));
  return Buffer.concat([head,label,data,crc]);
 }
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(1,0);ihdr.writeUInt32BE(1,4);ihdr[8]=8;ihdr[9]=2;
 return Buffer.concat([signature,chunk('IHDR',ihdr),chunk('IDAT',deflateSync(Buffer.from([0,...rgb]))),chunk('IEND',Buffer.alloc(0))]);
}
test('image picker shows only verified raster assets from one owner customer',async()=>{
 const f=fixture();
 try{
  const saved=await f.call('POST','/uploads/:tier',{tier:199,buf:zip({
   'index.html':'<html><img src="assets/car.png"></html>',
   'assets/car.png':testPng(),'assets/unsafe.svg':'<svg></svg>',
   'assets/broken.jpg':'fake image'
  })});
  assert.equal(saved.statusCode,201);
  const id=saved.body.upload.id;
  const r=await f.call('GET','/uploads/:uploadId/images',{uploadId:id});
  assert.equal(r.statusCode,200);assert.equal(r.body.readOnly,true);assert.equal(r.body.current,true);
  assert.deepEqual(r.body.images.map(x=>x.path),['assets/car.png']);
  assert.equal((await f.call('GET','/uploads/:uploadId/images',{uploadId:id,role:'caller'})).statusCode,403);
  assert.equal((await f.call('GET','/uploads/:uploadId/images',{uploadId:id,customerId:'b1',tenantId:2})).statusCode,404);
 }finally{f.cleanup()}
});
test('replacing an existing image saves new immutable ZIP and preserves original and unrelated files',async()=>{
 const f=fixture();
 try{
  const initial=testPng([200,0,0]),replacement=testPng([20,200,30]);
  const saved=await f.call('POST','/uploads/:tier',{tier:199,buf:zip({
   'index.html':'<html><head><title>Shop</title></head><body><img src="assets/car.png"></body></html>',
   'assets/car.png':initial,'assets/app.js':'window.hello=true'
  })});
  assert.equal(saved.statusCode,201);
  const id=saved.body.upload.id,before=fs.readFileSync(path.join(f.root,'1','a1',id,'original.zip'));
  const changed=await f.call('POST','/uploads/:uploadId/image-replace',{
   uploadId:id,imagePath:'assets/car.png',expectedVersion:id,buf:replacement
  });
  assert.equal(changed.statusCode,201,JSON.stringify(changed.body));
  assert.equal(changed.body.published,false);
  assert.equal(changed.body.upload.editType,'IMAGE_REPLACE');
  const newId=changed.body.upload.id;assert.notEqual(newId,id);
  assert.equal(f.state().aiSiteUploads.length,2);
  const list=await f.call('GET','/uploads');
  assert.equal(list.body.uploads.find(x=>x.active).id,newId);
  assert.deepEqual(fs.readFileSync(path.join(f.root,'1','a1',id,'original.zip')),before);
  const newer=await f.call('GET','/uploads/:uploadId/download',{uploadId:newId});
  const files=parseZip(newer.file).files;
  assert.deepEqual(files.find(x=>x.name==='assets/car.png').content,replacement);
  assert.match(files.find(x=>x.name==='assets/app.js').content.toString(),/hello=true/);
  const stale=await f.call('POST','/uploads/:uploadId/image-replace',{uploadId:id,imagePath:'assets/car.png',buf:replacement});
  assert.equal(stale.statusCode,409);
 }finally{f.cleanup()}
});
test('image replacement blocks wrong tenants, roles, unsafe formats, invalid origin and read-only writer',async()=>{
 const f=fixture();
 try{
  const initial=testPng(),replacement=testPng([10,10,10]);
  const saved=await f.call('POST','/uploads/:tier',{tier:499,buf:zip({
   'index.html':'<html><body><img src="logo.png"></body></html>','logo.png':initial
  })});
  const id=saved.body.upload.id;
  const request={uploadId:id,imagePath:'logo.png',buf:replacement};
  assert.equal((await f.call('POST','/uploads/:uploadId/image-replace',{...request,role:'caller'})).statusCode,403);
  assert.equal((await f.call('POST','/uploads/:uploadId/image-replace',{...request,imageHeader:false})).statusCode,403);
  assert.equal((await f.call('POST','/uploads/:uploadId/image-replace',{...request,origin:'https://other.example'})).statusCode,403);
  assert.equal((await f.call('POST','/uploads/:uploadId/image-replace',{...request,customerId:'b1',tenantId:2})).statusCode,404);
  assert.equal((await f.call('POST','/uploads/:uploadId/image-replace',{...request,imageMime:'image/svg+xml'})).statusCode,415);
  assert.equal((await f.call('POST','/uploads/:uploadId/image-replace',{...request,buf:Buffer.from('<script>alert(1)</script>')})).statusCode,415);
  assert.equal((await f.call('POST','/uploads/:uploadId/image-replace',{...request,buf:initial})).statusCode,409);
  assert.equal((await f.call('POST','/uploads/:uploadId/image-replace',{...request,imagePath:'../logo.png'})).statusCode,404);
  f.setWriter(false);
  assert.equal((await f.call('POST','/uploads/:uploadId/image-replace',request)).statusCode,423);
  assert.equal(f.state().aiSiteUploads.length,1);
 }finally{f.cleanup()}
});
