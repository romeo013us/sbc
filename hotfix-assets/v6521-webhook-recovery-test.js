'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const routePath=path.join(__dirname,'..','routes','v65119-control-plane.js');
const serverPath=path.join(__dirname,'..','server.js');
const route=require(routePath);
assert.equal(typeof route._test.createController,'function','controller test seam exposed');
const rows=new Map();let ddlCount=0;
const pool={async query(sql,params=[]){
 const q=String(sql).replace(/\s+/g,' ').trim();
 if(/^CREATE TABLE IF NOT EXISTS /.test(q)){ddlCount++;return [[],[]];}
 if(q.includes("SELECT COLUMN_NAME FROM information_schema.COLUMNS")&&q.includes("sbc_ops_webhook_ledger"))return [[{COLUMN_NAME:'provider_event_id'}],[]];
 if(q.startsWith('INSERT IGNORE INTO sbc_ops_webhook_ledger')){const [provider,eventId,jobId]=params;const k=provider+'\u0000'+eventId;if(rows.has(k))return [{affectedRows:0},[]];rows.set(k,{provider,eventId,jobId,state:'CLAIMED'});return [{affectedRows:1,insertId:1},[]];}
 if(q.startsWith('SELECT state FROM sbc_ops_webhook_ledger')){const [provider,eventId]=params;const row=rows.get(provider+'\u0000'+eventId);return [row?[{state:row.state}]:[],[]];}
 if(q.startsWith("UPDATE sbc_ops_webhook_ledger SET state='PROCESSED'")){const [provider,eventId]=params;const row=rows.get(provider+'\u0000'+eventId);if(row&&row.state==='CLAIMED'){row.state='PROCESSED';return [{affectedRows:1},[]];}return [{affectedRows:0},[]];}
 if(q.startsWith("UPDATE sbc_ops_webhook_ledger SET state='CLAIMED'")){const [jobId,provider,eventId]=params;const row=rows.get(provider+'\u0000'+eventId);if(row&&row.state==='FAILED'){row.state='CLAIMED';row.jobId=jobId;return [{affectedRows:1},[]];}return [{affectedRows:0},[]];}
 throw new Error('Unexpected mock SQL: '+q);
}};
const controller=route._test.createController({getContext:()=>({mysqlPool:pool})});
(async()=>{
 const attempts=await Promise.all(Array.from({length:20},()=>controller.claimWebhookEvent({provider:'square',eventId:'evt-concurrent-1',jobId:'job-1'})));
 assert.equal(rows.size,1,'one durable row for concurrent event');
 assert.equal(attempts.filter(x=>x.ok&&!x.duplicate).length,1,'exactly one concurrent claimant');
 assert.equal(attempts.filter(x=>!x.ok&&x.error==='WEBHOOK_EVENT_IN_PROGRESS_OR_RECOVERY_REQUIRED').length,19,'other concurrent deliveries are safely blocked');
 const done=await controller.completeWebhookEvent({provider:'square',eventId:'evt-concurrent-1'});assert.equal(done.ok,true);assert.equal(done.affected,true);
 const replay=await controller.claimWebhookEvent({provider:'square',eventId:'evt-concurrent-1',jobId:'job-1'});assert.equal(replay.ok,true);assert.equal(replay.duplicate,true,'processed replay is idempotent');
 // Simulate a crash after durable claim but before job state is written. The owner recovery path marks the stale claim FAILED after its timeout; the next delivery can reclaim it.
 const crash=await controller.claimWebhookEvent({provider:'twilio',eventId:'evt-crash-1',jobId:'job-2'});assert.equal(crash.ok,true);assert.equal(crash.duplicate,false);
 const crashRow=rows.get('twilio\u0000evt-crash-1');crashRow.state='FAILED';
 const retry=await controller.claimWebhookEvent({provider:'twilio',eventId:'evt-crash-1',jobId:'job-2'});assert.equal(retry.ok,true);assert.equal(retry.duplicate,false,'recovered failed claim is retryable');
 const retryDone=await controller.completeWebhookEvent({provider:'twilio',eventId:'evt-crash-1'});assert.equal(retryDone.affected,true);assert.equal(crashRow.state,'PROCESSED');
 const server=fs.readFileSync(serverPath,'utf8');
 const eventPos=server.indexOf('const providerEventId=');const claimPos=server.indexOf('const durableClaim=',eventPos);const seenPos=server.indexOf('job.seenEvents.includes(providerEventId)',eventPos);
 assert.ok(eventPos>=0&&claimPos>eventPos&&seenPos>claimPos,'durable claim must precede persisted replay-list shortcut');
 assert.match(server,/duplicate_event_reconciled/,'saved job state can reconcile a claimed ledger row after owner recovery');
 const source=fs.readFileSync(routePath,'utf8');assert.match(source,/names\.has\('event_hash'\)&&!names\.has\('provider_event_id'\)/,'legacy event_hash migration checks the old column correctly');
 assert.ok(ddlCount>=6,'controller ensures schema');
 console.log('V65.1.21 webhook tests: PASS — 20 concurrent deliveries => 1 claimant; processed replay suppressed; crash/recovery/retry path passes; legacy ledger column migration condition corrected.');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
