'use strict';
// Dedicated migration connection only; never invoke from a request or auto-run at boot.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const sha=b=>createHash('sha256').update(b).digest('hex');
function loadMigrations(dir=path.join(__dirname,'migrations')){
 const names=fs.readdirSync(dir).sort();
 if(!names.length)throw Error('MIGRATION_FILES_REQUIRED');
 return names.map((filename,i)=>{
  if(!/^\d{4}_[a-z0-9_]+\.sql$/.test(filename)||filename.slice(0,4)!==String(i+1).padStart(4,'0'))throw Error('MIGRATION_SEQUENCE_INVALID');
  const file=path.join(dir,filename);if(!fs.lstatSync(file).isFile())throw Error('MIGRATION_FILE_INVALID');
  const bytes=fs.readFileSync(file),sql=bytes.toString('utf8').trim().replace(/;$/,'');
  if(!/^CREATE TABLE sbc_core_[a-z_]+\s*\(/.test(sql)||/[;\x00]|\/\*|--|#/.test(sql))throw Error('MIGRATION_DDL_UNSUPPORTED');
  return {version:filename.slice(0,4),filename,sha256:sha(bytes),sql};
 });
}
async function runMigrations(pool,{mode,assertWriter}={}){
 if(!['reader','writer'].includes(mode))throw Error('MIGRATION_MODE_REQUIRED');
 const writer=mode==='writer',checkWriter=async()=>{if(typeof assertWriter!=='function'||await assertWriter()!==true)throw Error('MIGRATION_WRITER_REQUIRED');};
 if(writer)await checkWriter();const migrations=loadMigrations(),cx=await pool.getConnection();let lock,held=false,broken=false;
 try{
  const [[{db}]]=await cx.execute('SELECT DATABASE() AS db');if(typeof db!=='string'||!db)throw Error('MIGRATION_DATABASE_REQUIRED');
  const [[{enabled}]]=await cx.execute('SELECT @@session.autocommit AS enabled');if(Number(enabled)!==1)throw Error('MIGRATION_AUTOCOMMIT_REQUIRED');
  lock='sbc_core_'+sha(db).slice(0,48);
  const [[{acquired}]]=await cx.execute('SELECT GET_LOCK(?, 5) AS acquired',[lock]);if(Number(acquired)!==1)throw Error('MIGRATION_LOCK_UNAVAILABLE');held=true;
  if(writer){await checkWriter();await cx.execute("CREATE TABLE IF NOT EXISTS sbc_core_schema_migrations (version CHAR(4) PRIMARY KEY, filename VARCHAR(255) NOT NULL, sha256 CHAR(64) NOT NULL, state ENUM('applying','applied') NOT NULL, applied_at DATETIME(3) NULL) ENGINE=InnoDB");}
  let rows;try{[rows]=await cx.execute('SELECT version, filename, sha256, state FROM sbc_core_schema_migrations ORDER BY version');}catch(e){if(!writer&&e.code==='ER_NO_SUCH_TABLE')throw Error('MIGRATION_PENDING');throw e;}
  if(rows.length>migrations.length)throw Error('MIGRATION_HISTORY_MISMATCH');
  for(const [i,row] of rows.entries()){const m=migrations[i];if(row.version!==m.version||row.filename!==m.filename||row.sha256!==m.sha256)throw Error('MIGRATION_HISTORY_MISMATCH');if(row.state!=='applied')throw Error('MIGRATION_DIRTY');}
  if(!writer&&rows.length!==migrations.length)throw Error('MIGRATION_PENDING');
  let applied=0;
  for(const m of migrations.slice(rows.length)){
   await checkWriter();
   // MySQL DDL implicitly commits. Persist intent first; never blindly retry after interruption.
   const [intent]=await cx.execute("INSERT INTO sbc_core_schema_migrations (version,filename,sha256,state) VALUES (?,?,?,'applying')",[m.version,m.filename,m.sha256]);if(intent.affectedRows!==1)throw Error('MIGRATION_INTENT_FAILED');
   await checkWriter();await cx.execute(m.sql);await checkWriter();
   const [done]=await cx.execute("UPDATE sbc_core_schema_migrations SET state='applied',applied_at=UTC_TIMESTAMP(3) WHERE version=? AND sha256=? AND state='applying'",[m.version,m.sha256]);if(done.affectedRows!==1)throw Error('MIGRATION_FINALIZE_FAILED');applied++;
  }
  return {verified:migrations.length,applied};
 }catch(e){broken=true;throw e;}finally{
  if(held&&!broken){try{const [[{released}]]=await cx.execute('SELECT RELEASE_LOCK(?) AS released',[lock]);if(Number(released)!==1)broken=true;}catch{broken=true;}}
  if(broken)cx.destroy();else cx.release();
 }
}
module.exports={loadMigrations,runMigrations};
