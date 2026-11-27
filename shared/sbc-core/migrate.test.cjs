'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {runMigrations,loadMigrations}=require('./migrate.cjs');
function fixture(){
 const state={rows:[],tables:new Set(),writes:0,failDDL:false,held:false,autocommit:1};
 const connection={async execute(sql,args=[]){
  if(sql==='SELECT DATABASE() AS db')return [[{db:'sbc_fixture'}]];
  if(sql==='SELECT @@session.autocommit AS enabled')return [[{enabled:state.autocommit}]];
  if(sql.startsWith('SELECT GET_LOCK')){state.held=true;return [[{acquired:1}]];}
  if(sql.startsWith('SELECT RELEASE_LOCK')){state.held=false;return [[{released:1}]];}
  if(sql.startsWith('CREATE TABLE IF NOT EXISTS sbc_core_schema_migrations')){state.writes++;return [{}];}
  if(sql.startsWith('SELECT version'))return [state.rows.map(r=>({...r}))];
  if(sql.startsWith('INSERT INTO sbc_core_schema_migrations')){state.writes++;state.rows.push({version:args[0],filename:args[1],sha256:args[2],state:'applying'});return [{affectedRows:1}];}
  if(sql.startsWith('CREATE TABLE ')){state.writes++;state.tables.add(sql.split(' ')[2]);if(state.failDDL)throw Error('DDL interrupted');return [{}];}
  if(sql.startsWith('UPDATE sbc_core_schema_migrations')){state.writes++;state.rows.find(r=>r.version===args[0]).state='applied';return [{affectedRows:1}];}
  throw Error('unexpected SQL '+sql);
 },release(){},destroy(){state.held=false;}};
 return {state,pool:{async getConnection(){return connection;}}};
}
const writer={mode:'writer',assertWriter:async()=>true};
test('writer applies all four ordered DDL steps; repeat verifies without replaying DDL',async()=>{const {state,pool}=fixture();assert.equal((await runMigrations(pool,writer)).applied,4);assert.equal(state.tables.size,4);assert(state.rows.every(x=>x.state==='applied'));assert.equal((await runMigrations(pool,writer)).applied,0);assert.equal(state.held,false);});
test('reader checks existing history without writing; pending history blocks',async()=>{const {state,pool}=fixture();await assert.rejects(runMigrations(pool,{mode:'reader'}),/MIGRATION_PENDING/);assert.equal(state.writes,0);await runMigrations(pool,writer);const before=state.writes;assert.equal((await runMigrations(pool,{mode:'reader'})).verified,4);assert.equal(state.writes,before);});
test('interrupted DDL leaves a durable dirty marker and refuses automatic recovery',async()=>{const {state,pool}=fixture();state.failDDL=true;await assert.rejects(runMigrations(pool,writer),/DDL interrupted/);assert.equal(state.rows[0].state,'applying');const before=state.writes;await assert.rejects(runMigrations(pool,writer),/MIGRATION_DIRTY/);assert.equal(state.writes,before+1);assert.equal(state.tables.size,1);});
test('drift and unknown history fail before applying any migration',async()=>{const {state,pool}=fixture();await runMigrations(pool,writer);state.rows[0].sha256='0'.repeat(64);await assert.rejects(runMigrations(pool,{mode:'reader'}),/MIGRATION_HISTORY_MISMATCH/);state.rows[0].sha256=loadMigrations()[0].sha256;state.rows.push({version:'9999',state:'applied'});await assert.rejects(runMigrations(pool,{mode:'reader'}),/MIGRATION_HISTORY_MISMATCH/);});
test('writer lease must be explicitly asserted before any SQL',async()=>{const {state,pool}=fixture();await assert.rejects(runMigrations(pool,{mode:'writer',assertWriter:async()=>false}),/MIGRATION_WRITER_REQUIRED/);assert.equal(state.writes,0);await assert.rejects(runMigrations(pool,{}),/MIGRATION_MODE_REQUIRED/);});
test('migration intent requires durable autocommit',async()=>{const {state,pool}=fixture();state.autocommit=0;await assert.rejects(runMigrations(pool,writer),/MIGRATION_AUTOCOMMIT_REQUIRED/);assert.equal(state.writes,0);});
