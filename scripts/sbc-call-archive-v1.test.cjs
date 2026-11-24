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

test('archive history read is explicitly gated and never silently falls back',async()=>{
 const {readHistory}=require('../enterprise/sbc-call-archive-v1.cjs');
 const scope={tenantId:1,actorId:'rep',role:'caller'};
 const conn={query(){throw Error('unexpected database access')}};
 const env={SBC_CALL_ARCHIVE_CAPTURE:'YES',SBC_CALL_ARCHIVE_RETENTION_APPROVED:'YES',SBC_CALL_ARCHIVE_RETENTION_POLICY_REF:'fixture',SBC_CALL_ARCHIVE_READ:'YES'};
 await assert.rejects(readHistory(conn,scope,{},{}),/CALL_ARCHIVE_READ_DISABLED/);
 await assert.rejects(readHistory(conn,scope,{}, {...env,SBC_CALL_ARCHIVE_RETENTION_APPROVED:'NO'}),/CALL_ARCHIVE_READ_DISABLED/);
 await assert.rejects(readHistory(conn,{...scope,role:'lead_researcher'},{},env),/CALL_ARCHIVE_SCOPE_REQUIRED/);
 await assert.rejects(readHistory(null,scope,{},env),/CALL_ARCHIVE_READ_UNAVAILABLE/);
});
test('archive history returns compatible paginated ledger rows, scoped to the authenticated actor',async()=>{
 const {readHistory}=require('../enterprise/sbc-call-archive-v1.cjs');
 const env={SBC_CALL_ARCHIVE_CAPTURE:'YES',SBC_CALL_ARCHIVE_RETENTION_APPROVED:'YES',SBC_CALL_ARCHIVE_RETENTION_POLICY_REF:'fixture',SBC_CALL_ARCHIVE_READ:'YES'};
 const scope={tenantId:1,actorId:'rep',role:'caller'};
 const conn={async query(sql,args){
  assert.match(sql,/a\.tenant_id=\? AND a\.actor_id=\?/);
  assert.deepEqual(args.slice(0,2),[1,'rep']);
  if(sql.includes('COUNT(*)'))return [[{total:2}]];
  return [[{payload_json:prepare(row).json,business_name:'Synthetic Business'}]];
 }};
 const result=await readHistory(conn,scope,{limit:1,tenantId:9,callerId:'other'},env);
 assert.equal(result.ok,true);assert.equal(result.source,'sql_archive');assert.equal(result.total,2);
 assert.equal(result.nextOffset,1);assert.equal(result.rows[0].number,row.to);
 assert.equal(result.rows[0].businessName,'Synthetic Business');assert.equal(result.rows[0].id,row.id);
 assert.equal(Object.hasOwn(result.rows[0],'sessionId'),false);
});
test('existing sales history endpoint preserves rolling default and explicit archive read',()=>{
 const s=require('node:fs').readFileSync(require('node:path').join(__dirname,'../server.js'),'utf8');
 const route=s.slice(s.indexOf("app.get('/api/sales/call-history'"),s.indexOf("app.post('/api/call-reports'"));
 assert.match(route,/auth,async\(req,res\)/);
 assert.match(route,/requireRequestTenant\(req\)/);
 assert.match(route,/req\.query\.source==='archive'/);
 assert.match(route,/readHistory\(mysqlPool,\{tenantId:tenant,actorId:req\.user\.id,role\}/);
 assert.match(route,/SBC_VOICE_LEDGER\.list/);
 assert.match(route,/Cache-Control','no-store'/);
});

test('dialed history UI can select the archive and paginate without changing records',async()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const source=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 const start=source.indexOf('async function loadSbcCallLedger('),end=source.indexOf('function big3EcosystemView(',start);
 assert(start>=0&&end>start);
 const fields={sbcDialHistorySource:{value:'archive'},sbcDialHistoryNumber:{value:'305555'},sbcDialHistoryBusiness:{value:'Synthetic'},sbcDialHistoryFrom:{value:'2026-11-01'},sbcDialHistoryTo:{value:'2026-11-24'},sbcDialHistoryOutcome:{value:'Spanish callback needed'},sbcDialHistoryCaller:{value:'rep'}};
 const host={isConnected:true,innerHTML:''},urls=[];
 const ctx={URLSearchParams,state:{data:{customers:[{id:'c1'}]}},$:id=>id==='#sbcDialedNumberLedger'?host:fields[id.slice(1)],esc:v=>String(v??''),api:async url=>{urls.push(url);return {ok:true,source:'sql_archive',total:1001,offset:50,limit:50,nextOffset:100,rows:[{id:'old',customerId:'c1',number:'3055550100',notes:'Synthetic notes'}],retentionNote:'Retained SQL archive only'};}};
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
 await ctx.loadSbcCallLedger(50);
 const params=new URLSearchParams(urls[0].split('?')[1]);
 assert.equal(params.get('source'),'archive');assert.equal(params.get('offset'),'50');
 assert.equal(params.get('business'),'Synthetic');assert.equal(params.get('callerId'),'rep');
 assert.equal(params.get('from'),'2026-11-01');assert.equal(params.get('outcome'),'Spanish callback needed');
 assert.match(host.innerHTML,/Retained SQL archive only/);assert.match(host.innerHTML,/loadSbcCallLedger\(100\)/);assert.match(host.innerHTML,/loadSbcCallLedger\(0\)/);
 assert.doesNotMatch(host.innerHTML,/Move to Spanish Queue/);
});
test('archive history UI retains controls on error and never silently falls back',async()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const source=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 const start=source.indexOf('async function loadSbcCallLedger('),end=source.indexOf('function big3EcosystemView(',start);
 const host={isConnected:true,innerHTML:''},urls=[];
 const ctx={URLSearchParams,state:{data:{}},$:id=>id==='#sbcDialedNumberLedger'?host:id==='#sbcDialHistorySource'?{value:'archive'}:null,esc:v=>String(v??''),api:async url=>{urls.push(url);throw Error('CALL_ARCHIVE_READ_DISABLED')}};
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);await ctx.loadSbcCallLedger();
 assert.equal(urls.length,1);assert.match(urls[0],/source=archive/);
 assert.match(host.innerHTML,/sbcDialHistorySource/);assert.match(host.innerHTML,/CALL_ARCHIVE_READ_DISABLED/);
 assert.doesNotMatch(host.innerHTML,/0 SAVED ATTEMPTS/);
});
test('call history UI is mirrored for compiled deployment',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const root=path.join(__dirname,'..');
 assert.equal(fs.readFileSync(path.join(root,'public/app.js'),'utf8'),fs.readFileSync(path.join(root,'browser_public/app.js'),'utf8'));
});
