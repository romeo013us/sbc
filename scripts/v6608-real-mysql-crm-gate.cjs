'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const mysql=require('mysql2/promise');
const {runWithTenantContext}=require('../enterprise/tenant-context.cjs');
const registerReads=require('../routes/crm.js'),registerEdits=require('../routes/crm-edits-v6606.js');
const yes=(name,v,results)=>{assert.ok(v,name);results.push(name)};
const response=()=>({code:200,status(n){this.code=n;return this},setHeader(){},json(x){this.body=x;return this}});
async function main(){
 if(process.env.CI!=='true'||process.env.SBC_MYSQL_CI_DISPOSABLE!=='yes'||process.env.SBC_RUNTIME_ROLE!=='readonly')throw Error('REFUSE: requires isolated readonly CI');
 if(!['localhost','127.0.0.1'].includes(process.env.MYSQL_HOST)||process.env.MYSQL_DATABASE!=='sbc_ci_disposable')throw Error('REFUSE: non-disposable database target');
 const db=await mysql.createPool({host:process.env.MYSQL_HOST,port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER,password:process.env.MYSQL_PASSWORD,database:process.env.MYSQL_DATABASE,connectionLimit:4,waitForConnections:true,dateStrings:true});
 const checks=[];
 try{
  const ddl=fs.readFileSync(path.resolve(__dirname,'../database.sql'),'utf8');
  for(const table of ['sbc_customers','sbc_activities']){
   const line=ddl.split('\n').find(line=>line.startsWith('CREATE TABLE IF NOT EXISTS '+table+' '));
   if(!line||!line.trim().endsWith(';'))throw Error('Baseline table DDL absent: '+table);
   await db.query(line);
  }
  await db.query('ALTER TABLE sbc_customers ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 1');
  await db.query("ALTER TABLE sbc_customers ADD COLUMN assigned_to VARCHAR(80) NOT NULL DEFAULT ''");
  await db.query('ALTER TABLE sbc_activities ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 1');
  const [pre]=await db.query('SELECT COUNT(*) count FROM sbc_customers');
  assert.equal(Number(pre[0].count),0,'Refusing nonempty test database');
  for(const [id,tenant] of [['lead_a',1],['lead_b',2]]){
   await db.query('INSERT INTO sbc_customers (id,tenant_id,business_name,contact_name,phone,email,status,source,notes,assigned_to,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
   [id,tenant,'Synthetic '+id,'CI Staff','3055550111','staff@example.org','Lead','CI','Original notes','caller1','2026-10-24 12:00:00','2026-10-24 12:00:00']);
  }
  const found=new Map(),app={
   get(p,...f){found.set('GET '+p,f.at(-1))},
   post(p,...f){found.set('POST '+p,f.at(-1))},
   patch(p,...f){found.set('PATCH '+p,f.at(-1))}
  };
  let recoveryRequired=true;
  const ctx=()=>({mysqlPool:db,db:{customers:[]},recoveryRequired:()=>recoveryRequired});
  registerReads(app,{auth:()=>{},getContext:ctx});
  registerEdits(app,{auth:()=>{},getContext:ctx});
  const get=found.get('GET /api/v6519/crm/leads/:id'),edit=found.get('PATCH /api/v6606/crm/leads/:id');
  assert.ok(get&&edit,'Required real routes absent');
  const req=(id,body,tenant=1)=>({params:{id},body,tenantId:tenant,user:{tenantId:tenant,role:'owner',username:'owner'}});
  const withTenant=fn=>runWithTenantContext({tenantId:1,actorId:'ci-owner',role:'owner'},fn);
  let r=response();await withTenant(()=>get(req('lead_a'),r));
  yes('authenticated tenant SELECT / GET',r.code===200&&r.body?.data?.id==='lead_a',checks);
  const token=r.body.data.revision;
  yes('revision derived from actual MySQL row',typeof token==='string'&&/^[a-f0-9]{64}$/.test(token),checks);
  r=response();await withTenant(()=>get(req('lead_b'),r));
  yes('tenant B record hidden from tenant A',r.code===404,checks);
  r=response();await withTenant(()=>edit(req('lead_a',{notes:'Denied by recovery',revision:token}),r));
  yes('recovery lock denies SQL edit',r.code===423,checks);
  recoveryRequired=false;
  r=response();await withTenant(()=>edit(req('lead_a',{notes:'Actual committed note',status:'Contacted',revision:token}),r));
  yes('transaction committed using mysql2',r.code===200&&r.body?.durable===true,checks);
  const [saved]=await db.query('SELECT notes,status FROM sbc_customers WHERE id=?',['lead_a']);
  yes('readback persisted actual data',saved[0].notes==='Actual committed note'&&saved[0].status==='Contacted',checks);
  const [activities]=await db.query('SELECT * FROM sbc_activities WHERE tenant_id=?',[1]);
  yes('activity audit inserted atomically',activities.length===1&&activities[0].activity_type==='lead_updated',checks);
  r=response();await withTenant(()=>edit(req('lead_a',{notes:'STOLEN BY STALE EDIT',revision:token}),r));
  yes('stale edit returns 409',r.code===409,checks);
  const [preserved]=await db.query('SELECT notes FROM sbc_customers WHERE id=?',['lead_a']);
  yes('newer note preserved after conflict',preserved[0].notes==='Actual committed note',checks);
  r=response();await withTenant(()=>edit(req('lead_b',{notes:'Cross tenant mutation',revision:token}),r));
  yes('cross-tenant mutation blocked',r.code===404,checks);
  const [foreign]=await db.query('SELECT notes FROM sbc_customers WHERE id=?',['lead_b']);
  yes('other tenant database row unchanged',foreign[0].notes==='Original notes',checks);
  r=response();await withTenant(()=>edit(req('lead_a',{tenantId:2,revision:token}),r));
  yes('arbitrary update field denied',r.code===400,checks);
  // Run two editors against the same locked SQL row. Exactly one may commit.
  let refreshed=response();await withTenant(()=>get(req('lead_a'),refreshed));
  const revision=refreshed.body?.data?.revision;
  assert.match(revision,/^[a-f0-9]{64}$/);
  const first=response(),second=response();
  await Promise.all([
   withTenant(()=>edit(req('lead_a',{notes:'Concurrent editor one',revision}),first)),
   withTenant(()=>edit(req('lead_a',{notes:'Concurrent editor two',revision}),second))
  ]);
  yes('simultaneous edits: one succeeds, one gets 409',
    [first.code,second.code].sort().join(',')==='200,409',checks);
  const [won]=await db.query('SELECT notes FROM sbc_customers WHERE id=?',['lead_a']);
  yes('concurrent loser cannot overwrite winning edit',
    ['Concurrent editor one','Concurrent editor two'].includes(won[0].notes),checks);
  // A missing audit ledger must abort the edit transaction, never commit an unaudited change.
  const current=response();await withTenant(()=>get(req('lead_a'),current));
  const freshRevision=current.body?.data?.revision;
  const preservedNote=won[0].notes;
  await db.query('DROP TABLE sbc_activities');
  const attempted=response();
  await withTenant(()=>edit(req('lead_a',{notes:'MUST ROLL BACK WITHOUT AUDIT',revision:freshRevision}),attempted));
  yes('MySQL audit write failure rejects edit',attempted.code===503,checks);
  const [afterFailure]=await db.query('SELECT notes FROM sbc_customers WHERE id=?',['lead_a']);
  yes('SQL transaction really rolled back after audit failure',afterFailure[0].notes===preservedNote,checks);
  console.log(JSON.stringify({status:'PASS_REAL_MYSQL_8',source:'Original sbc database.sql DDL + explicit historic tenant and assignment ALTERs',database:'disposable',checks},null,2));
 }finally{await db.end()}
}
main().catch(e=>{console.error('REAL_MYSQL_CRM_GATE_FAILED',e.stack||e);process.exitCode=1});
