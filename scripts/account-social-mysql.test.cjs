'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {createMysqlRepository}=require('../enterprise/sbc-account-social-mysql.cjs');
const tenant1={tenantId:1,id:'c1',businessName:'Right tenant'};
const lookupCustomer=async(t,id)=>id==='c1'?tenant1:null;
const lookupWorker=async(t,id)=>id==='am1'?{tenantId:1,id:'am1',role:'account_manager'}:null;
test('adapter rejects missing existing-CRM dependencies, never invents a new CRM',()=>{
 assert.throws(()=>createMysqlRepository({pool:{query:async()=>[[]]}}),/tenant-scoped existing CRM/);
});
test('scoped existing CRM reader excludes wrong tenant even if callback returns a row',async()=>{
 const r=createMysqlRepository({pool:{query:async()=>[[]]},lookupCustomer,lookupWorker});
 assert.equal((await r.customer(1,'c1')).businessName,'Right tenant');
 assert.equal(await r.customer(2,'c1'),null);
 assert.equal(await r.worker(2,'am1'),null);
});
test('ownership upsert is parameterized, composite tenant/customer scoped, without implicit migrations',async()=>{
 const calls=[];const pool={query:async(sql,params)=>(calls.push([sql,params]),[{affectedRows:1}])};
 const r=createMysqlRepository({pool,lookupCustomer,lookupWorker});
 assert.equal(calls.length,0);
 await r.saveAssignment({tenantId:1,customerId:'c1',managerId:'am1',assignedBy:'owner',updatedAt:'2026-11-13T20:00:00Z'});
 const [sql,params]=calls[0];assert.match(sql,/ON DUPLICATE KEY UPDATE/);
 assert.match(sql,/sbc_account_ownership_v1/);assert.equal(params[0],1);assert.equal(params[1],'c1');
 assert(!/DROP|ALTER|CREATE TABLE|TRUNCATE/i.test(sql));
});
test('due publishing claims use CAS with tenant and status predicates and update attempts once',async()=>{
 const calls=[];
 const pool={query:async(sql,params)=>{
  calls.push({sql,params});
  if(sql.startsWith('SELECT id FROM sbc_social_posts_v1'))return [[{id:'post1'}]];
  if(sql.startsWith('UPDATE sbc_social_posts_v1 SET status=\'PUBLISHING\''))return [{affectedRows:1}];
  if(sql.startsWith('SELECT * FROM sbc_social_posts_v1'))return [[{id:'post1',tenant_id:1,customer_id:'c1',channel_id:'channel',platform:'facebook',status:'PUBLISHING',attempts:1}]];
  throw Error('unexpected SQL '+sql);
 }};
 const r=createMysqlRepository({pool,lookupCustomer,lookupWorker});
 const claim=await r.claimDue(1,'2026-11-13T20:00:00Z',3);
 assert.equal(claim.length,1);assert.equal(claim[0].attempts,1);
 assert.match(calls[1].sql,/tenant_id=\?/);assert.match(calls[1].sql,/status='SCHEDULED'/);assert.match(calls[1].sql,/approved_at IS NOT NULL/);
 assert.equal(calls[1].params[0],1);
});
test('failed CAS claim never publishes and returns empty',async()=>{
 const pool={query:async(sql)=>sql.startsWith('SELECT id FROM sbc_social_posts_v1')?[[{id:'post1'}]]:[{affectedRows:0}]};
 const r=createMysqlRepository({pool,lookupCustomer,lookupWorker});
 assert.deepEqual(await r.claimDue(1,'2026-11-13T20:00:00Z',1),[]);
});
