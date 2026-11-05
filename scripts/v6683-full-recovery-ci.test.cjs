'use strict';
// V66.83. Synthetic-only MySQL 8 source -> logical SQL backup -> isolated target.
// DOES NOT access or restore real SBC/GoDaddy customer data.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const mysql=require('mysql2/promise');
const drill=require('./mysql-restore-drill.js');

const CONFIG={
  CI:'true',SBC_V6683_RESTORE_CI:'YES',MYSQL_HOST:'127.0.0.1',MYSQL_PORT:'3306'
};
function allow(env){
  for(const [k,v] of Object.entries(CONFIG))
    if(String(env[k]||'')!==v)throw Error('V6683_REFUSE_NON_DISPOSABLE_CI:'+k);
  if(!env.SBC_V6683_CI_ROOT_PASSWORD)throw Error('V6683_REFUSE_MISSING_LOCAL_MYSQL_PASSWORD');
  return true;
}
const QUOTED=String.fromCharCode(96);
const TABLES=['sbc_customers','sbc_quotes','sbc_orders','sbc_renewals','sbc_activities','sbc_financial_vault_locks','sbc_lead_mesh'];
const SOURCE='sbc_ci_restore_source',TARGET='sbc_ci_restore_target',USER='sbc_ci_restore',PASS='ci_restore_only_local';
const fixture=[
  {id:'ci-a',tenant_id:1,details:"Alpha's example; first\nline",amount_cents:19900,status:'PENDING'},
  {id:'ci-b',tenant_id:2,details:'Beta synthetic — café',amount_cents:2500000,status:'PAID'},
  {id:'ci-c',tenant_id:1,details:'Gamma synthetic',amount_cents:0,status:'UNPAID'}
];
function digest(rows){
  const sorted=rows.map(x=>({...x})).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}
function processNode(script,args,env){
  const r=cp.spawnSync(process.execPath,[path.join(__dirname,script),...args],{
    env:{...process.env,...env},encoding:'utf8',timeout:45000,maxBuffer:5*1024*1024
  });
  if(r.error)throw r.error;
  return r;
}
function assertDenied(result,code){
  assert.notEqual(result.status,0,'The unsafe operation unexpectedly succeeded');
  assert.match((result.stderr||'')+(result.stdout||''),code);
}
async function main(){
  allow(process.env);
  const root=await mysql.createConnection({
    host:'127.0.0.1',port:3306,user:'root',password:process.env.SBC_V6683_CI_ROOT_PASSWORD,connectTimeout:10000
  });
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6683-ci-')),out=path.join(dir,'synthetic.sql');
  let client;
  try{
    await root.query('CREATE DATABASE '+QUOTED+SOURCE+QUOTED);
    await root.query('CREATE DATABASE '+QUOTED+TARGET+QUOTED);
    await root.query("CREATE USER '"+USER+"'@'%' IDENTIFIED BY '"+PASS+"'");
    await root.query('GRANT SELECT, SHOW VIEW ON '+QUOTED+SOURCE+QUOTED+'.* TO '+mysql.escape(USER)+'@'+mysql.escape('%'));
    await root.query('GRANT SELECT, INSERT, CREATE, DROP, INDEX, ALTER, REFERENCES ON '+QUOTED+TARGET+QUOTED+'.* TO '+mysql.escape(USER)+'@'+mysql.escape('%'));
    for(const table of TABLES){
      const name=QUOTED+SOURCE+QUOTED+'.'+QUOTED+table+QUOTED;
      await root.query('CREATE TABLE '+name+' (id VARCHAR(64) PRIMARY KEY, tenant_id INT NOT NULL, details TEXT, amount_cents BIGINT NOT NULL, status VARCHAR(32) NOT NULL) ENGINE=InnoDB');
      for(const row of fixture)
        await root.execute('INSERT INTO '+name+' (id,tenant_id,details,amount_cents,status) VALUES (?,?,?,?,?)',
          [row.id,row.tenant_id,row.details,row.amount_cents,row.status]);
    }
    const sourceEnv={DB_HOST:'127.0.0.1',DB_PORT:'3306',DB_USER:USER,DB_PASSWORD:PASS,DB_NAME:SOURCE};
    const backup=processNode('mysql-backup.js',[out],sourceEnv);
    assert.equal(backup.status,0,backup.stderr);
    assert.ok(fs.statSync(out).size>500,'SBC logical backup missing');
    const restoredEnv={
      CI:'true',SBC_RESTORE_CONFIRM:'YES',SBC_RESTORE_DISPOSABLE:'YES',
      SBC_RESTORE_DB_HOST:'127.0.0.1',SBC_RESTORE_DB_PORT:'3306',
      SBC_RESTORE_DB_NAME:TARGET,SBC_RESTORE_DB_USER:USER,SBC_RESTORE_DB_PASSWORD:PASS,
      DB_HOST:'',DB_NAME:'',MYSQL_HOST:'',MYSQL_DATABASE:''
    };
    for(const [key,value] of [
      ['SBC_RESTORE_CONFIRM','NO'],
      ['SBC_RESTORE_DISPOSABLE','NO'],
      ['SBC_RESTORE_DB_HOST','live.example.invalid'],
      ['SBC_RESTORE_DB_NAME','sbc_production'],
      ['SBC_RESTORE_DB_USER','root']
    ]){
      assertDenied(processNode('mysql-restore-drill.js',[out],{...restoredEnv,[key]:value}),/RESTORE_REFUSE_NON_DISPOSABLE_TARGET/);
    }
    assertDenied(processNode('mysql-restore-drill.js',[out],{...restoredEnv,DB_HOST:'127.0.0.1'}),/RESTORE_REFUSE_MIXED_LIVE_DB_ENV/);
    const unsafe=path.join(dir,'unsafe.sql');
    fs.writeFileSync(unsafe,fs.readFileSync(out,'utf8')+'\nUSE production;\n');
    assertDenied(processNode('mysql-restore-drill.js',[unsafe],restoredEnv),/RESTORE_REFUSE_CROSS_SCHEMA_SQL/);
    const restored=processNode('mysql-restore-drill.js',[out],restoredEnv);
    assert.equal(restored.status,0,restored.stderr);
    const report=JSON.parse(restored.stdout);
    assert.equal(report.status,'PASS_DISPOSABLE_SQL_IMPORT');
    assert.equal(report.tables,TABLES.length);
    assert.equal(report.rows,TABLES.length*fixture.length);
    client=await mysql.createConnection({
      host:'127.0.0.1',port:3306,user:USER,password:PASS,database:TARGET,dateStrings:true
    });
    let compared=0;
    for(const table of TABLES){
      const [sourceRows]=await root.query('SELECT * FROM '+QUOTED+SOURCE+QUOTED+'.'+QUOTED+table+QUOTED+' ORDER BY id');
      const [restoredRows]=await client.query('SELECT * FROM '+QUOTED+table+QUOTED+' ORDER BY id');
      assert.equal(restoredRows.length,fixture.length,'COUNT mismatch for '+table);
      assert.equal(digest(sourceRows),digest(restoredRows),'DIGEST mismatch for '+table);
      assert.equal(new Set(restoredRows.map(x=>x.tenant_id)).size,2,'Tenant data lost for '+table);
      compared+=restoredRows.length;
    }
    assertDenied(processNode('mysql-restore-drill.js',[out],restoredEnv),/RESTORE_REFUSE_NONEMPTY_TARGET/);
    console.log(JSON.stringify({
      status:'PASS_SYNTHETIC_FULL_LOGICAL_RESTORE',
      tables:TABLES.length,rowsCompared:compared,tenantCount:2,
      digestEquality:'PASS_ALL_TABLES',
      badDestinations:'REFUSED',
      unsafeSql:'REFUSED',
      repeatRestore:'REFUSED',
      productionBackupUsed:false,
      productionRestoreCertified:false
    }));
  }finally{
    if(client)await client.end();
    try{await root.query('DROP DATABASE IF EXISTS '+QUOTED+TARGET+QUOTED)}catch(e){console.error('cleanup target',e.message)}
    try{await root.query('DROP DATABASE IF EXISTS '+QUOTED+SOURCE+QUOTED)}catch(e){console.error('cleanup source',e.message)}
    try{await root.query("DROP USER IF EXISTS '"+USER+"'@'%'")}catch(e){console.error('cleanup user',e.message)}
    await root.end();
    fs.rmSync(dir,{recursive:true,force:true});
  }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={allow,digest};
