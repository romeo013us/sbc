'use strict';
/* GoDaddy uses overlay extraction (cleanAppDirBeforeExtract:false): retired
 * debug HTML can outlive source removal. Delete ONLY the exact legacy Git
 * blob, never a changed file or a symlink. No customer data is accessed.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const LEGACY_BLOB='a050ae33311fb9a75266345051ec21dc8aef2983';
const DIRS=['public','browser_public'];

function gitBlobId(data){
 return crypto.createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex');
}
function removeLegacyDiagnosticFiles(root){
 const removed=[],retained=[],errors=[];
 for(const dir of DIRS){
  const rel=dir+'/diag2.html',folder=path.join(root,dir),file=path.join(folder,'diag2.html');
  try{
   if(!fs.existsSync(folder))continue;
   const directory=fs.lstatSync(folder);
   if(directory.isSymbolicLink()||!directory.isDirectory()){retained.push(rel);continue;}
   let stat;
   try{stat=fs.lstatSync(file)}catch(e){if(e.code==='ENOENT')continue;throw e}
   if(!stat.isFile()||stat.isSymbolicLink()){retained.push(rel);continue;}
   const data=fs.readFileSync(file);
   if(gitBlobId(data)!==LEGACY_BLOB){retained.push(rel);continue;}
   fs.unlinkSync(file);
   removed.push(rel);
  }catch(e){errors.push(rel)}
 }
 return {removed,retained,errors};
}
module.exports={removeLegacyDiagnosticFiles,gitBlobId,LEGACY_BLOB};
