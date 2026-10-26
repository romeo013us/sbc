'use strict';
// Runs a backup/restore rehearsal on three SYNTHETIC orders in an isolated CI MySQL.
// This is NOT a restore of actual customer records or production backup.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const EXPECTED={CI:'true',SBC_MYSQL_CI_DISPOSABLE:'yes',MYSQL_HOST:'127.0.0.1',MYSQL_PORT:'3306',MYSQL_DATABASE:'sbc_ci_disposable',MYSQL_USER:'sbc_ci'};
function authorize(env){
 for(const [k,v] of Object.entries(EXPECTED))if(String(env[k]||'')!==v)throw Error('REFUSE_NON_DISPOSABLE_TARGET:'+k);
 if(!env.MYSQL_PASSWORD)throw Error('REFUSE_MISSING_DISPOSABLE_PASSWORD');
 return true;
}
function digest(rows){
 if(!Array.isArray(rows))throw Error('INVALID_BACKUP');
 const r=rows.map(x=>({id:x.id,tenant_id:x.tenant_id,amount_cents:x.amount_cents,payment_state:x.payment_state})).sort((a,b)=>a.id.localeCompare(b.id));
 if(r.some(x=>typeof x.id!=='string'||!Number.isInteger(x.tenant_id)||!Number.isInteger(x.amount_cents)||typeof x.payment_state!=='string'))throw Error('INVALID_BACKUP');
 return crypto.createHash('sha256').update(JSON.stringify(r)).digest('hex');
}
function contractTests(){
 const good={...EXPECTED,MYSQL_PASSWORD:'ci-test-only'};
 authorize(good);
 for(const [k,v] of [['CI','false'],['MYSQL_HOST','db.example.org'],['MYSQL_DATABASE','sbc_live'],['MYSQL_USER','owner'],['SBC_MYSQL_CI_DISPOSABLE','no'],['MYSQL_PASSWORD','']])
  assert.throws(()=>authorize({...good,[k]:v}),/REFUSE_/);
 const r=[{id:'x',tenant_id:1,amount_cents:19900,payment_state:'PENDING'},{id:'y',tenant_id:2,amount_cents:34900,payment_state:'PAID'}];
 assert.equal(digest(r),digest(r.slice().reverse()));
 assert.notEqual(digest(r),digest([{...r[0],amount_cents:100},r[1]]));
 console.log('[SBC V6656] PASS: reject production database targets and detect altered backups');
}
async function exercise(){
 authorize(process.env);
 const mysql=require('mysql2/promise');
 const c=await mysql.createConnection({host:process.env.MYSQL_HOST,port:3306,database:process.env.MYSQL_DATABASE,user:process.env.MYSQL_USER,password:process.env.MYSQL_PASSWORD,multipleStatements:false,connectTimeout:10000});
 const source='sbc_ci_v6656_source',dest='sbc_ci_v6656_restored';
 const rows=[{id:'ci-a',tenant_id:7,amount_cents:34900,payment_state:'PENDING'},{id:'ci-b',tenant_id:8,amount_cents:19900,payment_state:'PAID'},{id:'ci-c',tenant_id:7,amount_cents:0,payment_state:'UNPAID'}];
 const cleanup=async()=>{await c.query('DROP TABLE IF EXISTS sbc_ci_v6656_restored');await c.query('DROP TABLE IF EXISTS sbc_ci_v6656_source');};
 try {
  const [db]=await c.query('SELECT DATABASE() AS name');assert.equal(db[0]?.name,'sbc_ci_disposable');
  await cleanup();
  await c.query('CREATE TABLE sbc_ci_v6656_source (id VARCHAR(60) PRIMARY KEY,tenant_id INT NOT NULL,amount_cents INT NOT NULL,payment_state VARCHAR(16) NOT NULL) ENGINE=InnoDB');
  for(const x of rows)await c.execute('INSERT INTO sbc_ci_v6656_source VALUES (?,?,?,?)',[x.id,x.tenant_id,x.amount_cents,x.payment_state]);
  const [backup]=await c.query('SELECT id,tenant_id,amount_cents,payment_state FROM sbc_ci_v6656_source ORDER BY id');
  assert.equal(digest(rows),digest(backup));
  await c.query('CREATE TABLE sbc_ci_v6656_restored LIKE sbc_ci_v6656_source');
  await c.beginTransaction();
  try{for(const x of backup)await c.execute('INSERT INTO sbc_ci_v6656_restored VALUES (?,?,?,?)',[x.id,x.tenant_id,x.amount_cents,x.payment_state]);await c.commit();}
  catch(e){await c.rollback();throw e;}
  const [restored]=await c.query('SELECT id,tenant_id,amount_cents,payment_state FROM sbc_ci_v6656_restored ORDER BY id');
  assert.equal(digest(restored),digest(backup));
  assert.equal(restored.filter(x=>x.tenant_id===7).length,2);
  assert.equal(restored.filter(x=>x.tenant_id===8).length,1);
  assert.equal(restored.filter(x=>x.payment_state==='PAID').length,1);
  await c.beginTransaction();
  try{await assert.rejects(c.execute('INSERT INTO sbc_ci_v6656_restored VALUES (?,?,?,?)',['ci-a',7,999,'PAID']),/Duplicate entry|ER_DUP_ENTRY/);}
  finally{await c.rollback();}
  const [after]=await c.query('SELECT id,tenant_id,amount_cents,payment_state FROM sbc_ci_v6656_restored ORDER BY id');
  assert.equal(digest(after),digest(backup));
  console.log(JSON.stringify({status:'PASS_SYNTHETIC_MYSQL8_RESTORE',restoredRows:3,tenants:2,digest:digest(restored),rollbackTest:'PASS',realBackupRestored:false,productionDataAccessed:false}));
 }finally{try{await cleanup()}finally{await c.end()}}
}
if(require.main===module)(process.argv.includes('--contract-test')?Promise.resolve().then(contractTests):exercise()).catch(e=>{console.error('[SBC V6656 RESTORE]',e.message);process.exitCode=1});
module.exports={authorize,digest,exercise,contractTests};
