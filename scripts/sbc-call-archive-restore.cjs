'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const tables = [
 ['sbc_call_attempt_archive_v1', 'tenant_id, log_id'],
 ['sbc_call_attempt_revision_v1', 'revision_id']
];

async function inventory(conn, schema) {
 const result = [];
 for (const [table, order] of tables) {
  const [rows] = await conn.query('SELECT * FROM ??.?? ORDER BY '+order, [schema, table]);
  const digest = crypto.createHash('sha256');
  for (const row of rows) digest.update(JSON.stringify(row)+'\n');
  result.push({table, count:rows.length, sha256:digest.digest('hex')});
 }
 return result;
}

module.exports = async function verifyArchiveRestore() {
 assert.equal(process.env.SBC_CALL_ARCHIVE_MYSQL_CI, 'YES');
 assert.equal(process.env.CI, 'true');
 const password = process.env.SBC_V6682_CI_MYSQL_PASSWORD;
 assert(password);
 const source = 'sbc_v6682_ci';
 const target = 'sbc_archive_restore_ci_'+crypto.randomBytes(8).toString('hex');
 const connection = await require('mysql2/promise').createConnection({
  host:'127.0.0.1', port:3306, user:'root', password, database:source
 });
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-archive-drill-'));
 const file = path.join(dir, 'archive.sql');
 let created = false;
 try {
  const before = await inventory(connection,source);
  assert(before[0].count >= 10000 && before[1].count > before[0].count);
  const args = ['--protocol=TCP','--host=127.0.0.1','--port=3306','--user=root'];
  const env = {...process.env, MYSQL_PWD:password};
  const out = fs.openSync(file,'wx',0o600);
  try {
   const dump = spawnSync('mysqldump',[...args,'--single-transaction','--quick','--no-tablespaces',
    '--skip-add-drop-table',source,...tables.map(([table])=>table)],{env,stdio:['ignore',out,'pipe']});
   assert.ifError(dump.error);assert.equal(dump.status,0,String(dump.stderr));
  } finally {fs.closeSync(out);}
  await connection.query('CREATE DATABASE ??',[target]);
  created = true;
  const input = fs.openSync(file,'r');
  try {
   const restore = spawnSync('mysql',[...args,target],{env,stdio:[input,'ignore','pipe']});
   assert.ifError(restore.error);assert.equal(restore.status,0,String(restore.stderr));
  } finally {fs.closeSync(input);}
  const after = await inventory(connection,target);
  assert.deepEqual(after,before);
  const [orphans] = await connection.query('SELECT COUNT(*) AS n FROM ??.sbc_call_attempt_revision_v1 r LEFT JOIN ??.sbc_call_attempt_archive_v1 a ON a.tenant_id=r.tenant_id AND a.log_id=r.log_id WHERE a.log_id IS NULL',[target,target]);
  assert.equal(Number(orphans[0].n),0);
  console.log('Restored '+after[0].count+' attempts and '+after[1].count+' revisions; both full-table digests matched.');
 } finally {
  try {if(created)await connection.query('DROP DATABASE ??',[target]);}
  finally {await connection.end();fs.rmSync(dir,{recursive:true,force:true});}
 }
};
