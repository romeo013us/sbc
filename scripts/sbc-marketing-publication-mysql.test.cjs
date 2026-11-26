'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createConnection}=require('mysql2/promise');
const {createPublicationLedger}=require('../enterprise/creative-intelligence/marketing-publication-ledger.cjs');
test('disposable MySQL: publication evidence and history commit atomically; conflicting slot and registry roll back',async()=>{
 assert.equal(process.env.SBC_LEDGER_DISPOSABLE_CI,'1');assert.ok(process.env.SBC_LEDGER_CI_PASSWORD);
 const cx=await createConnection({host:'127.0.0.1',port:3306,user:'root',password:process.env.SBC_LEDGER_CI_PASSWORD,database:'sbc_ledger_ci',timezone:'Z',connectTimeout:3000});
 const lock='sbc:runtime:writer:v1',tenantId=57,sha='1'.repeat(64),source='2'.repeat(64),logo='3'.repeat(64),manifest='4'.repeat(64);
 const now=Date.now(),verifiedAt=new Date(now-120000).toISOString(),submittedAt=new Date(now-60000).toISOString(),publishedAt=new Date(now-59000).toISOString(),sqlTime=s=>s.replace('T',' ').replace('Z','');
 const base={tenantId,channel:'facebook',accountRef:'fixture-page',slotLocal:'2026-11-26T22:00',slug:'pub-fixture',format:'square',revision:1,sha256:sha,sourceAssetId:source,logoSha256:logo,manifestSha256:manifest,verifiedAt,submittedAt};
 try{
  const [[db]]=await cx.query('SELECT DATABASE() AS name, @@version AS version');assert.equal(db.name,'sbc_ledger_ci');assert.match(db.version,/^8\.0\./);
  await cx.query(fs.readFileSync(path.join(__dirname,'../docs/schema-proposals/sbc-marketing-publication-receipts.sql'),'utf8'));
  const [[acquired]]=await cx.execute('SELECT GET_LOCK(?,0) AS acquired',[lock]);assert.equal(acquired.acquired,1);
  await cx.execute('INSERT INTO sbc_core_marketing_inventory VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',[tenantId,base.slug,base.format,1,'fixture-job',sha,source,logo,1,sha,'fixture-owner',sqlTime(verifiedAt),sqlTime(verifiedAt)]);
  await cx.execute('INSERT INTO sbc_core_marketing_readbacks VALUES (?,?,?,?,?,?,?)',[tenantId,base.slug,base.format,1,sha,sqlTime(verifiedAt),manifest]);
  let submission={...base,submissionId:'pub1',postRef:'fixture-post-1',mediaRef:'fixture-media-1'};
  const ledger=createPublicationLedger({conn:cx,tenantId,accounts:{facebook:base.accountRef},assertWriter:async()=>true,clock:()=>now,loadSubmission:async()=>submission,readProviderPost:async()=>({channel:submission.channel,accountRef:submission.accountRef,postRef:submission.postRef,mediaRef:submission.mediaRef,status:'published',publishedAt})});
  assert.equal((await ledger.recordPublication('pub1')).status,'PUBLICATION_RECORDED');
  submission={...submission,submissionId:'pub2',postRef:'fixture-post-2',mediaRef:'fixture-media-2'};
  await assert.rejects(ledger.recordPublication('pub2'),{code:'ER_DUP_ENTRY'});
  submission={...submission,slotLocal:'2026-11-27T10:00'};
  // Receipt and source history insert first, then campaign registry's unique key rejects reused binding.
  await assert.rejects(ledger.recordPublication('pub2'),{code:'ER_DUP_ENTRY'});
  for(const table of ['sbc_core_marketing_publication_receipts','sbc_core_marketing_source_history']){const [[r]]=await cx.execute('SELECT COUNT(*) AS n FROM '+table+' WHERE tenant_id=?',[tenantId]);assert.equal(Number(r.n),1);}
  const [[registry]]=await cx.execute('SELECT COUNT(*) AS n FROM sbc_core_campaign_registry WHERE tenant_ref=?',['sbc:'+tenantId]);assert.equal(Number(registry.n),1);
  await cx.execute('SELECT RELEASE_LOCK(?)',[lock]);
  await assert.rejects(ledger.recordPublication('pub2'),/PUBLICATION_WRITER_REQUIRED/);
 }finally{await cx.end();}
});
