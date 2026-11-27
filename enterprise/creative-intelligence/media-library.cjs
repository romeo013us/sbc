'use strict';
// Private local-volume adapter. Only trusted renderer output and server-derived
// tenant/project context may enter this boundary. Not a public upload endpoint.
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const MAX=32*1024*1024,HEADER=4096;
const hash=b=>createHash('sha256').update(b).digest('hex');
const isHash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const keys=(v,allowed)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>allowed.includes(k));
function normalizeScope(s){
 if(!keys(s,['tenantId','projectId'])||!Number.isSafeInteger(s.tenantId)||s.tenantId<1||typeof s.projectId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(s.projectId))throw Error('INVALID_MEDIA_SCOPE');
 return {tenantId:s.tenantId,projectId:s.projectId};
}
function metadata(s,input){
 if(!keys(input,['bytes','mime','sha256','alt'])||!Buffer.isBuffer(input.bytes)||input.bytes.length<24||input.bytes.length>MAX||!isHash(input.sha256)||hash(input.bytes)!==input.sha256||typeof input.alt!=='string'||!input.alt.trim()||input.alt.length>180||/[<>\u0000-\u001f\u007f]/.test(input.alt))throw Error('INVALID_MEDIA_INPUT');
 const b=input.bytes;
 if(input.mime==='image/png'){
  if(!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||b.toString('ascii',12,16)!=='IHDR'||b.readUInt32BE(16)<1||b.readUInt32BE(16)>4096||b.readUInt32BE(20)<1||b.readUInt32BE(20)>4096)throw Error('INVALID_MEDIA_FORMAT');
 }else if(input.mime==='video/mp4'){
  if(b.toString('ascii',4,8)!=='ftyp'||b.readUInt32BE(0)<16||b.readUInt32BE(0)>b.length)throw Error('INVALID_MEDIA_FORMAT');
 }else throw Error('INVALID_MEDIA_FORMAT');
 const core={...s,mime:input.mime,sha256:input.sha256,alt:input.alt.trim(),size:b.length,reviewState:'draft'};
 return {id:hash(JSON.stringify(core)),...core};
}
function createMediaLibrary({root}){
 if(typeof root!=='string'||!path.isAbsolute(root))throw Error('INVALID_MEDIA_ROOT');
 const folder=s=>path.join(root,String(s.tenantId),s.projectId);
 const filename=(s,id)=>{if(!isHash(id))throw Error('INVALID_MEDIA_ID');return path.join(folder(s),id+'.asset');};
 async function get(scope,id){
  const s=normalizeScope(scope),file=filename(s,id);let fh;
  try{fh=await fs.open(file,'r');}catch(e){if(e.code==='ENOENT')return null;throw e;}
  try{
   const stat=await fh.stat();if(!stat.isFile()||stat.size<25||stat.size>MAX+HEADER)throw Error('MEDIA_INTEGRITY_FAILURE');
   const raw=await fh.readFile(),end=raw.indexOf(10);if(end<1||end>HEADER-1)throw Error('MEDIA_INTEGRITY_FAILURE');
   try{const stored=JSON.parse(raw.toString('utf8',0,end)),bytes=raw.subarray(end+1),asset=metadata(s,{bytes,mime:stored.mime,sha256:stored.sha256,alt:stored.alt});
    if(asset.id!==id||JSON.stringify(asset)!==JSON.stringify(stored))throw Error('MEDIA_INTEGRITY_FAILURE');return {asset,bytes};
   }catch{throw Error('MEDIA_INTEGRITY_FAILURE');}
  }finally{await fh.close();}
 }
 async function put(scope,input){
  const s=normalizeScope(scope);if(!Buffer.isBuffer(input?.bytes))throw Error('INVALID_MEDIA_INPUT');
  const safe={...input,bytes:Buffer.from(input.bytes)},asset=metadata(s,safe),dir=folder(s),file=filename(s,asset.id);
  await fs.mkdir(dir,{recursive:true,mode:0o700});
  const temp=path.join(dir,'.'+randomUUID()+'.tmp');let fh;
  try{
   fh=await fs.open(temp,'wx',0o600);await fh.writeFile(Buffer.concat([Buffer.from(JSON.stringify(asset)+'\n'),safe.bytes]));await fh.sync();await fh.close();fh=null;
   try{await fs.link(temp,file);}catch(e){if(e.code!=='EEXIST')throw e;}
   const existing=await get(s,asset.id);if(!existing)throw Error('MEDIA_INTEGRITY_FAILURE');return existing.asset;
  }finally{if(fh)await fh.close();await fs.rm(temp,{force:true});}
 }
 function list(scope){const s=normalizeScope(scope);return (async()=>{
  let names;try{names=await fs.readdir(folder(s));}catch(e){if(e.code==='ENOENT')return [];throw e;}
  const result=[];for(const name of names.filter(n=>/^[a-f0-9]{64}\.asset$/.test(n)).sort().slice(0,100)){const item=await get(s,name.slice(0,-6));if(item)result.push(item.asset);}return result;
 })();}
 return Object.freeze({put,get,list});
}
module.exports={createMediaLibrary};
