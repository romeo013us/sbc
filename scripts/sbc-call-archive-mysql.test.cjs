'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const archive=require('../enterprise/sbc-call-archive-v1.cjs');
test('isolated MySQL: 10,000 call attempts, revision retention, replay, rollback and scoped history after reconnect',{skip:process.env.SBC_CALL_ARCHIVE_MYSQL_CI!=='YES'},async()=>{
 assert.equal(process.env.CI,'true');
 const mysql=require('mysql2/promise');
 const config={host:'127.0.0.1',port:3306,user:'root',password:process.env.SBC_V6682_CI_MYSQL_PASSWORD,database:'sbc_v6682_ci'};
 assert(config.password);
 let conn=await mysql.createConnection(config);
 try{
  const [[db]]=await conn.query('SELECT DATABASE() AS name');assert.equal(db.name,'sbc_v6682_ci');
  await conn.query('CREATE TABLE IF NOT EXISTS sbc_customers (id VARCHAR(120) PRIMARY KEY,tenant_id BIGINT NOT NULL,business_name VARCHAR(255)) ENGINE=InnoDB');
  await conn.query("INSERT INTO sbc_customers(id,tenant_id,business_name) VALUES ('archive-lead',1,'Synthetic Archive Business')");
  const migration=fs.readFileSync(path.join(__dirname,'../migrations/20261124_001_sbc_call_archive.sql'),'utf8');
  for(const statement of migration.split(';').map(s=>s.trim()).filter(Boolean))await conn.query(statement);
  const base={tenantId:1,userId:'rep',customerId:'archive-lead',to:'+13055550100',status:'ended',outcome:'Pending',endedAt:'2026-11-24T14:00:00Z',updatedAt:'2026-11-24T14:01:00Z'};
  const rows=Array.from({length:10000},(_,i)=>({...base,id:'attempt-'+String(i).padStart(5,'0'),sessionId:'session-'+i,tenantId:i%10===0?2:1,userId:i%2?'rep':'other'}));
  await conn.beginTransaction();assert.equal((await archive.appendBatch(conn,rows)).inserted,10000);await conn.commit();
  await conn.beginTransaction();assert.equal((await archive.appendBatch(conn,rows.slice(0,100))).unchanged,100);
  const changed={...rows[1],outcome:'Spanish callback needed',notes:'Synthetic corrected outcome',updatedAt:'2026-11-24T14:02:00Z'};
  assert.equal((await archive.appendBatch(conn,[changed])).advanced,1);await conn.commit();
  await conn.beginTransaction();assert.equal((await archive.appendBatch(conn,[rows[1]])).older,1);await conn.commit();
  await conn.beginTransaction();await assert.rejects(archive.appendBatch(conn,[{...changed,id:'duplicate-session'}]),/Duplicate entry/);await conn.rollback();
  await conn.end();conn=await mysql.createConnection(config);
  const owner={tenantId:1,actorId:'owner',role:'owner'},staff={tenantId:1,actorId:'rep',role:'caller'};
  const a=await archive.list(conn,owner,{limit:250}),b=await archive.list(conn,owner,{limit:250,offset:250});
  assert.equal(a.total,9000);assert.equal(a.rows.length,250);assert.equal(a.nextOffset,250);
  assert(!a.rows.some(x=>b.rows.some(y=>x.id===y.id)));
  assert.equal((await archive.list(conn,staff,{callerId:'other'})).total,5000);
  assert.equal((await archive.list(conn,{...owner,tenantId:2})).total,1000);
  assert.equal((await archive.list(conn,owner,{business:'Archive Business'})).total,9000);
  const corrected=await archive.list(conn,owner,{outcome:'Spanish callback needed'});assert.equal(corrected.total,1);assert.equal(corrected.rows[0].id,changed.id);
  const [[rev]]=await conn.query('SELECT COUNT(*) AS total FROM sbc_call_attempt_revision_v1');assert.equal(Number(rev.total),10001);
  // A real prior durable snapshot contains the row about to be evicted.
  // Both archive and workspace change must commit or roll back together.
  const snapshot=require('../enterprise/integration/sbc-snapshot-tenants.cjs');
  const env={SBC_CALL_ARCHIVE_CAPTURE:'YES',SBC_CALL_ARCHIVE_RETENTION_APPROVED:'YES',SBC_CALL_ARCHIVE_RETENTION_POLICY_REF:'isolated-ci-only'};
  await conn.query('CREATE TEMPORARY TABLE sbc_workspace (id INT PRIMARY KEY,payload LONGTEXT NOT NULL) ENGINE=InnoDB');
  const rolling=Array.from({length:1001},(_,i)=>({...base,tenantId:3,id:'rolling-'+i,sessionId:'rolling-session-'+i}));
  const prior=JSON.stringify({callLogs:rolling.slice(0,1000)}),next=JSON.stringify({callLogs:rolling.slice(1)});
  await conn.query('INSERT INTO sbc_workspace(id,payload) VALUES (1,?)',[prior]);
  await conn.beginTransaction();
  await snapshot.persistCallArchive(conn,next,env);
  await conn.query('UPDATE sbc_workspace SET payload=? WHERE id=1',[next]);
  await conn.rollback();
  assert.equal((await archive.list(conn,{...owner,tenantId:3})).total,0);
  const [[rolledBack]]=await conn.query('SELECT payload FROM sbc_workspace WHERE id=1');
  assert.equal(rolledBack.payload,prior);
  await conn.beginTransaction();
  await snapshot.persistCallArchive(conn,next,env);
  await conn.query('UPDATE sbc_workspace SET payload=? WHERE id=1',[next]);
  await conn.commit();
  const [[saved]]=await conn.query('SELECT payload FROM sbc_workspace WHERE id=1');
  assert.equal(JSON.parse(saved.payload).callLogs.length,1000);
  const historical=await archive.list(conn,{...owner,tenantId:3},{limit:250});
  assert.equal(historical.total,1001);
  const historyEnv={...env,SBC_CALL_ARCHIVE_READ:'YES'};
  const archivePage=await archive.readHistory(conn,{...owner,tenantId:3},{limit:250,offset:1000},historyEnv);
  assert.equal(archivePage.total,1001);
  assert.equal(archivePage.rows.length,1);
  assert.equal(archivePage.nextOffset,null);
  assert.equal(archivePage.source,'sql_archive');
  const evictedPage=await archive.readHistory(conn,{...owner,tenantId:3},{limit:10},historyEnv);
  assert(evictedPage.rows.some(r=>r.id==='rolling-0'));
  assert.equal((await archive.readHistory(conn,{tenantId:3,actorId:'other',role:'caller'},{callerId:'rep'},historyEnv)).total,0);

  const [[evicted]]=await conn.query("SELECT COUNT(*) AS total FROM sbc_call_attempt_archive_v1 WHERE tenant_id=3 AND log_id='rolling-0'");
  assert.equal(Number(evicted.total),1);
  await conn.beginTransaction();
  await snapshot.persistCallArchive(conn,next,env);
  await conn.commit();
  const [[replayed]]=await conn.query('SELECT COUNT(*) AS total FROM sbc_call_attempt_revision_v1 WHERE tenant_id=3');
  assert.equal(Number(replayed.total),1001);
  // Lookup the exact original session even though it has left the rolling snapshot.
  const session={sessionId:'rolling-session-0',customerId:'archive-lead',manualDial:false};
  const actor={tenantId:3,actorId:'rep',role:'caller'};
  const recovered=await archive.findSession(conn,actor,session);
  assert.equal(recovered.id,'rolling-0');
  assert.equal(await archive.findSession(conn,{...actor,tenantId:2},session),null);
  assert.equal(await archive.findSession(conn,{...actor,actorId:'other'},session),null);
  assert.equal(await archive.findSession(conn,actor,{...session,customerId:'different-lead'}),null);
  assert.equal(await archive.findSession(conn,actor,{...session,customerId:'',manualDial:true}),null);
  const current=await archive.findSession(conn,staff,{sessionId:changed.sessionId,customerId:changed.customerId,manualDial:false});
  assert.equal(current.outcome,'Spanish callback needed');
  assert.equal(current.notes,'Synthetic corrected outcome');


 }finally{await conn.end().catch(()=>{});}
});
