'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {prepare,queryPlan,appendBatch}=require('../enterprise/sbc-call-archive-v1.cjs');
const row={tenantId:1,id:'a',userId:'rep',customerId:'lead',sessionId:'one',status:'ended',outcome:'Pending',to:'+13055550100',endedAt:'2026-11-24T14:00:00Z'};
test('stable identity and revision hash distinguish correction from replay',()=>{
 const a=prepare(row),b=prepare({...row,notes:'correction'});
 assert.equal(a.sessionKey,b.sessionKey);assert.notEqual(a.revisionHash,b.revisionHash);
 assert.equal(prepare({...row,unknown:'not saved'}).revisionHash,a.revisionHash);
 assert.equal(prepare({...row,endedAt:'invalid'}).occurred,null);
 assert.throws(()=>prepare({...row,tenant_id:2}),/CALL_ARCHIVE_TENANT_INVALID/);
 assert.throws(()=>prepare({...row,manualDial:true}),/CALL_ARCHIVE_IDENTITY_CONFLICT/);
});
test('scope cannot be overridden by query filters and invalid dates fail closed',()=>{
 const p=queryPlan({tenantId:1,role:'caller',actorId:'rep'},{tenantId:2,callerId:'other',number:'305555',from:'2026-11-24'});
 assert.deepEqual(p.args,[1,'rep','305555',Date.parse('2026-11-24T00:00:00Z')]);
 assert.match(p.where,/a\.tenant_id=\? AND a\.actor_id=\?/);
 assert.throws(()=>queryPlan({tenantId:1,role:'lead_researcher',actorId:'rep'}),/CALL_ARCHIVE_SCOPE_REQUIRED/);
 assert.throws(()=>queryPlan({tenantId:1,role:'owner',actorId:'owner'},{from:'2026-02-30'}),/CALL_ARCHIVE_DATE_INVALID/);
 assert.throws(()=>queryPlan({tenantId:1,role:'owner',actorId:'owner'},{limit:'2.5'}),/CALL_ARCHIVE_PAGE_INVALID/);
});
test('duplicate sessions and record IDs are refused before database access',async()=>{
 const conn={query(){throw Error('unexpected database access')}};
 await assert.rejects(appendBatch(conn,[row,{...row,id:'other'}]),/CALL_ARCHIVE_SESSION_CONFLICT/);
 await assert.rejects(appendBatch(conn,[row,row]),/CALL_ARCHIVE_DUPLICATE_INPUT/);
});
