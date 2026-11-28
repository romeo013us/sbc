'use strict';
// Real disposable MySQL acceptance. No runtime boot, provider calls or production credentials.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPool}=require('mysql2/promise');
const {register}=require('../routes/sbc-sales-command-v1.cjs');
const files=['20261122_001_sbc_sales_command.sql','20261127_001_sbc_am_workstation_profile_v2.sql','20261127_002_sbc_paid_trial_v2.sql','20261127_003_sbc_am_award_v2.sql','20261127_004_sbc_am_base_payroll_v2.sql'];
const tables=['sbc_sales_credit_v1','sbc_commission_terms_v1','sbc_commission_statement_v1','sbc_commission_audit_v1','sbc_am_workstation_profile_v2','sbc_am_trial_cohort_v2','sbc_am_trial_member_v2','sbc_am_award_v2','sbc_am_base_payroll_v2'];
test('disposable MySQL: existing migration sequence unlocks sales and workforce readiness without runtime DDL',async()=>{
 assert.equal(process.env.SBC_MARKET_DISPOSABLE_CI,'1');
 assert.ok(process.env.SBC_MARKET_CI_PASSWORD);
 const pool=createPool({host:'127.0.0.1',port:3306,user:'root',password:process.env.SBC_MARKET_CI_PASSWORD,database:'sbc_market_ci',connectionLimit:2,timezone:'Z'});
 let writable=true,writes=0;const routes=new Map();
 register({get:(url,_auth,fn)=>routes.set('GET '+url,fn),post(){}},{
 auth:(req,res,next)=>next?.(),getContext:()=>({db:{users:[]},mysqlPool:pool,recoveryRequired:()=>false,canWrite:()=>writable}),tenantForRead:req=>req.tenantId,writer:()=>{writes++;throw Error('READINESS_MUST_NOT_WRITE')}
 });
 const probe=async suffix=>{let code=200,body;await routes.get('GET /api/owner/sales-command/'+suffix)({tenantId:1,user:{id:'fixture-owner',tenantId:1,role:'owner',active:true}},{setHeader(){},status(n){code=n;return this},json(v){body=v;return this}});assert.equal(code,200);return body;};
 const present=async()=>{const [rows]=await pool.query('SELECT table_name AS name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('+tables.map(()=>'?').join(',')+')',tables);return rows.map(x=>x.name).sort();};
 const apply=async()=>{for(const file of files){const sql=fs.readFileSync(path.join(__dirname,'../migrations',file),'utf8').split('\n').filter(x=>!x.trimStart().startsWith('--')).join('\n');for(const statement of sql.split(';').map(x=>x.trim()).filter(Boolean)){assert.match(statement,/^CREATE TABLE IF NOT EXISTS sbc_/);await pool.query(statement);}}};
 try{
  assert.deepEqual(await present(),[]);
  const pre=await probe('readiness'),preWork=await probe('workforce/readiness');
  assert.equal(pre.ready,false);assert.equal(preWork.schemaReady,false);
  assert.equal(pre.missingTables.length,4);assert.equal(preWork.missingTables.length,5);
  assert.deepEqual(await present(),[]);
  await apply();
  assert.deepEqual(await present(),tables.slice().sort());
  assert.equal((await probe('readiness')).ready,true);
  const post=await probe('workforce/readiness');assert.equal(post.schemaReady,true);assert.equal(post.writeReady,true);
  assert.equal(post.liveAcceptanceVerified,false);
  await pool.query("INSERT INTO sbc_am_workstation_profile_v2 (tenant_id,manager_id,tier,revision,updated_by) VALUES (1,'fixture-manager','standard',1,'fixture-owner'),(2,'fixture-manager','senior',1,'fixture-owner')");
  await apply(); // repeat is non-destructive
  const [rows]=await pool.query("SELECT tenant_id,tier,revision FROM sbc_am_workstation_profile_v2 WHERE manager_id='fixture-manager' ORDER BY tenant_id");
  assert.deepEqual(rows.map(r=>[Number(r.tenant_id),r.tier,Number(r.revision)]),[[1,'standard',1],[2,'senior',1]]);
  await assert.rejects(pool.query("INSERT INTO sbc_am_trial_member_v2 (tenant_id,manager_id,cohort_id,tier,agreement_hash) VALUES (2,'fixture-manager','00000000-0000-0000-0000-000000000001','standard',REPEAT('a',64))"),e=>e.code==='ER_NO_REFERENCED_ROW_2');
  writable=false;
  assert.equal((await probe('readiness')).ready,false);
  assert.equal((await probe('workforce/readiness')).writeReady,false);
  assert.equal(writes,0);
 }finally{await pool.end();}
});
