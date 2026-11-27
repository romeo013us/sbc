'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPool}=require('mysql2/promise');
const {ingestPaymentEvidence}=require('../shared/sbc-core/ledger.cjs');
const {createAnalyticsWriter,summarizePerformance}=require('../enterprise/creative-intelligence/marketing-performance-analytics.cjs');
test('disposable MySQL: append provider corrections, enforce receipt and writer scope, report exact Square captures',async()=>{
 assert.equal(process.env.SBC_LEDGER_DISPOSABLE_CI,'1');assert.ok(process.env.SBC_LEDGER_CI_PASSWORD);
 const pool=createPool({host:'127.0.0.1',port:3306,user:'root',password:process.env.SBC_LEDGER_CI_PASSWORD,database:'sbc_ledger_ci',timezone:'Z',connectionLimit:3});let cx,other;
 const lock='sbc:runtime:writer:v1',tenantId=57,tenantRef='sbc:57',sha='1'.repeat(64),now=Date.now(),iso=n=>new Date(n).toISOString(),stamp=n=>iso(n).replace('T',' ').replace('Z','');
 try{
  cx=await pool.getConnection();other=await pool.getConnection();const [[db]]=await cx.query('SELECT DATABASE() AS name, @@version AS version');assert.equal(db.name,'sbc_ledger_ci');assert.match(db.version,/^8\.0\./);
  await cx.query(fs.readFileSync(path.join(__dirname,'../docs/schema-proposals/sbc-marketing-analytics.sql'),'utf8'));
  const [[p]]=await cx.execute('SELECT * FROM sbc_core_marketing_publication_receipts WHERE tenant_id=? AND provider_post_ref=?',[tenantId,'fixture-post-1']);assert.equal(p.sha256,sha);assert(p.published_at.getTime()<=now-1000);
  const [[held]]=await cx.execute('SELECT GET_LOCK(?,0) AS held',[lock]);assert.equal(held.held,1);
  let observation={channel:'facebook',accountRef:'fixture-page',postRef:'fixture-post-1',measuredAt:iso(now-1000),impressions:'100',reactions:'3',comments:null,shares:null,clicks:'0'};
  const make=(conn,t=tenantId)=>createAnalyticsWriter({conn,tenantId:t,accounts:{facebook:'fixture-page'},assertWriter:async()=>true,readMetrics:async()=>observation,clock:()=>now});const writer=make(cx);
  assert.equal((await writer.recordObservation('facebook','fixture-post-1')).status,'ANALYTICS_RECORDED');
  observation={...observation,measuredAt:iso(now),impressions:'80'};
  await assert.rejects(make(other).recordObservation('facebook','fixture-post-1'),/ANALYTICS_WRITE_NOT_CONFIRMED/);
  await assert.rejects(make(cx,58).recordObservation('facebook','fixture-post-1'),/ANALYTICS_WRITE_NOT_CONFIRMED/);
  assert.equal((await writer.recordObservation('facebook','fixture-post-1')).status,'ANALYTICS_RECORDED');
  await assert.rejects(cx.execute('INSERT INTO sbc_core_marketing_analytics VALUES (?,?,?,?,?,?,?,?,?,?)',[58,'facebook','fixture-post-1',stamp(now),'1',null,null,null,null,stamp(now)]),{code:'ER_NO_REFERENCED_ROW_2'});
  await assert.rejects(cx.execute('INSERT INTO sbc_core_marketing_analytics VALUES (?,?,?,?,?,?,?,?,?,?)',[57,'facebook','fixture-post-1',stamp(now+1),null,null,null,null,null,stamp(now+1)]),{code:'ER_CHECK_CONSTRAINT_VIOLATED'});
  const base={provider:'square',environment:'production',accountId:'analytics-fixture',tenantRef,kind:'capture',amountMinor:19900,currency:'USD',occurredAt:iso(now-500),payloadSha256:'9'.repeat(64)};
  const associate=async(e)=>{const r=await ingestPaymentEvidence(pool,e);await cx.execute('INSERT INTO sbc_core_campaign_ledger_attributions (tenant_ref,event_key,channel,campaign_slug,asset_sha256,provider,environment,account_id,payment_id) VALUES (?,?,?,?,?,?,?,?,?)',[tenantRef,r.eventKey,'facebook','pub-fixture',sha,e.provider,'production',e.accountId,'analytics-pay-'+e.eventId]);};
  await associate({...base,eventId:'analytics-usd'});await associate({...base,eventId:'analytics-eur',currency:'EUR',amountMinor:49900});await associate({...base,eventId:'analytics-refund',kind:'refund'});await associate({...base,eventId:'analytics-stripe',provider:'stripe'});await associate({...base,eventId:'analytics-sandbox',environment:'sandbox'});
  const report=await summarizePerformance(other,{tenantId,now});assert.deepEqual(report.channels[0].metrics.impressions,{observedPosts:1,total:'80',complete:true});assert.equal(report.channels[0].metrics.comments.total,null);assert.equal(report.channels[0].metrics.clicks.total,'0');assert.deepEqual(report.squareCaptures.map(r=>[r.currency,r.captureCount,r.grossMinor]),[['EUR','1','49900'],['USD','1','19900']]);assert.equal(report.netRevenueAvailable,false);
  assert.deepEqual((await summarizePerformance(other,{tenantId:58,now})).channels,[]);const [[n]]=await cx.execute('SELECT COUNT(*) AS n FROM sbc_core_marketing_analytics WHERE tenant_id=?',[tenantId]);assert.equal(Number(n.n),2);await cx.execute('SELECT RELEASE_LOCK(?)',[lock]);
 }finally{if(other)other.release();if(cx)cx.release();await pool.end();}
});
