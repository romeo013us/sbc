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
  // Lead-creation columns are added by SBC's later CRM schema migrations.
  await db.query("ALTER TABLE sbc_customers ADD COLUMN website VARCHAR(500) NOT NULL DEFAULT ''");
  await db.query("ALTER TABLE sbc_customers ADD COLUMN address VARCHAR(500) NOT NULL DEFAULT ''");
  await db.query("ALTER TABLE sbc_customers ADD COLUMN industry VARCHAR(120) NOT NULL DEFAULT ''");
  await db.query('ALTER TABLE sbc_customers ADD COLUMN deal_value DECIMAL(12,2) NOT NULL DEFAULT 0.00');
  await db.query("ALTER TABLE sbc_customers ADD COLUMN website_status VARCHAR(120) NOT NULL DEFAULT ''");
  await db.query('ALTER TABLE sbc_customers ADD COLUMN lead_intelligence_json LONGTEXT NULL');
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
  const create=found.get('POST /api/v65110/crm/leads');
  assert.ok(get&&edit&&create,'Required real routes absent');
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
  // New-lead creation must be tenant-authenticated and duplicate-safe under real concurrency.
  const newLead={businessName:'SBC CI Duplicate Test LLC',contactName:'Taylor',phone:'3055558877',email:'ci-duplicate@example.org',website:'https://example.org',notes:'CI only'};
  const createReq=(tenant=1)=>({body:{...newLead},tenantId:tenant,user:{role:'owner',tenantId:tenant,username:'owner'}});
  const firstNew=response(),secondNew=response();
  await Promise.all([
   withTenant(()=>create(createReq(1),firstNew)),
   withTenant(()=>create(createReq(1),secondNew))
  ]);
  yes('simultaneous identical creations: exactly one committed',
    [firstNew.code,secondNew.code].sort().join(',')==='201,409',checks);
  const [oneCreated]=await db.query('SELECT COUNT(*) total FROM sbc_customers WHERE tenant_id=? AND business_name=?',[1,newLead.businessName]);
  yes('exactly one duplicate lead exists in tenant A',Number(oneCreated[0].total)===1,checks);
  const [createEvents]=await db.query('SELECT COUNT(*) total FROM sbc_activities WHERE tenant_id=? AND activity_type=?',[1,'lead_created']);
  yes('only successful creation has durable activity event',Number(createEvents[0].total)===1,checks);
  const [lockState]=await db.query('SELECT IS_FREE_LOCK(?) AS available',['sbc_crm_create_tenant_1']);
  yes('MySQL lead-create mutex released after simultaneous requests',Number(lockState[0].available)===1,checks);
  const outside=response();await runWithTenantContext({tenantId:2,actorId:'ci-tenant-2',role:'owner'},()=>create(createReq(2),outside));
  yes('different tenant may own independently named lead',outside.code===201&&outside.body?.tenantId===2,checks);
  const [twoCreated]=await db.query('SELECT COUNT(*) total FROM sbc_customers WHERE tenant_id=? AND business_name=?',[2,newLead.businessName]);
  yes('cross-tenant duplicate check does not prevent valid tenant B lead',Number(twoCreated[0].total)===1,checks);
  const mismatch=response();await withTenant(()=>create(createReq(2),mismatch));
  yes('session/ALS tenant mismatch fails closed on create',mismatch.code===403,checks);
  const noTenant=response();await create(createReq(1),noTenant);
  yes('missing authenticated tenant context fails closed on create',noTenant.code===403,checks);
  recoveryRequired=true;
  const held=response();await withTenant(()=>create({...createReq(1),body:{...newLead,businessName:'Recovery must block'}},held));
  yes('recovery guard denies new lead creation',held.code===423,checks);
  recoveryRequired=false;

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
  // Verify the *actual* SQL used by the voice logger's authoritative
  // sbc_workspace readback. A stale/local-only snapshot must not report success.
  await db.query('CREATE TABLE sbc_workspace (id INT PRIMARY KEY, payload LONGTEXT NOT NULL)');
  const savedCall={id:'ci-log1',tenantId:1,status:'in-progress',notes:'Signed call note',outcome:'Interested'};
  await db.query('INSERT INTO sbc_workspace(id,payload) VALUES(1,?)',[JSON.stringify({callLogs:[savedCall]})]);
  const voiceConfirmSql="SELECT JSON_CONTAINS(payload,JSON_OBJECT('id',?,'tenantId',?,'status',?,'notes',?,'outcome',?),'$.callLogs') AS confirmed FROM sbc_workspace WHERE id=1";
  const queryConfirm=async(row)=>{
   const [rows]=await db.query(voiceConfirmSql,[row.id,row.tenantId,row.status,row.notes,row.outcome]);
   return Number(rows?.[0]?.confirmed||0);
  };
  yes('voice log MySQL JSON_CONTAINS confirms durable call',await queryConfirm(savedCall)===1,checks);
  yes('voice log MySQL proof rejects stale notes',await queryConfirm({...savedCall,notes:'Unsaved local note'})===0,checks);
  yes('voice log MySQL proof rejects wrong tenant',await queryConfirm({...savedCall,tenantId:2})===0,checks);
  console.log(JSON.stringify({status:'PASS_REAL_MYSQL_8',source:'Original sbc database.sql DDL + explicit historic tenant and assignment ALTERs',database:'disposable',checks},null,2));
 }finally{await db.end()}
}
main().catch(e=>{console.error('REAL_MYSQL_CRM_GATE_FAILED',e.stack||e);process.exitCode=1});
