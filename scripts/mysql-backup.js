'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const MAGIC=Buffer.from('SBCBK1','ascii'),IV_BYTES=12,TAG_BYTES=16,MAX_ENCRYPTED_SQL=128*1024*1024;
function checkKey(key){if(!Buffer.isBuffer(key)||key.length!==32)throw Error('BACKUP_ENCRYPTION_KEY_INVALID');return key;}
function keyFromEnv(env){
 const value=env.SBC_BACKUP_ENCRYPTION_KEY;
 if(value===undefined)return undefined;
 if(typeof value!=='string'||!(/^[A-Za-z0-9+/]{43}=$/).test(value))throw Error('BACKUP_ENCRYPTION_KEY_INVALID');
 const key=checkKey(Buffer.from(value,'base64'));
 if(key.toString('base64')!==value)throw Error('BACKUP_ENCRYPTION_KEY_INVALID');
 return key;
}
function writeAll(fd,data){
 let offset=0;while(offset<data.length){const n=fs.writeSync(fd,data,offset,data.length-offset);if(n<=0)throw Error('BACKUP_WRITE_FAILED');offset+=n;}
}
function decryptBackup(input,out,key){
 checkKey(key);
 const fd=fs.openSync(input,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
 let bytes;
 try{
  const stat=fs.fstatSync(fd),overhead=MAGIC.length+IV_BYTES+TAG_BYTES;
  if(!stat.isFile()||stat.size<=overhead||stat.size>MAX_ENCRYPTED_SQL+overhead)throw Error('BACKUP_ENCRYPTED_SIZE_INVALID');
  bytes=Buffer.alloc(stat.size);let n=0;while(n<bytes.length){const read=fs.readSync(fd,bytes,n,bytes.length-n,n);if(!read)throw Error('BACKUP_ENCRYPTED_SIZE_INVALID');n+=read;}
  if(fs.fstatSync(fd).size!==stat.size)throw Error('BACKUP_ENCRYPTED_SIZE_INVALID');
 }finally{fs.closeSync(fd);}
 const start=MAGIC.length+IV_BYTES;
 if(!bytes.subarray(0,MAGIC.length).equals(MAGIC))throw Error('BACKUP_ENCRYPTED_FORMAT_INVALID');
 let plain;
 try{
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,bytes.subarray(MAGIC.length,start));
  decipher.setAAD(bytes.subarray(0,start));decipher.setAuthTag(bytes.subarray(-TAG_BYTES));
  plain=Buffer.concat([decipher.update(bytes.subarray(start,-TAG_BYTES)),decipher.final()]);
 }catch{throw Error('BACKUP_AUTHENTICATION_FAILED');}
 const target=path.resolve(out),temp=path.join(path.dirname(target),'.sbc-backup-'+crypto.randomUUID()+'.partial');
 let output=null,created=false;
 try{
  output=fs.openSync(temp,'wx',0o600);created=true;fs.fchmodSync(output,0o600);
  writeAll(output,plain);fs.fsyncSync(output);fs.closeSync(output);output=null;
  fs.linkSync(temp,target);return {bytes:plain.length,authenticated:true};
 }finally{
  plain.fill(0);
  if(output!==null)try{fs.closeSync(output)}catch{}
  if(created)fs.unlinkSync(temp);
 }
}
// Publish a completed, private logical export exactly once. Never overwrite a
// previous backup. Repeatable-read snapshot protects transactional InnoDB rows;
// this is not a substitute for an independent production restore or DDL freeze.
async function writeBackup(db,out,{escape,encryptionKey}={}){
 if(typeof escape!=='function')throw Error('BACKUP_SQL_ESCAPE_REQUIRED');
 const encrypted=encryptionKey!==undefined;
 if(encrypted)checkKey(encryptionKey);
 const iv=encrypted?crypto.randomBytes(IV_BYTES):null;
 const header=encrypted?Buffer.concat([MAGIC,iv]):null;
 const cipher=encrypted?crypto.createCipheriv('aes-256-gcm',encryptionKey,iv):null;
 if(cipher)cipher.setAAD(header);
 const target=path.resolve(out),temp=path.join(path.dirname(target),'.sbc-backup-'+crypto.randomUUID()+'.partial');
 const tick=String.fromCharCode(96);
 let fd=null,transaction=false,bytes=0,rows=0,tableCount=0,created=false;
 let plainBytes=0;
 const raw=data=>{writeAll(fd,data);bytes+=data.length;};
 const append=text=>{const data=Buffer.from(text,'utf8');plainBytes+=data.length;if(cipher&&plainBytes>MAX_ENCRYPTED_SQL)throw Error('BACKUP_ENCRYPTED_SIZE_INVALID');raw(cipher?cipher.update(data):data);};
 try{
  fd=fs.openSync(temp,'wx',0o600);created=true;fs.fchmodSync(fd,0o600);
  if(cipher)raw(header);
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
  if(cipher){raw(cipher.final());raw(cipher.getAuthTag());}
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
 const key=keyFromEnv(process.env);
 if(process.argv[2]==='--decrypt'){
  if(process.argv.length!==5)throw Error('BACKUP_DECRYPT_USAGE');
  const result=decryptBackup(process.argv[3],process.argv[4],key);
  console.log('BACKUP AUTHENTICATED: '+result.bytes+' bytes (private SQL; not restored)');return;
 }
 const mysql=require('mysql2/promise');
 if(!(process.env.DB_HOST&&process.env.DB_USER&&process.env.DB_PASSWORD&&process.env.DB_NAME))throw Error('DB_* credentials are required');
 const out=process.argv[2]||path.join(process.cwd(),'sbc-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sql'+(key?'.enc':''));
 if(key&&!out.endsWith('.enc'))throw Error('BACKUP_ENCRYPTED_EXTENSION_REQUIRED');
 if(!key&&out.endsWith('.enc'))throw Error('BACKUP_ENCRYPTION_KEY_INVALID');
 const db=await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,port:Number(process.env.DB_PORT||3306),dateStrings:true,supportBigNumbers:true,bigNumberStrings:true});
 try{const result=await writeBackup(db,out,{escape:mysql.escape,encryptionKey:key});console.log('BACKUP PASS: '+out+' ('+result.bytes+' bytes, '+result.tables+' tables, '+result.rows+' rows)');}
 finally{await db.end();}
}
if(require.main===module)main().catch(e=>{console.error('BACKUP FAIL:',e.code||e.message);process.exitCode=1;});
module.exports={writeBackup,decryptBackup,keyFromEnv};
