'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createMysqlHandoffRepository}=require('../enterprise/sbc-lorna-handoff-mysql-v1.cjs');
const customer=async(t,id)=>({id,tenantId:t,assignedTo:'lorna',leadAssistStatus:'AUTO_VERIFIED'});
const worker=async(t,id)=>({id,tenantId:t,role:id==='lorna'?'lead_researcher':'account_manager',active:true});
test('hand-off adapter preserves existing CRM as read-only and requires transactional writer',()=>{
 assert.throws(()=>createMysqlHandoffRepository({pool:{query:()=>{}},lookupCustomer:customer,lookupWorker:worker}),/TRANSACTIONAL_MYSQL_WRITER_REQUIRED/);
});
test('atomic manager assignment updates both handoff and account ownership, tenant-scoped',async()=>{
 const calls=[];const conn={beginTransaction:async()=>calls.push('BEGIN'),commit:async()=>calls.push('COMMIT'),rollback:async()=>calls.push('ROLLBACK'),release:()=>calls.push('RELEASE'),query:async(sql,args)=>{calls.push({sql,args});if(sql.startsWith('UPDATE sbc_lead_handoffs_v1'))return [{affectedRows:1}];if(sql.startsWith('SELECT customer_id,researcher_id FROM sbc_lead_handoffs_v1'))return [[{customer_id:'c1',researcher_id:'lorna'}]];if(sql.startsWith('SELECT * FROM sbc_lead_handoffs_v1'))return [[{tenant_id:1,id:'h1',customer_id:'c1',researcher_id:'lorna',manager_id:'alice',status:'ASSIGNED',created_at:'2026-11-13T15:00:00Z',updated_at:'2026-11-13T15:00:00Z'}]];return [{affectedRows:1}]} };
 const pool={query:conn.query,getConnection:async()=>conn};const repo=createMysqlHandoffRepository({pool,lookupCustomer:customer,lookupWorker:worker});
 const row=await repo.changeHandoff(1,'h1','READY_FOR_REVIEW','ASSIGNED',{managerId:'alice',updatedAt:'2026-11-13T15:00:00Z'});
 assert.equal(row.status,'ASSIGNED');assert(calls.includes('COMMIT'));assert(!calls.includes('ROLLBACK'));
 const ownership=calls.find(c=>typeof c==='object'&&c.sql.startsWith('INSERT INTO sbc_account_ownership_v1'));
 assert(ownership);assert.deepEqual(ownership.args.slice(0,3),[1,'c1','alice']);
});
test('failed ownership persistence rolls back the handoff transaction',async()=>{
 let rolled=false,committed=false;const conn={beginTransaction:async()=>{},commit:async()=>{committed=true},rollback:async()=>{rolled=true},release:()=>{},query:async sql=>{if(sql.startsWith('UPDATE sbc_lead_handoffs_v1'))return [{affectedRows:1}];if(sql.startsWith('SELECT customer_id,researcher_id FROM sbc_lead_handoffs_v1'))return [[{customer_id:'c1',researcher_id:'lorna'}]];throw Error('db failure')}};
 const repo=createMysqlHandoffRepository({pool:{query:conn.query,getConnection:async()=>conn},lookupCustomer:customer,lookupWorker:worker});
 await assert.rejects(repo.changeHandoff(1,'h1','READY_FOR_REVIEW','ASSIGNED',{managerId:'alice',updatedAt:'2026-11-13T15:00:00Z'}));
 assert.equal(rolled,true);assert.equal(committed,false);
});
test('handoff and feedback paths always filter by tenant and never alter sbc_customers',async()=>{
 const calls=[];const conn={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},query:async(sql,args)=>{calls.push({sql,args});return [sql.includes('SELECT')?[]:{affectedRows:0}]} };
 const repo=createMysqlHandoffRepository({pool:{query:conn.query,getConnection:async()=>conn},lookupCustomer:customer,lookupWorker:worker});
 await repo.handoffForCustomer(5,'c7');await repo.feedbackForResearcher(5,'lorna');await repo.handoffs(5);
 assert(calls.every(x=>/tenant_id\s*=\s*\?/i.test(x.sql)));assert(calls.every(x=>!/(UPDATE|DELETE|INSERT INTO)\s+sbc_customers\b/i.test(x.sql)));
});

test('research-return SQL checks current account ownership atomically, never the stale handoff manager',async()=>{
 const calls=[];const conn={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},query:async(sql,args)=>{
  calls.push({sql,args});if(sql.startsWith('UPDATE sbc_lead_handoffs_v1 h INNER JOIN'))return [{affectedRows:1}];
  if(sql.startsWith('SELECT * FROM sbc_research_feedback_v1'))return [[{tenant_id:1,id:'fb1',handoff_id:'h1',customer_id:'c1',researcher_id:'lorna',manager_id:'bob',status:'OPEN',created_at:'2026-11-13T18:00:00Z'}]];
  return [{affectedRows:1}];
 }};
 const repo=createMysqlHandoffRepository({pool:{query:conn.query,getConnection:async()=>conn},lookupCustomer:customer,lookupWorker:worker});
 await repo.returnFeedback({id:'h1',customerId:'c1',tenantId:1,managerId:'alice'},
  {id:'fb1',handoffId:'h1',customerId:'c1',tenantId:1,researcherId:'lorna',managerId:'bob',issue:'BAD_NUMBER',reason:'Disconnected',status:'OPEN',createdAt:'2026-11-13T18:00:00Z'},'2026-11-13T18:00:00Z');
 const guarded=calls.find(c=>c.sql.startsWith('UPDATE sbc_lead_handoffs_v1 h INNER JOIN'));
 assert(guarded,'handoff mutation must join authoritative account ownership');
 assert.match(guarded.sql,/o\.tenant_id=h\.tenant_id AND o\.customer_id=h\.customer_id/);
 assert.match(guarded.sql,/o\.manager_id=\?/);
 assert.deepEqual(guarded.args.slice(-3),[1,'h1','bob'],'use current manager, not original handoff owner');
});
