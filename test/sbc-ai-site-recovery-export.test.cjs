'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const vault=require('../enterprise/sbc-ai-zip-proposals.cjs');
const hex=buf=>crypto.createHash('sha256').update(buf).digest('hex');

function entries(zip){
 assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50,'must be standard portable ZIP');
 const count=zip.readUInt16LE(zip.length-12),offset=zip.readUInt32LE(zip.length-6);
 const result={};let cursor=offset;
 for(let i=0;i<count;i++){
  assert.equal(zip.readUInt32LE(cursor),0x02014b50,'central directory record');
  const size=zip.readUInt32LE(cursor+20),n=zip.readUInt16LE(cursor+28);
  const name=zip.subarray(cursor+46,cursor+46+n).toString('utf8'),local=zip.readUInt32LE(cursor+42);
  const at=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28);
  result[name]=zip.subarray(at,at+size);
  cursor+=46+n+zip.readUInt16LE(cursor+30)+zip.readUInt16LE(cursor+32);
 }
 return result;
}

function makeWebsite(label){
 return vault.packStoredEntries([{name:'index.html',content:Buffer.from('<h1>'+label+'</h1>')}]);
}
function record(id,tier,bytes){
 return {id,tier,tenantId:1,customerId:'c1',createdAt:'2026-11-17T10:00:00.000Z',bytes:bytes.length,filename:'original.zip',sha256:hex(bytes)};
}
test('owner recovery archive includes every version and a checksum manifest, without discarding previous ZIPs',()=>{
 const x=makeWebsite('version one'),y=makeWebsite('version two');
 const a=record('up_'+'a'.repeat(32),199,x),b=record('up_'+'b'.repeat(32),499,y);
 const bundle=vault.buildRecoveryArchive({tenantId:1,customerId:'c1',records:[a,b],
  readOriginal:r=>r.id===a.id?x:y});
 const parsed=entries(bundle);
 assert.deepEqual(Object.keys(parsed).sort(),['manifest.json','versions/'+a.id+'.zip','versions/'+b.id+'.zip']);
 assert.deepEqual(parsed['versions/'+a.id+'.zip'],x);
 assert.deepEqual(parsed['versions/'+b.id+'.zip'],y);
 const manifest=JSON.parse(parsed['manifest.json']);
 assert.equal(manifest.schema,'sbc-customer-website-backup-v1');
 assert.equal(manifest.customerId,'c1');
 assert.equal(manifest.versions.length,2);
 assert.equal(manifest.versions[0].sha256,hex(x));
 assert.equal(manifest.versions[1].sha256,hex(y));
 assert(!JSON.stringify(manifest).includes('hostingPassword'));
});

test('missing original, tampering, malformed records, and size overflow fail closed rather than issue a partial backup',()=>{
 const x=makeWebsite('verified'),a=record('up_'+'a'.repeat(32),199,x);
 const options={tenantId:1,customerId:'c1',records:[a]};
 assert.throws(()=>vault.buildRecoveryArchive({...options,readOriginal:()=>{throw Error('ENOENT')}}),/BACKUP_MISSING_FILE/);
 assert.throws(()=>vault.buildRecoveryArchive({...options,readOriginal:()=>Buffer.from('corrupted')}),/BACKUP_INTEGRITY_FAILED/);
 assert.throws(()=>vault.buildRecoveryArchive({...options,records:[a,a],readOriginal:()=>x}),/BACKUP_DUPLICATE_VERSION/);
 assert.throws(()=>vault.buildRecoveryArchive({...options,records:[{...a,id:'../../escape'}],readOriginal:()=>x}),/BACKUP_INVALID_VERSION/);
 assert.throws(()=>vault.buildRecoveryArchive({...options,readOriginal:()=>x,maxBytes:10}),/BACKUP_TOO_LARGE/);
 assert.throws(()=>vault.buildRecoveryArchive({...options,records:[],readOriginal:()=>x}),/BACKUP_NO_VERSIONS/);
});

test('legacy version without stored hash can export safely after validating its original ZIP',()=>{
 const x=makeWebsite('old stored ZIP'),a=record('up_'+'c'.repeat(32),799,x);delete a.sha256;
 const bundle=vault.buildRecoveryArchive({tenantId:1,customerId:'c1',records:[a],readOriginal:()=>x});
 const parsed=entries(bundle);
 assert.deepEqual(parsed['versions/'+a.id+'.zip'],x);
 assert.equal(JSON.parse(parsed['manifest.json']).versions[0].sha256,hex(x));
});

test('owner recovery route exports only current customer and does not require new writes or a working writer',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-archive-test-'));const prefix='/api/website-production/customers/:id/ai-proposals';
 const zip=makeWebsite('tenant one'),id='up_'+'d'.repeat(32),r=record(id,199,zip);
 const dir=path.join(root,'1','c1',id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'original.zip'),zip);
 const store={aiSiteUploads:[r]},routes={},db={customers:[{id:'c1',tenantId:1},{id:'c1',tenantId:2}]};
 const app={routes,get(p,...handlers){this.routes[p]=handlers},post(){}};
 vault.register(app,{auth:(req,res,next)=>req.user?next():res.status(401).json({ok:false}),
  ownerOnly:(req,res,next)=>req.user.role==='owner'?next():res.status(403).json({ok:false}),
  requireTenant:req=>req.tenantId,db,getStore:()=>store,saveStore:async()=>{throw Error('must not write')},
  writerReady:()=>false,serializeSiteMutation:fn=>fn(),storageRoot:root});
 async function reqCall(tenantId,role){
  const handlers=app.routes[prefix+'/uploads/recovery/export'],req={params:{id:'c1'},tenantId,user:role?{role}:null};
  const res={statusCode:200,headers:{},status(n){this.statusCode=n;return this},json(x){this.body=x;return this},setHeader(k,v){this.headers[k]=v},
   end(buf){this.file=buf;return this}};
  for(const mw of handlers.slice(0,-1)){let passed=false;mw(req,res,()=>{passed=true});if(!passed)return res;}
  await handlers.at(-1)(req,res);return res;
 }
 try{
  assert.equal((await reqCall(1,'lead_researcher')).statusCode,403);
  assert.equal((await reqCall(1,null)).statusCode,401);
  assert.equal((await reqCall(2,'owner')).statusCode,404);
  const result=await reqCall(1,'owner');
  assert.equal(result.statusCode,200,JSON.stringify(result.body));
  assert.match(result.headers['Content-Type'],/application\/zip/);
  assert.match(result.headers['Content-Disposition'],/attachment/);
  assert.deepEqual(entries(result.file)['versions/'+id+'.zip'],zip);
  assert.equal(store.aiSiteUploads.length,1);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test('simple customer screen gives the owner a download for portable recovery archive',()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','public/sbc-ai-site-handoff-v1.js'),'utf8');
 assert.match(source,/Download customer website backup/);
 assert.match(source,/uploads\/recovery\/export/);
 assert.match(source,/Original ZIP versions/);
 assert.equal(source,fs.readFileSync(path.join(__dirname,'..','browser_public/sbc-ai-site-handoff-v1.js'),'utf8'));
});
