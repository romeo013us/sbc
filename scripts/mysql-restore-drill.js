'use strict';
// V66.83: destructive SQL restore is permitted ONLY into this isolated local
// schema through a schema-scoped account. Never run on GoDaddy.
// This is a small SBC logical-backup rehearsal, not a production restore tool.
const fs=require('node:fs');
const crypto=require('node:crypto');
const mysql=require('mysql2/promise');
const MAX_BYTES=128*1024*1024;
const REQUIRED=['sbc_customers','sbc_quotes','sbc_orders','sbc_renewals','sbc_activities'];
const EXPECT={
  SBC_RESTORE_CONFIRM:'YES',
  SBC_RESTORE_DISPOSABLE:'YES',
  SBC_RESTORE_DB_HOST:'127.0.0.1',
  SBC_RESTORE_DB_PORT:'3306',
  SBC_RESTORE_DB_NAME:'sbc_ci_restore_target',
  SBC_RESTORE_DB_USER:'sbc_ci_restore'
};
function authorize(env){
  for(const [k,v] of Object.entries(EXPECT))
    if(String(env[k]||'')!==v)throw Error('RESTORE_REFUSE_NON_DISPOSABLE_TARGET:'+k);
  if(!String(env.SBC_RESTORE_DB_PASSWORD||''))throw Error('RESTORE_REFUSE_PASSWORD_REQUIRED');
  if(env.DB_HOST||env.DB_NAME||env.MYSQL_HOST||env.MYSQL_DATABASE)
    throw Error('RESTORE_REFUSE_MIXED_LIVE_DB_ENV');
  return true;
}
function validateSql(file){
  const stat=fs.statSync(file);
  if(!stat.isFile()||stat.size===0||stat.size>MAX_BYTES)throw Error('RESTORE_REFUSE_FILE_SIZE_OR_TYPE');
  const bytes=fs.readFileSync(file);
  const sql=bytes.toString('utf8');
  if(!/^-- SBC logical backup \d{4}-\d\d-\d\dT/.test(sql))
    throw Error('RESTORE_REFUSE_UNRECOGNIZED_BACKUP');
  if(/(?:^|\n)\s*(?:USE\s+|(?:CREATE|DROP|ALTER)\s+(?:DATABASE|SCHEMA|USER)\b|(?:GRANT|REVOKE)\b|SET\s+GLOBAL\b|FLUSH\s+PRIVILEGES\b|LOAD\s+DATA\b)/im.test(sql))
    throw Error('RESTORE_REFUSE_CROSS_SCHEMA_SQL');
  if(/(?:^|\n)\s*--\s*mysql(?:dump)?/im.test(sql))
    throw Error('RESTORE_REFUSE_UNSUPPORTED_DUMP_FORMAT');
  const tick=String.fromCharCode(96);
  for(const table of REQUIRED){
    if(!new RegExp('(?:^|\\n)CREATE TABLE\\s+'+tick+table+tick+'\\s*\\(','i').test(sql))
      throw Error('RESTORE_REFUSE_MISSING_CORE_TABLE:'+table);
  }
  return {sql,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:stat.size};
}
async function restore(file,env=process.env){
  authorize(env); // MUST run before opening the input or the database.
  if(!file||!fs.existsSync(file))throw Error('RESTORE_REFUSE_BACKUP_FILE_REQUIRED');
  const {sql,sha256,bytes}=validateSql(file);
  const db=await mysql.createConnection({
    host:EXPECT.SBC_RESTORE_DB_HOST,port:3306,
    user:EXPECT.SBC_RESTORE_DB_USER,password:env.SBC_RESTORE_DB_PASSWORD,
    database:EXPECT.SBC_RESTORE_DB_NAME,multipleStatements:true,connectTimeout:10000
  });
  try {
    const [[identity]]=await db.query('SELECT DATABASE() AS name, CURRENT_USER() AS account');
    if(identity.name!==EXPECT.SBC_RESTORE_DB_NAME||!String(identity.account).startsWith(EXPECT.SBC_RESTORE_DB_USER+'@'))
      throw Error('RESTORE_REFUSE_DATABASE_IDENTITY');
    const [[existing]]=await db.query('SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema=DATABASE()');
    if(Number(existing.c)!==0)throw Error('RESTORE_REFUSE_NONEMPTY_TARGET');
    await db.query(sql);
    const [tables]=await db.query('SELECT table_name AS name FROM information_schema.tables WHERE table_schema=DATABASE() ORDER BY table_name');
    const names=new Set(tables.map(x=>x.name));
    for(const required of REQUIRED)if(!names.has(required))throw Error('RESTORE_CORE_TABLE_MISSING:'+required);
    // Count metadata only; never print restored names, emails or records.
    const counts={};
    for(const name of names){
      if(!/^sbc_[a-z0-9_]+$/i.test(name))throw Error('RESTORE_REFUSE_UNEXPECTED_TABLE_NAME');
      const tick=String.fromCharCode(96);
      const [[count]]=await db.query('SELECT COUNT(*) AS c FROM '+tick+name+tick);
      counts[name]=Number(count.c);
    }
    return {status:'PASS_DISPOSABLE_SQL_IMPORT',tables:names.size,rows:Object.values(counts).reduce((a,b)=>a+b,0),counts,sha256,bytes,productionRestore:false};
  } finally {await db.end()}
}
if(require.main===module){
  restore(process.argv[2]).then(r=>console.log(JSON.stringify(r,null,2)))
    .catch(e=>{console.error('RESTORE DRILL FAIL:',e.message);process.exitCode=1});
}
module.exports={authorize,validateSql,restore,REQUIRED};
