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

test('archive capture is off by default and cannot be enabled without retention approval',async()=>{
 const {captureRollingSnapshot}=require('../enterprise/sbc-call-archive-v1.cjs');
 const conn={query(){throw Error('unexpected database access')}};
 assert.deepEqual(await captureRollingSnapshot(conn,'bad payload',{}),{enabled:false});
 await assert.rejects(captureRollingSnapshot(conn,'{"callLogs":[]}',{SBC_CALL_ARCHIVE_CAPTURE:'YES'}),/CALL_ARCHIVE_RETENTION_APPROVAL_REQUIRED/);
 await assert.rejects(captureRollingSnapshot(conn,'invalid',{SBC_CALL_ARCHIVE_CAPTURE:'YES',SBC_CALL_ARCHIVE_RETENTION_APPROVED:'YES',SBC_CALL_ARCHIVE_RETENTION_POLICY_REF:'fixture-only'}),/CALL_ARCHIVE_WORKSPACE_INVALID/);
});
test('explicit correction timestamp wins over the original autosave timestamp',()=>{
 const corrected=prepare({...row,updatedAt:'2026-11-24T14:01:00Z',outcomeCorrectedAt:'2026-11-24T14:02:00Z'});
 assert.equal(corrected.updated,Date.parse('2026-11-24T14:02:00Z'));
});
test('authoritative writer passes the exact rolling snapshot to archive within existing transaction',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const s=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const writer=s.slice(s.indexOf('async function writeRelational('),s.indexOf('async function mysqlKeepalive('));
 assert.match(writer,/await conn\.beginTransaction\(\);[\s\S]*const workspacePayload=JSON\.stringify\(extra\);[\s\S]*await SNAPSHOT_TENANTS\.persistCallArchive\(conn,workspacePayload\);[\s\S]*INSERT INTO sbc_workspace[\s\S]*\[workspacePayload\][\s\S]*await conn\.commit\(\)/);
 assert.match(writer,/callLogs:\(db\.callLogs\|\|\[\]\)\.slice\(0,1000\)/);
});

test('archive session recovery uses only the authenticated tenant and actor, not supplied overrides',async()=>{
 const {findSession}=require('../enterprise/sbc-call-archive-v1.cjs');
 const scope={tenantId:1,actorId:'rep',role:'caller'};
 const input={sessionId:'one',customerId:'lead',manualDial:false,tenantId:99,userId:'other'};
 const expected=prepare(row);
 const conn={async query(sql,args){
  assert.match(sql,/tenant_id=\? AND actor_id=\? AND session_key=\?/);
  assert.deepEqual(args,[1,'rep',expected.sessionKey]);
  return [[{payload_json:expected.json}]];
 }};
 assert.deepEqual(await findSession(conn,scope,input),expected.payload);
});
test('archive session recovery rejects invalid scope and identity before database access',async()=>{
 const {findSession}=require('../enterprise/sbc-call-archive-v1.cjs');
 const conn={query(){throw Error('unexpected database access')}};
 const scope={tenantId:1,actorId:'rep',role:'caller'};
 const input={sessionId:'one',customerId:'lead',manualDial:false};
 await assert.rejects(findSession(conn,{...scope,role:'lead_researcher'},input),/CALL_ARCHIVE_SCOPE_REQUIRED/);
 await assert.rejects(findSession(conn,scope,{...input,sessionId:''}),/CALL_ARCHIVE_FIELD_INVALID/);
 await assert.rejects(findSession(conn,scope,{...input,manualDial:true}),/CALL_ARCHIVE_IDENTITY_CONFLICT/);
 await assert.rejects(findSession(conn,scope,{...input,manualDial:'false'}),/CALL_ARCHIVE_FIELD_INVALID/);
});
test('archive session recovery returns null on a miss and refuses mismatched stored identity',async()=>{
 const {findSession}=require('../enterprise/sbc-call-archive-v1.cjs');
 const scope={tenantId:1,actorId:'rep',role:'owner'},input={sessionId:'one',customerId:'lead',manualDial:false};
 assert.equal(await findSession({async query(){return [[]]}},scope,input),null);
 const wrong=prepare({...row,userId:'other'});
 await assert.rejects(findSession({async query(){return [[{payload_json:wrong.json}]]}},scope,input),/CALL_ARCHIVE_IDENTITY_CONFLICT/);
});
