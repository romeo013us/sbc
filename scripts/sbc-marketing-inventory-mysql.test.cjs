'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createConnection}=require('mysql2/promise');
const {createInventoryWriter}=require('../enterprise/creative-intelligence/marketing-inventory-writer.cjs');
const {loadInventoryInputs}=require('../enterprise/creative-intelligence/marketing-inventory-storage.cjs');
const {projectInventory}=require('../enterprise/creative-intelligence/marketing-inventory.cjs');
test('disposable MySQL 8 inventory revisions, same-session lock, CAS, constraints and hydration',async()=>{
 assert.equal(process.env.SBC_LEDGER_DISPOSABLE_CI,'1');assert.ok(process.env.SBC_LEDGER_CI_PASSWORD);
 const config={host:'127.0.0.1',port:3306,user:'root',password:process.env.SBC_LEDGER_CI_PASSWORD,database:'sbc_ledger_ci',timezone:'Z',connectTimeout:3000};
 const cx=await createConnection(config);let other;
 const lock='sbc:runtime:writer:v1';
 try{
  other=await createConnection(config);
  const [[db]]=await cx.query('SELECT DATABASE() AS name, @@version AS version, @@autocommit AS autocommit');assert.equal(db.name,'sbc_ledger_ci');assert.match(db.version,/^8\.0\./);assert.equal(Number(db.autocommit),1);
  const ddl=fs.readFileSync(path.join(__dirname,'../docs/schema-proposals/sbc-marketing-inventory.sql'),'utf8').match(/CREATE TABLE [\s\S]*?ENGINE=InnoDB;/g);assert.equal(ddl.length,3);for(const sql of ddl)await cx.query(sql);
  const [[acquired]]=await cx.execute('SELECT GET_LOCK(?,0) AS acquired',[lock]);assert.equal(acquired.acquired,1);
  const [[denied]]=await other.execute('SELECT GET_LOCK(?,0) AS acquired',[lock]);assert.equal(denied.acquired,0);
  const sha='a'.repeat(64),source='b'.repeat(64),logo='c'.repeat(64),manifest='d'.repeat(64),now=Date.now(),at=new Date(now).toISOString(),stamp=at.replace('T',' ').replace('Z','');
  let review={state:'approved',version:1,assetId:source};const reviews={get(scope,id){assert.equal(scope.projectId,'sbc-marketing');assert.equal(id,'job1');return review;}};
  const make=(conn,tenantId=7)=>createInventoryWriter({conn,tenantId,logoSha256:logo,campaignSlugs:['fixture','second'],reviews,assertWriter:async()=>true,clock:()=>now,verify:async()=>({mediaVerified:true,publicationReady:false,manifestSha256:manifest,entries:[{sha256:sha,verifiedAt:at,width:1080,height:1080}]})});
  const writer=make(cx),foreign=make(other),key={slug:'fixture',format:'square',jobId:'job1'},stage={sha256:sha,sourceAssetId:source,logoSha256:logo,reviewVersion:1,width:1080,height:1080,mime:'image/jpeg',publicationReady:false};
  // Deliberately allow the application guard to prove the SQL lock condition independently.
  const results=await Promise.allSettled([writer.recordStage({...key,expectedRevision:0,stage}),foreign.recordStage({...key,slug:'second',expectedRevision:0,stage})]);
  assert.equal(results[0].status,'fulfilled');assert.equal(results[0].value.revision,1);assert.equal(results[1].status,'rejected');assert.match(results[1].reason.message,/INVENTORY_WRITE_NOT_CONFIRMED/);
  await assert.rejects(writer.recordStage({...key,expectedRevision:0,stage}),/STALE_INVENTORY_REVISION/);
  await assert.rejects(writer.recordReadback({...key,expectedRevision:1,manifest:{}}),/FINAL_APPROVAL_MISMATCH/);
  assert.equal((await writer.approve({...key,expectedRevision:1,approvedSha256:sha,actorId:'owner'})).revision,2);
  assert.equal((await writer.recordReadback({...key,expectedRevision:2,manifest:{}})).status,'READBACK_RECORDED');
  const [[count]]=await cx.query('SELECT COUNT(*) AS n FROM sbc_core_marketing_inventory');assert.equal(Number(count.n),2);
  const [revisions]=await cx.query('SELECT revision,final_approved_sha256 FROM sbc_core_marketing_inventory ORDER BY revision');assert.deepEqual(revisions.map(r=>[r.revision,r.final_approved_sha256]),[[1,null],[2,sha]]);
  const bank={holiday:[{slug:'fixture'}],campaigns:[]};const load=(tenantId=7)=>loadInventoryInputs(other,{tenantId,bank,logoSha256:logo,reviews,now});
  assert.equal(projectInventory(await load()).states.media_verified,1);assert.equal(projectInventory(await load(8)).states.missing,3);
  review={state:'rejected',version:2,assetId:source};assert.equal(projectInventory(await load()).states.review_required,1);review={state:'approved',version:1,assetId:source};
  for(const [tenant,digest] of [[8,sha],[7,logo]])await assert.rejects(cx.execute('INSERT INTO sbc_core_marketing_readbacks VALUES (?,?,?,?,?,?,?)',[tenant,'fixture','square',2,digest,new Date(now+1).toISOString().replace('T',' ').replace('Z',''),manifest]),{code:'ER_NO_REFERENCED_ROW_2'});
  await assert.rejects(cx.execute('INSERT INTO sbc_core_marketing_inventory (tenant_id,slug,format,revision,job_id,sha256,source_asset_id,logo_sha256,review_version,final_approved_sha256,final_approved_actor,final_approved_at,recorded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',[7,'bad','square',1,'job1',sha,source,logo,1,logo,'owner',stamp,stamp]),{code:'ER_CHECK_CONSTRAINT_VIOLATED'});
  await cx.execute('SELECT RELEASE_LOCK(?)',[lock]);
  const [[next]]=await other.execute('SELECT GET_LOCK(?,0) AS acquired',[lock]);assert.equal(next.acquired,1);
  await assert.rejects(writer.recordStage({...key,slug:'second',expectedRevision:0,stage}),/INVENTORY_WRITE_NOT_CONFIRMED/);
  // This synthetic history receipt is fixture data, not proof of a real platform publication.
  await other.execute('INSERT INTO sbc_core_marketing_source_history VALUES (?,?,?,?,?,?)',[7,'facebook','fixture-post',source,sha,stamp]);assert.equal(projectInventory(await load()).states.previously_used,1);
  await assert.rejects(foreign.recordStage({...key,slug:'second',expectedRevision:0,stage}),/INVENTORY_WRITE_NOT_CONFIRMED/);
  const [[final]]=await other.query('SELECT COUNT(*) AS n FROM sbc_core_marketing_inventory');assert.equal(Number(final.n),2);
 }finally{if(other)await other.end();await cx.end();}
});
