'use strict';
/*
 * SBC private AI website proposal ZIP vault.
 * Authenticated owner access only; persistent data/ storage; no public hosting,
 * outbound network action, payment, customer notification or website publication.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const ROOT='/api/website-production/customers/:id/ai-proposals';
const TIERS=new Set([199,499,799]);
const ZIP_MAX=20*1024*1024, FILE_MAX=12*1024*1024, TOTAL_MAX=72*1024*1024, ENTRY_MAX=300;
const SERVE_EXT=new Set(['.html','.htm','.css','.js','.mjs','.json','.webmanifest','.svg','.png','.jpg','.jpeg','.webp','.gif','.ico','.woff','.woff2','.ttf','.txt','.xml','.avif']);
const TYPES={'.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.xml':'application/xml','.avif':'image/avif'};
const fail=(res,status,code)=>res.status(status).json({ok:false,code});
function validName(value){
 const name=String(value||'');
 if(!name||name.length>260||name.includes('\\')||name.startsWith('/')||name.includes('\0')||/^[a-z]:/i.test(name)||name.split('/').some(s=>s==='.'||s==='..')||name.split('/').length>12)throw Error('ZIP_UNSAFE_PATH');
 return name;
}
function crc32(data){
 let c=~0;
 for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}
 return (~c)>>>0;
}
function parseZip(buf){
 if(!Buffer.isBuffer(buf)||buf.length<22||buf.length>ZIP_MAX)throw Error('ZIP_SIZE_INVALID');
 let end=-1;
 for(let p=buf.length-22;p>=Math.max(0,buf.length-65557);p--)if(buf.readUInt32LE(p)===0x06054b50){end=p;break;}
 if(end<0||end+22+buf.readUInt16LE(end+20)!==buf.length)throw Error('ZIP_DIRECTORY_INVALID');
 if(buf.readUInt16LE(end+4)!==0||buf.readUInt16LE(end+6)!==0)throw Error('ZIP_MULTIDISK_UNSUPPORTED');
 const count=buf.readUInt16LE(end+10),cdSize=buf.readUInt32LE(end+12),start=buf.readUInt32LE(end+16);
 if(count>ENTRY_MAX||count===0||count===65535||start===0xffffffff||cdSize===0xffffffff||start+cdSize>end)throw Error('ZIP_DIRECTORY_INVALID');
 let cursor=start,total=0;const records=[],names=new Set();
 for(let i=0;i<count;i++){
  if(cursor+46>buf.length||buf.readUInt32LE(cursor)!==0x02014b50)throw Error('ZIP_DIRECTORY_INVALID');
  const flags=buf.readUInt16LE(cursor+8),method=buf.readUInt16LE(cursor+10);
  const expectedCrc=buf.readUInt32LE(cursor+16);
  const compressed=buf.readUInt32LE(cursor+20),expanded=buf.readUInt32LE(cursor+24);
  const n=buf.readUInt16LE(cursor+28),extra=buf.readUInt16LE(cursor+30),comment=buf.readUInt16LE(cursor+32);
  const offset=buf.readUInt32LE(cursor+42),external=buf.readUInt32LE(cursor+38);
  if(flags&1||![0,8].includes(method)||expanded>FILE_MAX||offset===0xffffffff||compressed===0xffffffff)throw Error('ZIP_ENTRY_UNSUPPORTED');
  if(cursor+46+n+extra+comment>start+cdSize)throw Error('ZIP_DIRECTORY_INVALID');
  const name=validName(buf.subarray(cursor+46,cursor+46+n).toString('utf8'));
  cursor+=46+n+extra+comment;
  if(name.endsWith('/'))continue;
  if(((external>>>16)&0xf000)===0xa000)throw Error('ZIP_SYMLINK_UNSUPPORTED');
  if(names.has(name.toLowerCase()))throw Error('ZIP_DUPLICATE_PATH');
  names.add(name.toLowerCase());
  total+=expanded;if(total>TOTAL_MAX)throw Error('ZIP_UNPACKED_TOO_LARGE');
  if(offset+30>start||buf.readUInt32LE(offset)!==0x04034b50)throw Error('ZIP_LOCAL_HEADER_INVALID');
  const localName=buf.readUInt16LE(offset+26),localExtra=buf.readUInt16LE(offset+28),at=offset+30+localName+localExtra;
  if(at+compressed>start)throw Error('ZIP_LOCAL_HEADER_INVALID');
  const data=buf.subarray(at,at+compressed);
  const content=method===0?data:zlib.inflateRawSync(data,{maxOutputLength:FILE_MAX+1});
  if(content.length!==expanded||content.length>FILE_MAX)throw Error('ZIP_ENTRY_SIZE_MISMATCH');
  if(crc32(content)!==expectedCrc)throw Error('ZIP_CRC_MISMATCH');
  records.push({name,content});
 }
 if(cursor!==start+cdSize)throw Error('ZIP_DIRECTORY_INVALID');
 // A single outer directory is common in exported website ZIPs.
 let prefix='';
 if(!records.some(x=>x.name.toLowerCase()==='index.html')){
  const dirs=new Set(records.map(x=>x.name.split('/')[0]));
  if(dirs.size===1)prefix=[...dirs][0]+'/';
 }
 const files=[],used=new Set();
 for(const rec of records){
  const name=prefix&&rec.name.startsWith(prefix)?rec.name.slice(prefix.length):rec.name;
  if(!name)continue;
  validName(name);
  if(!SERVE_EXT.has(path.posix.extname(name).toLowerCase()))continue; // original ZIP is retained intact
  if(used.has(name.toLowerCase()))throw Error('ZIP_DUPLICATE_PATH');
  used.add(name.toLowerCase());
  files.push({name,content:rec.content});
 }
 if(!files.some(x=>x.name.toLowerCase()==='index.html'))throw Error('ZIP_INDEX_HTML_REQUIRED');
 return {files,totalBytes:files.reduce((n,f)=>n+f.content.length,0)};
}
function safeCustomer(req,db,requireTenant){
 const tenantId=Number(requireTenant(req)),id=String(req.params.id||'');
 if(!Number.isSafeInteger(tenantId)||tenantId<1)throw Error('TENANT_CONTEXT_REQUIRED');
 if(!id||id.length>120||!/^[a-z0-9_:.+-]+$/i.test(id))throw Error('INVALID_CUSTOMER_ID');
 const found=(Array.isArray(db?.customers)?db.customers:[]).some(c=>String(c.id)===id&&Number(c.tenantId)===tenantId);
 if(!found)throw Error('CUSTOMER_NOT_FOUND');
 return {tenantId,id};
}
function safeEntry(name){
 if(!name||name.length>260||name.includes('\\')||name.startsWith('/')||name.includes('\0')||name.split('/').some(s=>s===''||s==='.'||s==='..')||name.split('/').length>12)throw Error('INVALID_PREVIEW_PATH');
 if(!SERVE_EXT.has(path.posix.extname(name).toLowerCase()))throw Error('INVALID_PREVIEW_PATH');
 return name;
}
function register(app,{auth,ownerOnly,requireTenant,db,getStore,saveStore,writerReady,serializeSiteMutation,storageRoot}){
 if(![auth,ownerOnly,requireTenant,getStore,saveStore,writerReady,serializeSiteMutation].every(f=>typeof f==='function'))throw Error('ZIP_UPLOAD_DEPENDENCY_REQUIRED');
 const root=path.resolve(storageRoot||path.join(__dirname,'..','data','sbc-ai-proposal-uploads'));
 const base=(req)=>{const t=safeCustomer(req,db,requireTenant);return {...t,dir:path.join(root,String(t.tenantId),encodeURIComponent(t.id))};};
 const uploads=()=>Array.isArray(getStore()?.aiSiteUploads)?getStore().aiSiteUploads:[];
 const own=(req,records)=>{const c=base(req);return {c,items:records.filter(r=>r.customerId===c.id&&r.tenantId===c.tenantId)};};
 const preview=(c,record,name='index.html')=>ROOT.replace(':id',encodeURIComponent(c.id))+'/uploads/'+record.id+'/preview/'+name;
 const failError=(res,e)=>{
  const code=String(e?.message||'UPLOAD_ERROR');
  return fail(res,code==='CUSTOMER_NOT_FOUND'||code==='UPLOAD_NOT_FOUND'?404:
   code==='TENANT_CONTEXT_REQUIRED'?403:code==='UPLOAD_REVISION_CONFLICT'?409:
   code==='WEBSITE_PRODUCTION_WRITER_UNAVAILABLE'?423:
   /^(ZIP_|INVALID_|UPLOAD_TOO_LARGE|UPLOAD_CONTENT_TYPE_REQUIRED|UPLOAD_ORIGIN_DENIED)/.test(code)?400:503,
   /^(ZIP_|INVALID_|UPLOAD_TOO_LARGE|UPLOAD_CONTENT_TYPE_REQUIRED|UPLOAD_ORIGIN_DENIED|CUSTOMER_NOT_FOUND|TENANT_CONTEXT_REQUIRED|UPLOAD_REVISION_CONFLICT|UPLOAD_NOT_FOUND|WEBSITE_PRODUCTION_WRITER_UNAVAILABLE)/.test(code)?code:'PROPOSAL_UPLOAD_FAILED');
 };
 app.get(ROOT+'/uploads',auth,ownerOnly,(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
   const {c,items}=own(req,uploads());
   return res.json({ok:true,customerId:c.id,uploads:items.map(r=>({
    id:r.id,tier:r.tier,filename:r.filename,fileCount:r.fileCount,bytes:r.bytes,createdAt:r.createdAt,
    previewPath:preview(c,r),downloadPath:ROOT.replace(':id',encodeURIComponent(c.id))+'/uploads/'+r.id+'/download',
    status:'OWNER_REVIEW_REQUIRED'
   })).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,50)});
  }catch(e){return failError(res,e)}
 });
 app.post(ROOT+'/uploads/:tier',auth,ownerOnly,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!writerReady())return failError(res,Error('WEBSITE_PRODUCTION_WRITER_UNAVAILABLE'));
  const tier=Number(req.params.tier);
  if(!TIERS.has(tier))return fail(res,400,'INVALID_TIER');
  const origin=req.headers.origin;
  if(origin){try{if(new URL(origin).host!==req.headers.host)throw Error('UPLOAD_ORIGIN_DENIED')}catch{return fail(res,403,'UPLOAD_ORIGIN_DENIED')}}
  if(req.headers['x-sbc-proposal-upload']!=='1')return fail(res,403,'UPLOAD_ORIGIN_DENIED');
  if(!/^application\/(zip|octet-stream)(?:\s*;|$)/i.test(String(req.headers['content-type']||'')))return fail(res,415,'UPLOAD_CONTENT_TYPE_REQUIRED');
  if(Number(req.headers['content-length']||0)>ZIP_MAX)return fail(res,413,'UPLOAD_TOO_LARGE');
  let chunks=[],size=0;
  try{
   for await(const chunk of req){
    size+=chunk.length;if(size>ZIP_MAX)throw Error('UPLOAD_TOO_LARGE');
    chunks.push(chunk);
   }
   const buf=Buffer.concat(chunks),parsed=parseZip(buf),c=base(req),id='up_'+crypto.randomUUID().replace(/-/g,'');
   const staged=path.join(c.dir,'.'+id+'.staging'),folder=path.join(c.dir,id);
   fs.mkdirSync(c.dir,{recursive:true,mode:0o700});
   fs.mkdirSync(staged,{mode:0o700});
   let promoted=false;
   try{
    for(const file of parsed.files){
     const dest=path.join(staged,file.name);
     fs.mkdirSync(path.dirname(dest),{recursive:true,mode:0o700});
     fs.writeFileSync(dest,file.content,{flag:'wx',mode:0o600});
    }
    fs.writeFileSync(path.join(staged,'original.zip'),buf,{flag:'wx',mode:0o600});
    fs.renameSync(staged,folder);promoted=true;
    const record={tenantId:c.tenantId,customerId:c.id,tier,id,
     filename:'website-proposal-'+tier+'.zip',fileCount:parsed.files.length,
     bytes:buf.length,createdAt:new Date().toISOString(),status:'OWNER_REVIEW_REQUIRED'};
    await serializeSiteMutation(async()=>{
     // Re-check the identity and writer state immediately before the durable metadata write.
     safeCustomer(req,db,requireTenant);
     if(!writerReady())throw Error('WEBSITE_PRODUCTION_WRITER_UNAVAILABLE');
     const state=getStore(),rows=Array.isArray(state?.aiSiteUploads)?state.aiSiteUploads:[];
     const saved=await saveStore({...state,aiSiteUploads:[...rows,record]});
     if(saved?.skipped===true||saved?.ok===false)throw Error('PROPOSAL_UPLOAD_FAILED');
    });
    return res.status(201).json({ok:true,upload:{...record,previewPath:preview(c,record),status:'OWNER_REVIEW_REQUIRED'},durable:true});
   }catch(e){if(promoted)fs.rmSync(folder,{recursive:true,force:true});throw e}
   finally{fs.rmSync(staged,{recursive:true,force:true})}
  }catch(e){return failError(res,e)}
 });
 function find(req){
  const {c,items}=own(req,uploads()),record=items.find(r=>r.id===req.params.uploadId);
  if(!record)throw Error('UPLOAD_NOT_FOUND');
  if(!/^up_[a-f0-9]{32}$/.test(record.id))throw Error('UPLOAD_NOT_FOUND');
  return {c,record,folder:path.join(c.dir,record.id)};
 }
 app.get(ROOT+'/uploads/:uploadId/download',auth,ownerOnly,(req,res)=>{
  try{
   const {folder,record}=find(req),file=path.join(folder,'original.zip');
   if(!fs.statSync(file).isFile())throw Error('UPLOAD_NOT_FOUND');
   res.setHeader('Cache-Control','private, no-store');
   res.setHeader('X-Content-Type-Options','nosniff');
   res.setHeader('Content-Type','application/zip');
   res.setHeader('Content-Disposition','attachment; filename="sbc-proposal-'+record.tier+'.zip"');
   return res.sendFile(file);
  }catch(e){return failError(res,e)}
 });
 app.get(ROOT+'/uploads/:uploadId/preview/*',auth,ownerOnly,(req,res)=>{
  try{
   const {folder}=find(req),rel=safeEntry(req.params[0]),dest=path.resolve(folder,rel);
   if(!dest.startsWith(folder+path.sep))throw Error('INVALID_PREVIEW_PATH');
   const stat=fs.lstatSync(dest);
   if(!stat.isFile()||stat.isSymbolicLink())throw Error('INVALID_PREVIEW_PATH');
   const ext=path.extname(dest).toLowerCase();
   const forwarded=String(req.headers['x-forwarded-proto']||'').split(',')[0].trim().toLowerCase();
   const proto=(req.secure||forwarded==='https')?'https':'http';
   const host=String(req.headers.host||'');
   if(!/^[a-z0-9.:-]+$/i.test(host))throw Error('INVALID_PREVIEW_HOST');
   const origin=proto+'://'+host;
   res.setHeader('Cache-Control','private, no-store');
   res.setHeader('X-Content-Type-Options','nosniff');
   res.setHeader('Referrer-Policy','no-referrer');
   // The sandboxed document has an opaque origin. Permit only owner-authorized
   // subresource rendering; the HTML CSP blocks outbound connections/forms.
   res.setHeader('Cross-Origin-Resource-Policy','cross-origin');
   if(ext==='.html'||ext==='.htm'||ext==='.svg'){
    res.setHeader('Content-Security-Policy',
     "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' "+origin+
     "; style-src 'unsafe-inline' "+origin+"; img-src "+origin+
     " data:; font-src "+origin+" data:; media-src "+origin+
     "; connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'");
   }
   res.setHeader('Content-Type',TYPES[ext]||'application/octet-stream');
   return res.sendFile(dest);
  }catch(e){return failError(res,e)}
 });
}
module.exports={register,parseZip,safeEntry};
