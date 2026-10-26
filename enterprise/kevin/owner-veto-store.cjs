'use strict';
/**
 * Kevin V6643: owner veto MUST survive node restart. A missing, invalid or
 * unreadable receipt means the veto remains ON (fail closed).
 * No Preview writer, provider calls, credentials or MySQL mutations.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const FILE='kevin-owner-veto.v1.json';
function dest(root){return path.join(root,'data',FILE)}
function checksum(v){return crypto.createHash('sha256').update('1|'+v.active+'|'+v.updatedAt).digest('hex')}
function read(root){
 const file=dest(root);
 try{
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.size>2048||stat.size<30)return {active:true,verified:false,reason:'INVALID_RECEIPT_FILE'};
  const v=JSON.parse(fs.readFileSync(file,'utf8'));
  if(v.schema!==1||typeof v.active!=='boolean'||typeof v.updatedAt!=='string'||
     Number.isNaN(Date.parse(v.updatedAt))||v.checksum!==checksum(v))
    return {active:true,verified:false,reason:'INVALID_RECEIPT'};
  return {active:v.active,verified:true,reason:'DURABLE_RECEIPT',updatedAt:v.updatedAt};
 }catch(e){
  return {active:true,verified:false,reason:e?.code==='ENOENT'?'NO_RECEIPT':'READ_FAILED'};
 }
}
function save(root,active){
 if(typeof active!=='boolean')throw Object.assign(new Error('KEVIN_VETO_BOOLEAN_REQUIRED'),{code:'KEVIN_VETO_BOOLEAN_REQUIRED'});
 if(String(process.env.SBC_RUNTIME_ROLE||'readonly').trim().toLowerCase()!=='writer')
   throw Object.assign(new Error('KEVIN_VETO_WRITER_REQUIRED'),{code:'KEVIN_VETO_WRITER_REQUIRED'});
 const dir=path.join(root,'data');
 const dirStat=fs.statSync(dir);
 if(!dirStat.isDirectory())throw Error('KEVIN_VETO_DATA_DIR_INVALID');
 const file=dest(root),v={schema:1,active,updatedAt:new Date().toISOString()};
 v.checksum=checksum(v);
 const tmp=file+'.tmp-'+process.pid+'-'+crypto.randomBytes(8).toString('hex');
 let fd;
 try{
  fd=fs.openSync(tmp,fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_WRONLY,0o600);
  fs.writeFileSync(fd,JSON.stringify(v)+'\n','utf8');fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;
  fs.renameSync(tmp,file);
  const dirfd=fs.openSync(dir,fs.constants.O_RDONLY);
  try{fs.fsyncSync(dirfd)}finally{fs.closeSync(dirfd)}
  const confirm=read(root);
  if(!confirm.verified||confirm.active!==active)throw Error('KEVIN_VETO_DURABILITY_UNVERIFIED');
  return confirm;
 }finally{
  if(fd!==undefined)try{fs.closeSync(fd)}catch{}
  try{fs.unlinkSync(tmp)}catch{}
 }
}
module.exports={read,save,FILE};
