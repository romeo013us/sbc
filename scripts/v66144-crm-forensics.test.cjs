'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const FORENSICS=require('../enterprise/v66144-crm-forensics.cjs');
const POLICY=require('../enterprise/v66143-revenue-play-outreach-policy.cjs');
const STAGE=require('./v66144-stage-crm-forensics.cjs');
const now='2026-11-09T20:05:00.000Z';
const rows=[
 {id:'c1',tenantId:1,businessName:'Tekeyla Motor Sales',contactName:'Tekeyla Nelson',
  status:'Archived',email:'tekeyla@example.org',phone:'3055551111',source:'Walk-in',createdAt:'2026-09-16T12:00:00.000Z'},
 {id:'c2',tenantId:1,businessName:'Lorna \u0001 Bad Binary',contactName:'Data Import',
  phone:'3055552222',status:'Lead',source:'Lorna Research',createdByName:'Lorna',createdAt:now},
 {id:'c3',tenantId:1,businessName:'Spanish Café Éxito',contactName:'José Núñez',
  phone:'3055553333',status:'Lead',source:'Lorna Research',createdByName:'Lorna',createdAt:'2026-11-08T20:05:00Z'},
 {id:'c4',tenantId:2,businessName:'Do Not Disclose',phone:'3055554444',status:'Lead',source:'Lorna',createdAt:now}
];
const orders=[
 {id:'o1',tenantId:1,customerId:'c1',customerName:'Tekeyla',product:'Visibility',
  squareOrderId:'square-order-real',squarePaymentId:'square-payment-real',squarePaymentStatus:'COMPLETED',
  squarePaymentCompletedAt:now,price:99,notes:'{}'},
 {id:'o2',tenantId:1,customerId:'missing-customer',customerName:'Unknown',
  squarePaymentId:'historical-absent',notes:'{}',price:99},
 {id:'o3',tenantId:2,customerId:'c4',squarePaymentId:'foreign-123'}
];
const run=(over={})=>FORENSICS.inspect({tenantId:1,customers:rows,orders,...over});
const all=run();assert.equal(all.totalTenantCustomers,3);assert.equal(all.totalTenantOrders,2);
assert.equal(all.suspiciousTextRecords,1);assert.equal(all.rows[0].id,'c2');
assert.equal(all.rows[0].businessName,'[Review text integrity]');
assert.equal(all.rows[1].businessName,'Spanish Café Éxito');
assert.equal(all.orphanOrderCount,1);assert.equal(all.readOnly,true);
assert.equal(POLICY.suppressed(rows[1]),true,'historical corrupt identity must not be routable');
assert.equal(POLICY.suppressed(rows[2]),false,'Unicode accents remain legitimate');
assert.equal(run({query:'Tekeyla'}).rows[0].status,'Archived');
assert.equal(run({query:'1111'}).rows[0].id,'c1');
assert.equal(run({query:'square-payment-real'}).rows[0].id,'c1');
assert.equal(run({query:'historical-absent'}).matchedOrphanOrders[0].orderId,'o2');
assert.equal(run({status:'Archived'}).rows.length,1);
assert.equal(run({source:'Lorna',createdBy:'Lorna'}).rows.length,2);
assert.equal(run({from:'2026-11-09'}).rows.length,1);
assert.equal(run({limit:1,offset:1}).rows.length,1);
assert.equal(run({query:'Do Not Disclose'}).rows.length,0,'tenant 2 records hidden');
assert.equal(run({query:'not-here'}).notFoundInCurrentProjection,true);
assert.throws(()=>run({from:'invalid'}),/DATE_FILTER_INVALID/);
assert.throws(()=>FORENSICS.inspect({tenantId:0,customers:rows}),/TENANT_REQUIRED/);
const source=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8');
const patched=STAGE.patchServer(source);
assert.equal(STAGE.patchServer(patched),patched,'stage reapplication does not change runtime');
assert(patched.includes(STAGE.MARK));new vm.Script(patched);
if(process.argv.includes('--staged'))assert.equal(patched,source,'compiled stage must contain forensic route');
const a=patched.indexOf("app.get('/api/owner/crm/forensics'");
const b=patched.indexOf("app.get('/api/owner/lead-readiness'",a);
assert(a>0&&b>a);
let handler;let statements=[];
vm.runInNewContext(patched.slice(a,b),{
 app:{get(_path,_auth,_owner,cb){handler=cb}},auth(){},ownerOnly(){},
 requireRequestTenant:()=>1,
 db:{customers:rows,orders},
 mysqlPool:{async query(sql,args){statements.push(sql);assert.deepEqual(Array.from(args),[1]);return [[{n:sql.includes('sbc_customers')?3:2}]]}},
 require:()=>FORENSICS
});
assert.equal(typeof handler,'function');
(async()=>{
 let payload,status=200;
 const res={setHeader(){},json(v){payload=v;return this},status(n){status=n;return this}};
 await handler({query:{q:'Tekeyla'}},res);
 assert.equal(status,200);assert.equal(payload.rows[0].id,'c1');
 assert.equal(payload.sqlTenantCustomers,3);assert.equal(payload.sqlTenantOrders,2);
 assert.equal(payload.projectionCountMismatch,false);
 assert.equal(statements.length,2);
 assert(statements.every(s=>/^SELECT COUNT\(\*\)/.test(s)));
 console.log('PASS V66.144: owner read-only CRM search, corrupt suppression, temporal and tenant proof');
})().catch(e=>{console.error(e);process.exitCode=1});
