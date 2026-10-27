'use strict';
const fs=require('fs');
const mysql=require('mysql2/promise');
(async()=>{
  const file=process.argv[2];if(!file||!fs.existsSync(file))throw new Error('Backup SQL file is required');
  if(!(process.env.SBC_RESTORE_DB_HOST&&process.env.SBC_RESTORE_DB_USER&&process.env.SBC_RESTORE_DB_PASSWORD&&process.env.SBC_RESTORE_DB_NAME))throw new Error('SBC_RESTORE_DB_* credentials are required; never point this drill at production');
  if(String(process.env.SBC_RESTORE_CONFIRM||'')!=='YES')throw new Error('Set SBC_RESTORE_CONFIRM=YES for the disposable restore target');
  const sql=fs.readFileSync(file,'utf8');if(!/^-- SBC logical backup/m.test(sql))throw new Error('Unrecognized SBC backup format');
  const db=await mysql.createConnection({host:process.env.SBC_RESTORE_DB_HOST,user:process.env.SBC_RESTORE_DB_USER,password:process.env.SBC_RESTORE_DB_PASSWORD,database:process.env.SBC_RESTORE_DB_NAME,port:Number(process.env.SBC_RESTORE_DB_PORT||3306),multipleStatements:true});
  await db.query(sql);const [[r]]=await db.query('SELECT COUNT(*) AS tables_restored FROM information_schema.tables WHERE table_schema=DATABASE()');await db.end();console.log(`RESTORE DRILL PASS: ${r.tables_restored} tables present in disposable restore target.`);
})().catch(e=>{console.error('RESTORE DRILL FAIL:',e.message);process.exit(1)});
