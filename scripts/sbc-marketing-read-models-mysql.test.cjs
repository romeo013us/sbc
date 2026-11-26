'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPool}=require('mysql2/promise');
const {runMigrations}=require('../shared/sbc-core/migrate.cjs');
const {ingestPaymentEvidence}=require('../shared/sbc-core/ledger.cjs');
const {readAuditSnapshot}=require('../enterprise/creative-intelligence/live-dossier-hydrator.cjs');
const {getCampaignRevenueSummary}=require('../shared/sbc-core/campaign-roi.cjs');
test('disposable MySQL: cached audit read, tenant FKs, exact currency-separated capture reporting',async()=>{
 assert.equal(process.env.SBC_LEDGER_DISPOSABLE_CI,'1');assert.ok(process.env.SBC_LEDGER_CI_PASSWORD);
 const pool=createPool({host:'127.0.0.1',port:3306,user:'root',password:process.env.SBC_LEDGER_CI_PASSWORD,database:'sbc_ledger_ci',connectionLimit:2,timezone:'Z'});
 try{
  assert.deepEqual(await runMigrations(pool,{mode:'reader'}),{verified:4,applied:0});
  const schema=n=>fs.readFileSync(path.join(__dirname,'../docs/schema-proposals',n),'utf8').match(/CREATE TABLE [\s\S]*?ENGINE=InnoDB;/g);
  const ddl=[...schema('sbc-campaign-attribution.sql'),...schema('sbc-prospect-audit-cache.sql')];assert.equal(ddl.length,3);for(const sql of ddl)await pool.query(sql);
  const tenant='sbc:marketing-ci',asset='d'.repeat(64),url='https://example.com/';
  const now=new Date(Date.now()-60000).toISOString(),at=now.replace('T',' ').replace('Z','');
  await pool.execute('INSERT INTO sbc_core_prospect_audit_snapshots VALUES (?,?,?,?,?,?,?)',[tenant,'lead1',url,200,at,'e'.repeat(64),JSON.stringify({viewport:false})]);
  const snap=await readAuditSnapshot(pool,tenant,'lead1');assert.equal(snap.checkedAt,now);assert.equal(snap.signals.viewport,false);assert.equal(await readAuditSnapshot(pool,'sbc:other','lead1'),null);
  for(const t of [tenant,'sbc:other'])await pool.execute('INSERT INTO sbc_core_campaign_registry (tenant_ref,channel,campaign_slug,asset_sha256,provider_post_ref,published_at) VALUES (?,?,?,?,?,?)',[t,'facebook','fixture',asset,'test-post',at]);
  const base={provider:'square',environment:'production',accountId:'marketing-ci',tenantRef:tenant,kind:'capture',amountMinor:19900,currency:'USD',occurredAt:now,payloadSha256:'f'.repeat(64)};
  const associate=async(e,provider=e.provider)=>{const result=await ingestPaymentEvidence(pool,e);await pool.execute('INSERT INTO sbc_core_campaign_ledger_attributions (tenant_ref,event_key,channel,campaign_slug,asset_sha256,provider,environment,account_id,payment_id) VALUES (?,?,?,?,?,?,?,?,?)',[e.tenantRef,result.eventKey,'facebook','fixture',asset,provider,'production',e.accountId,'pay-'+e.eventId]);return result.eventKey;};
  const event=await associate({...base,eventId:'marketing-usd'});
  await associate({...base,eventId:'marketing-eur',currency:'EUR',amountMinor:49900});
  await associate({...base,eventId:'marketing-refund',kind:'refund'});
  await associate({...base,eventId:'marketing-sandbox',environment:'sandbox'});
  await associate({...base,eventId:'marketing-mismatch'},'stripe');
  await associate({...base,eventId:'marketing-other',tenantRef:'sbc:other'});
  await assert.rejects(pool.execute('INSERT INTO sbc_core_campaign_ledger_attributions (tenant_ref,event_key,channel,campaign_slug,asset_sha256,provider,environment,account_id,payment_id) VALUES (?,?,?,?,?,?,?,?,?)',['sbc:other',event,'facebook','fixture',asset,'square','production','marketing-ci','pay-cross']),{code:'ER_NO_REFERENCED_ROW_2'});
  const report=await getCampaignRevenueSummary(pool,{tenantRef:tenant});assert.equal(report.netRevenueAvailable,false);assert.deepEqual(report.rows.map(r=>[r.currency,r.captureCount,r.grossMinor]),[['EUR','1','49900'],['USD','1','19900']]);
 }finally{await pool.end();}
});
