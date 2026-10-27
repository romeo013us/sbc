'use strict';
const fs=require('fs');
const path=require('path');
const mysql=require('mysql2/promise');
(async()=>{
  if(!(process.env.DB_HOST&&process.env.DB_USER&&process.env.DB_PASSWORD&&process.env.DB_NAME))throw new Error('DB_* credentials are required');
  const out=process.argv[2]||path.join(process.cwd(),`sbc-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.sql`);
  const db=await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,port:Number(process.env.DB_PORT||3306)});
  const [tables]=await db.query('SHOW TABLES'); const key=Object.keys(tables[0]||{})[0]; let sql='-- SBC logical backup '+new Date().toISOString()+'\nSET FOREIGN_KEY_CHECKS=0;\n';
  for(const row of tables){const table=row[key];const [[create]]=await db.query(`SHOW CREATE TABLE \`${table}\``);sql+=`\nDROP TABLE IF EXISTS \`${table}\`;\n${create['Create Table']};\n`;const [rows]=await db.query(`SELECT * FROM \`${table}\``);for(const r of rows){const vals=Object.values(r).map(v=>v===null?'NULL':mysql.escape(v)).join(',');sql+=`INSERT INTO \`${table}\` VALUES (${vals});\n`;}}
  sql+='\nSET FOREIGN_KEY_CHECKS=1;\n';fs.writeFileSync(out,sql);await db.end();console.log(`BACKUP PASS: ${out} (${Buffer.byteLength(sql)} bytes, ${tables.length} tables)`);
})().catch(e=>{console.error('BACKUP FAIL:',e.message);process.exit(1)});
