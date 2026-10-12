'use strict';
const fs=require('node:fs');
const path=require('node:path');
const MARKER='SBC_V6527_PERSISTENCE_WRITER_LOCK';
function apply(root){
 const serverPath=path.join(root,'server.js');
 let s=fs.readFileSync(serverPath,'utf8');
 if(!s.includes(MARKER)){
  const start="  const conn=await mysqlPool.getConnection();\n  let transactionStarted=false;\n  try{\n    await conn.ping();";
  const patched="  const conn=await mysqlPool.getConnection();\n  let transactionStarted=false;\n  let persistenceWriterLockAcquired=false;\n  // SBC_V6527_PERSISTENCE_WRITER_LOCK: serialize the complete relational snapshot/write path across processes sharing MySQL.\n  const persistenceWriterLock='sbc:persistence:writer:v1';\n  try{\n    const [lockRows]=await conn.query('SELECT GET_LOCK(?, 0) AS acquired',[persistenceWriterLock]);\n    persistenceWriterLockAcquired=Number(lockRows?.[0]?.acquired)===1;\n    if(!persistenceWriterLockAcquired){const e=new Error('PERSISTENCE_WRITER_BUSY: another SBC process owns the relational writer lease.');e.code='PERSISTENCE_WRITER_BUSY';throw e;}\n    await conn.ping();";
  if(!s.includes(start)) throw new Error('V6527: writer function entry anchor not found; refusing partial patch.');
  s=s.replace(start,patched);
  const end="  }finally{try{conn.release()}catch{}}\n}\n\nasync function mysqlKeepalive(){";
  const endPatch="  }finally{\n    if(persistenceWriterLockAcquired){try{await conn.query('SELECT RELEASE_LOCK(?) AS released',[persistenceWriterLock])}catch(e){console.error('[SBC PERSISTENCE WRITER LOCK] release failed; destroying connection:',e.message);try{conn.destroy()}catch{}}}\n    try{conn.release()}catch{}\n  }\n}\n\nasync function mysqlKeepalive(){";
  if(!s.includes(end)) throw new Error('V6527: writer function exit anchor not found; refusing partial patch.');
  s=s.replace(end,endPatch); fs.writeFileSync(serverPath,s);
 }
 const pkgPath=path.join(root,'package.json'); const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8')); pkg.version='65.1.27';pkg.description='SBC OS V65.1.27 persistence single-writer lock';fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');
 const lockPath=path.join(root,'package-lock.json'); if(fs.existsSync(lockPath)){const lock=JSON.parse(fs.readFileSync(lockPath,'utf8'));lock.version='65.1.27';if(lock.packages?.['']){lock.packages[''].version='65.1.27';lock.packages[''].description=pkg.description;}fs.writeFileSync(lockPath,JSON.stringify(lock,null,2)+'\n');}
 const identity=path.join(root,'config','release-identity.js');if(fs.existsSync(identity)){let t=fs.readFileSync(identity,'utf8');t=t.replace(/65\\.1\\.26/g,'65.1.27').replace(/patch:\\s*26\\b/g,'patch:27');fs.writeFileSync(identity,t);}
 return {marker:MARKER,version:'65.1.27'};
}
module.exports={apply,MARKER};
