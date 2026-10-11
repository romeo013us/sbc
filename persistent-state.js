'use strict';
const fs = require('node:fs');
const path = require('node:path');
const DIRS = ['data', 'backups'];
const RELEASE_OWNED = new Set(['data/sbc-integrity-manifest.json']);
function exists(p){try{fs.lstatSync(p);return true;}catch{return false;}}
function realDir(p){try{const s=fs.lstatSync(p);return s.isDirectory()&&!s.isSymbolicLink();}catch{return false;}}
function copyMissing(src,dst){if(!exists(src)||(!realDir(src)&&!fs.statSync(src).isDirectory()))return;fs.cpSync(src,dst,{recursive:true,force:false,errorOnExist:false,dereference:false});}
function previousRuntimes(base,current){const c=path.resolve(current);return fs.readdirSync(base).filter(n=>n.startsWith('.sbc-runtime-')).map(n=>path.join(base,n)).filter(p=>path.resolve(p)!==c&&realDir(p)).map(p=>({p,t:(()=>{try{return fs.statSync(path.join(p,'.sbc-bootstrap-ready.json')).mtimeMs;}catch{return fs.statSync(p).mtimeMs;}})()})).sort((a,b)=>b.t-a.t).map(x=>x.p);}
function persistState(baseDir,runtimeDir,opts={}){
 const log=opts.log||console, root=path.resolve(process.env.SBC_PERSIST_DIR||path.join(baseDir,'sbc-persistent'));
 const report={root,linked:[],seeded:[],ephemeral:false};
 try{
  fs.mkdirSync(root,{recursive:true});fs.accessSync(root,fs.constants.W_OK);
  for(const name of DIRS){
   const target=path.join(root,name),linkPath=path.join(runtimeDir,name),first=!exists(target);
   if(first){
    fs.mkdirSync(target,{recursive:true});let seed=null;
    if(opts.reused&&realDir(linkPath))seed=linkPath;
    else for(const prev of previousRuntimes(baseDir,runtimeDir)){const candidate=path.join(prev,name);if(realDir(candidate)){seed=candidate;break;}}
    if(seed){copyMissing(seed,target);report.seeded.push(name+' <- '+path.relative(baseDir,seed));}
   }
   if(realDir(linkPath)){
    copyMissing(linkPath,target);
    for(const rel of RELEASE_OWNED){if(rel.startsWith(name+'/')){const shipped=path.join(runtimeDir,rel);if(exists(shipped))fs.copyFileSync(shipped,path.join(root,rel));}}
   }
   let correct=false;try{correct=fs.lstatSync(linkPath).isSymbolicLink()&&path.resolve(path.dirname(linkPath),fs.readlinkSync(linkPath))===path.resolve(target);}catch{}
   if(!correct){fs.rmSync(linkPath,{recursive:true,force:true});fs.symlinkSync(target,linkPath,'dir');}
   report.linked.push(name);
  }
  log.log('[SBC PERSIST] state folders linked to '+root+': '+report.linked.join(', '));
  return report;
 }catch(err){
  if(process.env.SBC_ALLOW_EPHEMERAL_DATA==='1'){report.ephemeral=true;log.warn('[SBC PERSIST] WARNING: continuing with EPHEMERAL state by explicit override: '+err.message);return report;}
  throw new Error('Persistent state setup failed ('+err.message+'). Refusing to start with throw-away data.');
 }
}
module.exports={persistState,DIRS,RELEASE_OWNED};
