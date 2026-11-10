'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MODEL=require('../enterprise/v66146-crm-id-reconciliation.cjs');
const STAGE=require('./v66148-stage-crm-softdelete-accounting.cjs');
const FORENSICS=require('../enterprise/v66144-crm-forensics.cjs');
const customers=[
 {id:'c1',tenantId:1,status:'Lead',businessName:'Real Lead'},
 {id:'c2',tenantId:1,status:'Archived',businessName:'Archive'},
 {id:'foreign',tenantId:2,status:'Lead',businessName:'Foreign Name'}];
const orders=[{id:'o1',tenantId:1,status:'Paid'},{id:'other',tenantId:2,status:'Paid'}];
const inspect=(over={})=>MODEL.inspect({tenantId:1,customers,orders,
 sqlCustomers:[{id:'c1',status:'Lead'},{id:'c2',status:'Archived'},{id:'old',status:'Deleted'}],
 sqlOrders:[{id:'o1',status:'Paid'}],sqlCustomerCount:3,sqlOrderCount:1,...over});
let d=inspect();
assert.equal(d.customerIds.sqlOnlyCount,1);
assert.equal(d.customerIds.sqlOnlyDeletedTombstones,1);
assert.equal(d.customerIds.sqlOnlyUnexplained,0);
assert.equal(d.customerIds.expectedSoftDeleteExclusionOnly,true);
assert.equal(d.customerIds.evidenceState,'SQL_DELETED_TOMBSTONES_EXCLUDED_AS_DESIGNED');
assert.equal(d.explainedBySoftDeletedTombstones,true);
assert.equal(d.rawCountMismatchDetected,true);
assert.equal(d.mismatchDetected,false,'soft deleted SQL history must not trigger missing-live-record alarm');
assert(!JSON.stringify(d).includes('Foreign Name'),'no other-tenant disclosure');
d=inspect({sqlCustomers:[{id:'c1',status:'Lead'},{id:'c2',status:'Archived'},{id:'lost',status:'Lead'}]});
assert.equal(d.customerIds.sqlOnlyDeletedTombstones,0);
assert.equal(d.customerIds.sqlOnlyUnexplained,1);
assert.equal(d.mismatchDetected,true,'live SQL-only lead remains an alarm');
d=inspect({sqlCustomers:[{id:'c1',status:'Lead'},{id:'c2',status:'Archived'},{id:'unknown'}]});
assert.equal(d.customerIds.sqlOnlyUnexplained,1,'unobserved status MUST NOT be called Deleted');
assert.equal(d.mismatchDetected,true);
d=inspect({sqlCustomers:[{id:'c1',status:'Lead'},{id:'c2',status:'Archived'},{id:'old',status:'Deleted'}],
 sqlOrders:[{id:'o1',status:'Paid'},{id:'gone',status:'Deleted'}],sqlOrderCount:2});
assert.equal(d.orderIds.expectedSoftDeleteExclusionOnly,true);
assert.equal(d.mismatchDetected,false);
d=inspect({sqlCustomerCount:4});
assert.equal(d.customerIds.completeIdComparison,false);
assert.equal(d.customerIds.sqlOnlyDeletedTombstones,null,'never certify incomplete SQL window');

const file=path.resolve(__dirname,'../server.js'),source=fs.readFileSync(file,'utf8');
assert(source.includes("SELECT * FROM sbc_customers WHERE COALESCE(status,'') <> 'Deleted'"),'existing loader deliberately excludes tombstones');
const staged=STAGE.patchServer(source);
assert.equal(STAGE.patchServer(staged),staged,'stage reapplication is idempotent');
assert(staged.includes(STAGE.MARK));
assert(staged.includes("SELECT id,status FROM sbc_customers WHERE tenant_id=?"));
assert(staged.includes("SELECT id,status FROM sbc_orders WHERE tenant_id=?"));
assert(staged.includes("assessPersistenceSafety(visibleCore,sourceCore)"));
assert(staged.includes("visibleCounts:visibleCore"),'raw backup census must also preserve visible counts');
assert(staged.includes("counts:authoritativeCore"),'full SQL backup snapshot remains intact');
new vm.Script(staged,{filename:'staged-v66148-server.js'});
if(process.argv.includes('--staged'))assert.equal(staged,source,'compiled release must contain tombstone fix');

const start=staged.indexOf("app.get('/api/owner/crm/forensics'");
const end=staged.indexOf('// SBC_V66144_ORDER_DELIVERY_ACCEPTANCE',start);
assert(start>0&&end>start);
let handler;const queries=[];
vm.runInNewContext(staged.slice(start,end),{
 app:{get(route,auth,owner,fn){assert.equal(route,'/api/owner/crm/forensics');handler=fn}},
 auth(){},ownerOnly(){},requireRequestTenant:()=>1,db:{customers,orders},
 mysqlPool:{async query(sql,args){
  queries.push(sql);assert.deepEqual(Array.from(args),[1]);
  if(sql.includes('sbc_customers'))return [[{n:sql.includes('COALESCE')?2:3}]];
  if(sql.includes('sbc_orders'))return [[{n:1}]];
  throw Error('UNEXPECTED_SQL');
 }},
 require:p=>{assert.equal(p,'./enterprise/v66144-crm-forensics.cjs');return FORENSICS;}
});
(async()=>{
 let response,code=200;const res={setHeader(){},status(n){code=n;return this},json(x){response=x;return this}};
 await handler({query:{q:'this-is-not-an-active-lead'}},res);
 assert.equal(code,200);assert.equal(response.projectionCountMismatch,false);
 assert.equal(response.sqlTenantCustomers,3);assert.equal(response.sqlVisibleTenantCustomers,2);
 assert.equal(response.sqlDeletedCustomerTombstones,1);
 assert.equal(response.notFoundInCurrentProjection,true);
 assert(queries.length===4&&queries.every(q=>/^SELECT COUNT\(\*\)/.test(q)&&q.includes('tenant_id=?')));
 console.log('PASS V66.148: status-aware SQL forensic proof, safe deleted exclusions, unchanged raw backups, live-count guard and SELECT-only tenant route');
})().catch(e=>{console.error(e);process.exitCode=1});
