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
const TIERS=new Set([199,499,799,999]);
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

/**
 * Advisory check for links in a private ZIP proposal preview.
 * It does not publish a site, fetch resources, or claim a production browser pass.
 * The preview CSP blocks off-site CSS, JS and images, so report those explicitly.
 */
function auditPreviewFiles(files){
 const entries=Array.isArray(files)?files:[];
 const names=new Set(entries.map(f=>String(f?.name||'').toLowerCase()));
 const issues=[],seen=new Set(),deliveryFlags=new Set();
 let issueCount=0,checkedPages=0;
 function issue(code,page,reference){
  const ref=String(reference||'').slice(0,180),key=[code,page,ref].join('|');
  if(seen.has(key))return;
  seen.add(key);issueCount++;
  if(issues.length<12)issues.push({code,page:String(page).slice(0,180),reference:ref});
 }
 function attribute(tag,name){
  const pattern=new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27|([^\\s>]+))','i');
  const match=pattern.exec(tag);
  return match?(match[1]??match[2]??match[3]):'';
 }
 function link(page,raw,kind){
  const ref=String(raw||'').trim().replace(/&amp;/gi,'&');
  if(!ref||ref.startsWith('#')||/^(?:mailto:|tel:|data:|blob:)/i.test(ref))return;
  if(/^https?:\/\//i.test(ref)||ref.startsWith('//')||/^[a-z][a-z\d+.-]*:/i.test(ref)){
   if(kind==='asset')issue('EXTERNAL_RESOURCE_BLOCKED',page,'External subresource');
   return;
  }
  if(ref.startsWith('/')){issue('ROOT_ABSOLUTE_PATH',page,ref);return}
  const clean=ref.split(/[?#]/)[0];if(!clean)return;
  let decoded;
  try{decoded=decodeURIComponent(clean)}catch{issue('INVALID_REFERENCE',page,'Malformed percent escape');return}
  if(decoded.includes('\\')){issue('INVALID_REFERENCE',page,'Backslash in reference');return}
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(page),decoded));
  if(target==='..'||target.startsWith('../')){issue('PATH_OUTSIDE_SITE',page,clean);return}
  if(kind==='page'&&!/\.html?$/i.test(target))return; // SPA routes are not verifiable from a static ZIP.
  if(!names.has(target.toLowerCase()))issue(kind==='page'?'MISSING_PAGE':'MISSING_ASSET',page,target);
 }
 for(const file of entries){
  const page=String(file?.name||'');
  if(!/\.html?$/i.test(page))continue;
  checkedPages++;
  const html=Buffer.isBuffer(file.content)?file.content.toString('utf8'):String(file.content??'');
  if(!/<title\b[^>]*>\s*[^<\s][^<]*<\/title>/i.test(html))deliveryFlags.add('PAGE_TITLE_REVIEW');
  if(!/<meta\s+[^>]*name\s*=\s*["\x27]?viewport["\x27]?/i.test(html))deliveryFlags.add('MOBILE_VIEWPORT_REVIEW');
  if(/(?:\[(?:PHONE|EMAIL|ADDRESS|HOURS)[^\]]*(?:NOT PROVIDED|TO BE CONFIRMED)\]|pending verification|owner confirmation required|details pending|awaiting verification|not yet verified)/i.test(html))deliveryFlags.add('BUSINESS_FACTS_UNVERIFIED');
  if(/<form\b/i.test(html))deliveryFlags.add('FORM_BACKEND_MUST_BE_TESTED');
  if([...html.matchAll(/<img\b[^>]*>/gi)].some(m=>!/(?:^|\s)alt\s*=/.test(m[0])))deliveryFlags.add('IMAGE_ALT_TEXT_REVIEW');
  for(const match of html.matchAll(/<(script|img|link|a|source)\b[^>]*>/gi)){
   const tag=match[0],type=match[1].toLowerCase();
   if(type==='script'||type==='img'||type==='source'){
    link(page,attribute(tag,'src'),'asset');
   }else if(type==='link'){
    const rel=attribute(tag,'rel').toLowerCase();
    if(/\b(stylesheet|icon|manifest|preload|modulepreload)\b/.test(rel))
     link(page,attribute(tag,'href'),'asset');
   }else if(type==='a')link(page,attribute(tag,'href'),'page');
  }
  if(/<base\b[^>]*\bhref\s*=/i.test(html))issue('BASE_HREF_BLOCKED',page,'HTML base href is blocked in private preview');
 }
 if(checkedPages===0)issue('MISSING_PAGE','index.html','No HTML page available');
 return {
  status:issueCount===0?'PREVIEW_LINKS_OK':'PREVIEW_LINKS_NEED_REVIEW',
  checkedPages,issueCount,issues,deliveryReview:{status:deliveryFlags.size?'OWNER_REVIEW_REQUIRED':'STATIC_CHECKS_PASSED',flags:[...deliveryFlags].sort()},
  scope:'Static file and HTML checks only; responsive appearance, JS interactions, CSS imports, forms, consent and live deployment require manual testing.'
 };
}


const BACKUP_MAX=96*1024*1024;
// Portable ZIP-of-ZIPs built without new SaaS dependencies. Files remain intact,
// and every archived ZIP can be independently restored or inspected offline.
function packStoredEntries(entries){
 if(!Array.isArray(entries)||!entries.length||entries.length>500)throw Error('BACKUP_INVALID_ENTRIES');
 const local=[],central=[];let offset=0,total=0;const names=new Set();
 for(const entry of entries){
  const name=String(entry?.name||''),content=entry?.content;
  if(!Buffer.isBuffer(content)||!name||name.length>240||name.includes('\\')||name.startsWith('/')||
   name.split('/').some(p=>!p||p==='..'||p==='.')||/[\0-\x1f]/.test(name)||
   !/^[a-z0-9_./-]+$/i.test(name)||names.has(name.toLowerCase()))throw Error('BACKUP_INVALID_ENTRIES');
  names.add(name.toLowerCase());
  total+=content.length;
  if(total>BACKUP_MAX*2)throw Error('BACKUP_TOO_LARGE');
  const label=Buffer.from(name,'utf8'),size=content.length,crc=crc32(content);
  const lh=Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);
  lh.writeUInt16LE(0x0800,6);lh.writeUInt32LE(crc,14);
  lh.writeUInt32LE(size,18);lh.writeUInt32LE(size,22);lh.writeUInt16LE(label.length,26);
  local.push(lh,label,content);
  const cd=Buffer.alloc(46);cd.writeUInt32LE(0x02014b50,0);
  cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);cd.writeUInt16LE(0x0800,8);
  cd.writeUInt32LE(crc,16);cd.writeUInt32LE(size,20);cd.writeUInt32LE(size,24);
  cd.writeUInt16LE(label.length,28);cd.writeUInt32LE(offset,42);
  central.push(cd,label);
  offset+=lh.length+label.length+size;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
 end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,directory,end]);
}
function buildRecoveryArchive({tenantId,customerId,records,readOriginal,maxBytes=BACKUP_MAX}={}){
 const rows=Array.isArray(records)?records:[];
 if(!rows.length)throw Error('BACKUP_NO_VERSIONS');
 if(rows.length>498||typeof readOriginal!=='function')throw Error('BACKUP_INVALID_ENTRIES');
 if(!Number.isSafeInteger(tenantId)||tenantId<1||typeof customerId!=='string'||!customerId)throw Error('BACKUP_INVALID_VERSION');
 const limit=Math.min(BACKUP_MAX,Number(maxBytes)||BACKUP_MAX);
 const files=[],versions=[],seen=new Set();let bytes=0;
 for(const row of rows){
  const id=String(row?.id||''),tier=Number(row?.tier);
  if(row?.tenantId!==tenantId||row?.customerId!==customerId||
   !/^up_[a-f0-9]{32}$/.test(id)||!TIERS.has(tier))throw Error('BACKUP_INVALID_VERSION');
  if(seen.has(id))throw Error('BACKUP_DUPLICATE_VERSION');
  seen.add(id);
  let original;
  try{original=readOriginal(row)}catch{throw Error('BACKUP_MISSING_FILE')}
  if(!Buffer.isBuffer(original)||original.length<22||
    original.length!==Number(row.bytes))throw Error('BACKUP_INTEGRITY_FAILED');
  const digest=crypto.createHash('sha256').update(original).digest('hex');
  if(row.sha256&&row.sha256!==digest)throw Error('BACKUP_INTEGRITY_FAILED');
  try{parseZip(original)}catch{throw Error('BACKUP_INTEGRITY_FAILED')}
  bytes+=original.length;
  if(bytes+8192>limit)throw Error('BACKUP_TOO_LARGE');
  const name='versions/'+id+'.zip';
  versions.push({id,tier,createdAt:String(row.createdAt||''),bytes:original.length,sha256:digest,path:name});
  files.push({name,content:original});
 }
 const manifest=Buffer.from(JSON.stringify({
  schema:'sbc-customer-website-backup-v1',tenantId,customerId,
  exportedAt:new Date().toISOString(),versions
 },null,2)+'\n');
 if(bytes+manifest.length+8192>limit)throw Error('BACKUP_TOO_LARGE');
 files.unshift({name:'manifest.json',content:manifest});
 return packStoredEntries(files);
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
 const versionKey=(c,tier)=>String(c.tenantId)+':'+c.id+':'+tier;
 const newestFor=(rows,tier)=>rows.slice().reverse().find(r=>Number(r.tier)===Number(tier))?.id||null;
 const activeFor=(state,c,rows,tier)=>state?.aiSiteActiveVersions?.[versionKey(c,tier)]||newestFor(rows,tier);
 const own=(req,records)=>{const c=base(req);return {c,items:records.filter(r=>r.customerId===c.id&&r.tenantId===c.tenantId)};};
 // Scoped, time-limited preview grants are deliberately separate from login
 // cookies: iframe sandboxing gives the site an opaque origin, and browsers may
 // withhold SameSite session cookies from CSS, script and image requests.
 // Grants live only in this process and cannot create or modify CRM records.
 const PREVIEW_TTL_MS=60*60*1000,PREVIEW_GRANT_LIMIT=2048;
 const previewGrants=new Map();
 function preview(c,record,name='index.html'){
  const current=Date.now();
  for(const [key,grant] of previewGrants)if(grant.expiresAt<=current)previewGrants.delete(key);
  while(previewGrants.size>=PREVIEW_GRANT_LIMIT)previewGrants.delete(previewGrants.keys().next().value);
  const ticket=crypto.randomBytes(32).toString('base64url');
  const key=crypto.createHash('sha256').update(ticket).digest('hex');
  previewGrants.set(key,{tenantId:c.tenantId,customerId:c.id,uploadId:record.id,expiresAt:current+PREVIEW_TTL_MS});
  return ROOT.replace(':id',encodeURIComponent(c.id))+'/uploads/'+record.id+'/render/'+ticket+'/'+name;
 }
 function previewFolder(req){
  const ticket=String(req.params.ticket||'');
  if(!/^[a-zA-Z0-9_-]{43}$/.test(ticket))throw Error('PREVIEW_SESSION_EXPIRED');
  const digest=crypto.createHash('sha256').update(ticket).digest('hex');
  const grant=previewGrants.get(digest);
  if(!grant||grant.expiresAt<=Date.now()){
   previewGrants.delete(digest);
   throw Error('PREVIEW_SESSION_EXPIRED');
  }
  if(grant.customerId!==String(req.params.id)||grant.uploadId!==String(req.params.uploadId))
   throw Error('PREVIEW_SESSION_EXPIRED');
  const record=uploads().find(row=>row.id===grant.uploadId&&row.tenantId===grant.tenantId&&row.customerId===grant.customerId);
  if(!record||!(Array.isArray(db?.customers)&&db.customers.some(c=>String(c.id)===grant.customerId&&Number(c.tenantId)===grant.tenantId)))
   throw Error('PREVIEW_SESSION_EXPIRED');
  return path.resolve(root,String(grant.tenantId),encodeURIComponent(grant.customerId),grant.uploadId);
 }

 const failError=(res,e)=>{
  const code=String(e?.message||'UPLOAD_ERROR');
  return fail(res,code==='CUSTOMER_NOT_FOUND'||code==='UPLOAD_NOT_FOUND'?404:
   code==='TENANT_CONTEXT_REQUIRED'?403:code==='UPLOAD_REVISION_CONFLICT'?409:
   code==='WEBSITE_PRODUCTION_WRITER_UNAVAILABLE'?423:
   code==='PREVIEW_SESSION_EXPIRED'?403:
   code==='BACKUP_NO_VERSIONS'?404:
   code==='BACKUP_TOO_LARGE'?413:
   code.startsWith('BACKUP_')?409:
   /^(ZIP_|INVALID_|UPLOAD_TOO_LARGE|UPLOAD_CONTENT_TYPE_REQUIRED|UPLOAD_ORIGIN_DENIED)/.test(code)?400:503,
   /^(BACKUP_|ZIP_|INVALID_|UPLOAD_TOO_LARGE|UPLOAD_CONTENT_TYPE_REQUIRED|UPLOAD_ORIGIN_DENIED|CUSTOMER_NOT_FOUND|TENANT_CONTEXT_REQUIRED|UPLOAD_REVISION_CONFLICT|UPLOAD_NOT_FOUND|WEBSITE_PRODUCTION_WRITER_UNAVAILABLE|PREVIEW_SESSION_EXPIRED)/.test(code)?code:'PROPOSAL_UPLOAD_FAILED');
 };
 app.get(ROOT+'/uploads',auth,ownerOnly,(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
   const {c,items}=own(req,uploads()),state=getStore();
   const ordered=items.slice().reverse().map(r=>({
    id:r.id,tier:r.tier,filename:r.filename,fileCount:r.fileCount,bytes:r.bytes,createdAt:r.createdAt,previewAudit:r.previewAudit||null,
    active:r.id===activeFor(state,c,items,r.tier),
    previewPath:preview(c,r),downloadPath:ROOT.replace(':id',encodeURIComponent(c.id))+'/uploads/'+r.id+'/download',
    status:'OWNER_REVIEW_REQUIRED'
   })).sort((a,b)=>(Number(b.active)-Number(a.active))||b.createdAt.localeCompare(a.createdAt)).slice(0,50);
   return res.json({ok:true,customerId:c.id,uploads:ordered});
  }catch(e){return failError(res,e)}
 });
 app.get(ROOT+'/uploads/recovery/export',auth,ownerOnly,(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');
  try{
   const {c,items}=own(req,uploads());
   const bundle=buildRecoveryArchive({tenantId:c.tenantId,customerId:c.id,records:items,
    readOriginal:r=>{
     const location=path.join(c.dir,r.id,'original.zip');
     const st=fs.lstatSync(location);
     if(!st.isFile()||st.isSymbolicLink())throw Error('BACKUP_MISSING_FILE');
     return fs.readFileSync(location);
    }});
   res.setHeader('X-Content-Type-Options','nosniff');
   res.setHeader('Content-Type','application/zip');
   res.setHeader('Content-Disposition','attachment; filename="sbc-customer-website-backup.zip"');
   res.setHeader('Content-Length',String(bundle.length));
   return res.end(bundle);
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
   const buf=Buffer.concat(chunks),parsed=parseZip(buf),previewAudit=auditPreviewFiles(parsed.files),c=base(req),id='up_'+crypto.randomUUID().replace(/-/g,'');
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
     bytes:buf.length,sha256:crypto.createHash('sha256').update(buf).digest('hex'),
     createdAt:new Date().toISOString(),status:'OWNER_REVIEW_REQUIRED',previewAudit};
    await serializeSiteMutation(async()=>{
     // Re-check the identity and writer state immediately before the durable metadata write.
     safeCustomer(req,db,requireTenant);
     if(!writerReady())throw Error('WEBSITE_PRODUCTION_WRITER_UNAVAILABLE');
     const state=getStore(),rows=Array.isArray(state?.aiSiteUploads)?state.aiSiteUploads:[];
     // A fresh upload becomes current; prior ZIPs remain intact and recoverable.
     const next={...state,aiSiteUploads:[...rows,record]};
     if(state.aiSiteActiveVersions){
      const pins={...state.aiSiteActiveVersions};delete pins[versionKey(c,tier)];
      next.aiSiteActiveVersions=pins;
     }
     const saved=await saveStore(next);
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
 // Promote any preserved version back to "current" without moving, deleting,
 // rewriting or publishing a website. Only the logged-in owner may do this.
 app.post(ROOT+'/uploads/:uploadId/select',auth,ownerOnly,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!writerReady())return failError(res,Error('WEBSITE_PRODUCTION_WRITER_UNAVAILABLE'));
  if(req.headers['x-sbc-website-version-select']!=='1')return fail(res,403,'UPLOAD_ORIGIN_DENIED');
  const origin=req.headers.origin;
  if(origin){try{if(new URL(origin).host!==req.headers.host)throw Error('UPLOAD_ORIGIN_DENIED')}catch{return fail(res,403,'UPLOAD_ORIGIN_DENIED')}}
  try{
   const selected=find(req);
   const expected=String(req.body?.expectedActiveId||'');
   if(!/^up_[a-f0-9]{32}$/.test(expected))return fail(res,400,'INVALID_PREVIEW_PATH');
   const original=path.join(selected.folder,'original.zip');
   const stat=fs.lstatSync(original);
   if(!stat.isFile()||stat.isSymbolicLink())throw Error('BACKUP_INTEGRITY_FAILED');
   const content=fs.readFileSync(original);
   if(content.length!==Number(selected.record.bytes)||selected.record.sha256&&
       crypto.createHash('sha256').update(content).digest('hex')!==selected.record.sha256)throw Error('BACKUP_INTEGRITY_FAILED');
   parseZip(content);
   let activeId=null;
   await serializeSiteMutation(async()=>{
    const {c,items}=own(req,uploads());
    if(!writerReady())throw Error('WEBSITE_PRODUCTION_WRITER_UNAVAILABLE');
    const found=items.find(row=>row.id===selected.record.id&&Number(row.tier)===Number(selected.record.tier));
    if(!found)throw Error('UPLOAD_NOT_FOUND');
    const state=getStore(),current=activeFor(state,c,items,found.tier);
    if(current!==expected)throw Error('UPLOAD_REVISION_CONFLICT');
    const key=versionKey(c,found.tier);
    const pins={...(state.aiSiteActiveVersions||{}),[key]:found.id};
    const saved=await saveStore({...state,aiSiteActiveVersions:pins});
    if(saved?.skipped===true||saved?.ok===false)throw Error('PROPOSAL_UPLOAD_FAILED');
    activeId=found.id;
   });
   return res.json({ok:true,activeId,durable:true,published:false});
  }catch(e){return failError(res,e)}
 });
 // Re-run QA for historical saved ZIPs without a re-upload, a writer lease
 // or any customer-state mutation. Reports only bounded issue types and file
 // counts; website content and customer PII never appear in the JSON result.
 app.get(ROOT+'/uploads/:uploadId/qa',auth,ownerOnly,(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');
  try{
   const {record,folder}=find(req),archive=path.join(folder,'original.zip');
   const st=fs.lstatSync(archive);
   if(!st.isFile()||st.isSymbolicLink()||st.size>ZIP_MAX||st.size!==Number(record.bytes))
    throw Error('BACKUP_INTEGRITY_FAILED');
   const buf=fs.readFileSync(archive);
   if(record.sha256&&crypto.createHash('sha256').update(buf).digest('hex')!==record.sha256)
    throw Error('BACKUP_INTEGRITY_FAILED');
   const parsed=parseZip(buf),audit=auditPreviewFiles(parsed.files);
   return res.json({ok:true,readOnly:true,published:false,fileCount:parsed.files.length,previewAudit:audit});
  }catch(e){return failError(res,e)}
 });
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
 // Legacy authenticated link remains available for previous copies.
 app.get(ROOT+'/uploads/:uploadId/preview/*',auth,ownerOnly,(req,res)=>{
  try{
   const {folder}=find(req);
   return servePreview(folder,req,res,false);
  }catch(e){return failError(res,e)}
 });
 // Only an authenticated owner can mint this capability in the uploads list
 // or upload response. A sandboxed iframe then loads linked local CSS/JS/media
 // without requiring a login cookie on each isolated-origin subrequest.
 app.get(ROOT+'/uploads/:uploadId/render/:ticket/*',(req,res)=>{
  try{
   const folder=previewFolder(req);
   return servePreview(folder,req,res,true);
  }catch(e){return failError(res,e)}
 });
 function servePreview(folder,req,res,grantBased){
  try{
   const rel=safeEntry(req.params[0]),dest=path.resolve(folder,rel);
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
   // Fonts and ESM from the opaque sandbox need CORS. Only a signed,
   // expiring, read-only preview grant can reach this branch.
   if(grantBased){
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
   }
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
 }
}
module.exports={register,parseZip,safeEntry,auditPreviewFiles,packStoredEntries,buildRecoveryArchive};
