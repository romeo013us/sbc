'use strict';
const assert=require('node:assert/strict');
const {runWithTenantContext,currentTenantContext,requireTenantContext,normalizeTenantId}=require('../enterprise/tenant-context.cjs');
const {createStateReconciliationGuard}=require('../enterprise/recovery/state-reconciliation-guard.cjs');
const {createTenantAuditLedger}=require('../enterprise/tenant-audit-ledger.cjs');
const fs=require('node:fs'); const path=require('node:path');
const worker=fs.readFileSync(path.join(__dirname,'../workers/checkout-event-worker.js'),'utf8');
(async()=>{
 assert.throws(()=>normalizeTenantId('../other'),/VALID_TENANT_CONTEXT_REQUIRED/);
 assert.equal(currentTenantContext(),null);
 await runWithTenantContext({tenantId:'tenant-A',actorId:'owner',role:'owner'},async()=>{
  assert.equal(requireTenantContext().tenantId,'tenant-A');
  await Promise.resolve(); assert.equal(currentTenantContext().tenantId,'tenant-A');
  let auditArgs=null; const ledger=createTenantAuditLedger({pool:{query:async(sql,args)=>{auditArgs=args;return [{affectedRows:1}];}}});
  const audit=await ledger.append({action:'read',resourceType:'customer',resourceId:'c-1',outcome:'ALLOW',metadata:{b:2,a:1}});
  assert.equal(audit.tenantId,'tenant-A'); assert.equal(auditArgs[1],'tenant-A'); assert.match(audit.evidenceHash,/^[a-f0-9]{64}$/);
 });
 assert.equal(currentTenantContext(),null);
 let lock=null;
 const guard=createStateReconciliationGuard({readAuthoritative:async()=>({rowCount:2,hash:'aaa'}),readProjection:async()=>({rowCount:1,hash:'bbb'}),engageLock:async x=>{lock=x;},logger:{error(){}}});
 const result=await guard.verify({tenantId:'tenant-A'});
 assert.equal(result.ok,false); assert.equal(result.lockEngaged,true); assert.equal(lock.reason,'STATE_RECONCILIATION_MISMATCH');
 const failClosed=createStateReconciliationGuard({readAuthoritative:async()=>{throw Error('unavailable');},readProjection:async()=>({rowCount:0}),engageLock:async x=>{lock=x;},logger:{error(){}}});
 const failed=await failClosed.verify({tenantId:'tenant-A'}); assert.equal(failed.ok,false); assert.equal(failed.lockEngaged,true); assert.equal(lock.reason,'STATE_RECONCILIATION_UNAVAILABLE');
 console.log(JSON.stringify({ok:true,checks:['tenant-id-validation','async-context-isolation','tenant-audit-hash-and-scope','tenant-scoped-fulfillment-idempotency','mismatch-engages-lock','unknown-state-engages-lock']}));
})().catch(e=>{console.error(e);process.exit(1);});
