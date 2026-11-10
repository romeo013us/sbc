'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=require('../enterprise/v66146-crm-id-reconciliation.cjs');
const STAGE=require('./v66146-stage-crm-id-reconciliation.cjs');
const sample=[
 {id:'c1',tenantId:1,businessName:'Old Archive',source:'Walk In',status:'Archived'},
 {id:'c2',tenantId:1,businessName:'Bad \u0002 Control',status:'Lead'},
 {id:'c3',tenantId:1,businessName:'Café Bien',status:'Lead'},
 {id:'hidden',tenantId:2,businessName:'Other Tenant',status:'Lead'}];
const orders=[{id:'o1',tenantId:1},{id:'o2',tenantId:1},{id:'oForeign',tenantId:2}];
const run=(o={})=>R.inspect({tenantId:1,customers:sample,orders,
 sqlCustomers:[{id:'c1'},{id:'c2'},{id:'c4'}],sqlOrders:[{id:'o1'},{id:'o2'}],
 sqlCustomerCount:3,sqlOrderCount:2,...o});
let x=run();
assert.equal(x.readOnly,true);assert.equal(x.noRecordsChanged,true);
assert.equal(x.customerIds.sqlOnlyCount,1);assert.deepEqual(x.customerIds.sqlOnlySample,['c4']);
assert.equal(x.customerIds.projectionOnlyCount,1);assert.deepEqual(x.customerIds.projectionOnlySample,['c3']);
assert.equal(x.orderIds.sqlOnlyCount,0);assert.equal(x.orderIds.projectionOnlyCount,0);
assert.equal(x.suspiciousTextRecords,1);assert.equal(x.suspiciousSample[0].id,'c2');
assert(x.suspiciousSample[0].fields.includes('businessName'));
assert(!JSON.stringify(x).includes('Other Tenant'));
assert(!JSON.stringify(x).includes('Bad \\u0002 Control'),'do not leak corrupt business string');
assert.equal(x.customerIds.sqlCount,3);assert.equal(x.customerIds.projectionCount,3);
assert.equal(x.mismatchDetected,true);
x=run({sqlCustomers:[{id:'c1'},{id:'c2'},{id:'c3'}]});
assert.equal(x.customerIds.evidenceState,'PROJECTION_SQL_IDS_AGREE_AT_READ_TIME');
assert.equal(x.mismatchDetected,false,'suspicious records stay visible but do not create fake ID mismatch');
x=run({sqlCustomerCount:4});
assert.equal(x.customerIds.completeIdComparison,false);
assert.equal(x.customerIds.sqlOnlyCount,null,'non-atomic count mismatch cannot claim exhaustive ID sets');
x=run({sqlCustomers:Array.from({length:2001},(_,i)=>({id:'c'+(i+1)})),sqlCustomerCount:2001});
assert.equal(x.customerIds.completeIdComparison,false);
assert.equal(x.customerIds.evidenceState,'INCOMPLETE_SQL_ID_WINDOW');
assert.throws(()=>run({tenantId:0}),/CRM_RECON_TENANT_REQUIRED/);
assert.throws(()=>run({sqlCustomerCount:NaN}),/CRM_RECON_SQL_COUNT_INVALID/);
const src=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8');
const staged=STAGE.patchServer(src);
assert.equal(STAGE.patchServer(staged),staged,'stage idempotent');
assert(staged.includes(STAGE.MARK));new vm.Script(staged,{filename:'staged-server.js'});
if(process.argv.includes('--staged'))assert.equal(staged,src,'compiled source must contain ID reconcile route');
const start=staged.indexOf("app.get('/api/owner/crm/reconcile-ids'");
const end=staged.indexOf("app.get('/api/owner/lead-readiness'",start);
assert(start>0&&end>start);
let handler;
const queries=[];
vm.runInNewContext(staged.slice(start,end),{
 app:{get(p,_auth,_owner,fn){assert.equal(p,'/api/owner/crm/reconcile-ids');handler=fn;}},
 auth(){},ownerOnly(){},requireRequestTenant:()=>1,
 db:{customers:sample,orders},
 mysqlPool:{async query(sql,args){
  queries.push(sql);assert.deepEqual(Array.from(args),[1]);
  if(sql.startsWith('SELECT COUNT(*)')&&sql.includes('sbc_customers'))return [[{n:3}]];
  if(sql.startsWith('SELECT COUNT(*)')&&sql.includes('sbc_orders'))return [[{n:2}]];
  if(sql.startsWith('SELECT id')&&sql.includes('sbc_customers'))return [[{id:'c1'},{id:'c2'},{id:'c4'}]];
  if(sql.startsWith('SELECT id')&&sql.includes('sbc_orders'))return [[{id:'o1'},{id:'o2'}]];
  throw Error('UNEXPECTED_SQL '+sql);
 }},
 require:p=>{assert.equal(p,'./enterprise/v66146-crm-id-reconciliation.cjs');return R;}
});
assert.equal(typeof handler,'function');
(async()=>{
 let payload,code=200;
 const res={setHeader(k,v){assert.equal(k,'Cache-Control');assert.equal(v,'no-store')},
  status(n){code=n;return this},json(v){payload=v;return this}};
 await handler({query:{}},res);
 assert.equal(code,200);
 assert.equal(payload.customerIds.sqlOnlyCount,1);assert.equal(payload.customerIds.projectionOnlyCount,1);
 assert.equal(queries.length,4);
 assert(queries.every(sql=>/^SELECT (?:COUNT\(\*\)|id) /u.test(sql)));
 assert(queries.every(sql=>sql.includes('WHERE tenant_id=?')));
 console.log('PASS V66.146: exact tenant ID differences, suspicious field IDs, limits, non-atomic warnings and SQL-only route');
})().catch(e=>{console.error(e);process.exitCode=1});
