'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Readable}=require('node:stream');
const vault=require('../enterprise/sbc-ai-zip-proposals.cjs');
const {register,parseZip}=vault;
function crc32(buf){
 let c=~0;
 for(const b of buf){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}
 return (~c)>>>0;
}
function zip(files){
 let entries=[],directory=[],offset=0;
 for(const [name,value] of Object.entries(files)){
  const data=Buffer.from(value),label=Buffer.from(name),crc=crc32(data),head=Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50,0);head.writeUInt16LE(20,4);head.writeUInt16LE(0,6);
  head.writeUInt16LE(0,8);head.writeUInt32LE(crc,14);
  head.writeUInt32LE(data.length,18);head.writeUInt32LE(data.length,22);head.writeUInt16LE(label.length,26);
  entries.push(head,label,data);
  const cd=Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50,0);cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);
  cd.writeUInt32LE(crc,16);cd.writeUInt32LE(data.length,20);cd.writeUInt32LE(data.length,24);
  cd.writeUInt16LE(label.length,28);cd.writeUInt32LE(offset,42);
  directory.push(cd,label);
  offset+=head.length+label.length+data.length;
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
 async function call(method,suffix,{customerId='a1',tenantId=1,role='owner',tier,uploadId,rest,buf,origin='https://command.example'}={}){
  const key=method+' '+url+suffix,handlers=routes[key];
  assert(handlers,'route missing: '+key);
  const req=Readable.from(buf?[buf]:[]),headers={'content-type':'application/zip','x-sbc-proposal-upload':'1',host:'command.example',origin};
  Object.assign(req,{params:{id:customerId,tier,uploadId,0:rest},tenantId,headers,user:role?{role,id:'test-owner'}:null,secure:true});
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
 assert.deepEqual(parsed.files.map(x=>x.name),['index.html','assets/style.css']);
 assert.equal(parsed.files[0].content.toString(),'<html>Hi</html>');
});
test('ZIP parser blocks traversal, missing index, duplicate entries and malformed headers',()=>{
 assert.throws(()=>parseZip(zip({'../index.html':'escape'})),/ZIP_UNSAFE_PATH/);
 assert.throws(()=>parseZip(zip({'README.md':'no homepage'})),/ZIP_INDEX_HTML_REQUIRED/);
 assert.throws(()=>parseZip(zip({'index.html':'ok','evil/../../oops.css':'bad'})),/ZIP_UNSAFE_PATH/);
 assert.throws(()=>parseZip(Buffer.from('not a zip')),/ZIP_SIZE_INVALID/);
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
  assert.match(list.body.uploads[0].previewPath,/\/preview\/index.html$/);
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
  for(const tier of [199,499,799,199]){
   const r=await f.call('POST','/uploads/:tier',{tier:String(tier),buf:zip({'index.html':'<h1>'+tier+'</h1>'})});
   assert.equal(r.statusCode,201,JSON.stringify(r.body));
  }
  const list=await f.call('GET','/uploads');
  assert.deepEqual(list.body.uploads.map(x=>x.tier).sort(),[199,199,499,799]);
  assert.equal(f.state().aiSiteUploads.length,4);
  assert.equal(Object.keys(f.state()).length,1);
 }finally{f.cleanup()}
});
test('rejects invalid inputs and a read-only writer without creating saved uploads',async()=>{
 const f=fixture();
 try{
  const valid=zip({'index.html':'<html>hi</html>'});
  assert.equal((await f.call('POST','/uploads/:tier',{tier:'999',buf:valid})).statusCode,400);
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
 assert.match(ui,/fetch\(base\+'\/uploads\/'\+tier/);
 assert.match(ui,/sandbox="allow-scripts"/);
 const css=fs.readFileSync(path.join(root,'public/sbc-command-center-focus-v1.css'),'utf8');
 assert.match(css,/#sbcAiDesk/);
 assert.match(css,/body\[data-theme="dark"\] #modal/);
 assert.match(css,/:focus-visible/);
});
