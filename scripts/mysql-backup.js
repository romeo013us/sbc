'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
// Publish a completed, private logical export exactly once. Never overwrite a
// previous backup. Repeatable-read snapshot protects transactional InnoDB rows;
// this is not a substitute for an independent production restore or DDL freeze.
async function writeBackup(db,out,{escape}={}){
 if(typeof escape!=='function')throw Error('BACKUP_SQL_ESCAPE_REQUIRED');
 const target=path.resolve(out),temp=path.join(path.dirname(target),'.sbc-backup-'+crypto.randomUUID()+'.partial');
 const tick=String.fromCharCode(96);
 let fd=null,transaction=false,bytes=0,rows=0,tableCount=0,created=false;
 const append=text=>{const data=Buffer.from(text,'utf8');let offset=0;while(offset<data.length){const n=fs.writeSync(fd,data,offset,data.length-offset);if(n<=0)throw Error('BACKUP_WRITE_FAILED');offset+=n;}bytes+=data.length;};
 try{
  fd=fs.openSync(temp,'wx',0o600);created=true;fs.fchmodSync(fd,0o600);
  await db.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');transaction=true;
  const [tables]=await db.query('SHOW TABLES');
  if(!Array.isArray(tables)||!tables.length)throw Error('BACKUP_EMPTY_SCHEMA');
  const key=Object.keys(tables[0])[0];
  append('-- SBC logical backup '+new Date().toISOString()+'\nSET FOREIGN_KEY_CHECKS=0;\n');
  for(const row of tables){
   const table=row[key];
   if(typeof table!=='string'||!/^[A-Za-z0-9_]+$/.test(table))throw Error('BACKUP_TABLE_NAME_INVALID');
   const quoted=tick+table+tick;
   const [[create]]=await db.query('SHOW CREATE TABLE '+quoted);
   const ddl=create?.['Create Table'];
   if(typeof ddl!=='string'||!/\bENGINE=InnoDB\b/i.test(ddl))throw Error('BACKUP_NONTRANSACTIONAL_OR_UNSUPPORTED_TABLE');
   append('\nDROP TABLE IF EXISTS '+quoted+';\n'+ddl+';\n');
   const [records]=await db.query('SELECT * FROM '+quoted);
   for(const record of records){
    const values=Object.values(record).map(v=>v===null?'NULL':escape(v)).join(',');
    append('INSERT INTO '+quoted+' VALUES ('+values+');\n');rows++;
   }
   tableCount++;
  }
  append('\nSET FOREIGN_KEY_CHECKS=1;\n');
  await db.commit();transaction=false;
  fs.fsyncSync(fd);fs.closeSync(fd);fd=null;
  // Hard-link creation is atomic and fails if the destination already exists,
  // including a symlink. The temporary file is in the same directory.
  fs.linkSync(temp,target);
  return {bytes,tables:tableCount,rows};
 }finally{
  if(transaction)try{await db.rollback()}catch{}
  if(fd!==null)try{fs.closeSync(fd)}catch{}
  if(created)try{fs.unlinkSync(temp)}catch(e){if(e.code!=='ENOENT')throw e;}
 }
}
async function main(){
 const mysql=require('mysql2/promise');
 if(!(process.env.DB_HOST&&process.env.DB_USER&&process.env.DB_PASSWORD&&process.env.DB_NAME))throw Error('DB_* credentials are required');
 const out=process.argv[2]||path.join(process.cwd(),'sbc-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sql');
 const db=await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,port:Number(process.env.DB_PORT||3306),dateStrings:true,supportBigNumbers:true,bigNumberStrings:true});
 try{const result=await writeBackup(db,out,{escape:mysql.escape});console.log('BACKUP PASS: '+out+' ('+result.bytes+' bytes, '+result.tables+' tables, '+result.rows+' rows)');}
 finally{await db.end();}
}
if(require.main===module)main().catch(e=>{console.error('BACKUP FAIL:',e.code||e.message);process.exitCode=1;});
module.exports={writeBackup};
