'use strict';
/* SBC V66.111: stage a bounded, tenant-safe, serialized async lead merge.
 * NEVER modify the pinned GoDaddy server directly; only the disposable
 * CI checkout can apply this transform before fresh receipt/hash generation.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const MARK='SBC_V66111_TENANT_SAFE_ASYNC_LEAD_MERGE';
const root=path.resolve(__dirname,'..');
const target=path.join(root,'server.js');
function once(src,from,to,label){
 const count=src.split(from).length-1;
 assert.equal(count,1,label+': ambiguous anchor '+count);
 return src.replace(from,to);
}
function patchServer(src){
 if(src.includes(MARK))return src;
 const begin=src.indexOf('async function mergeAsyncIngestResult(job,result){');
 const end=src.indexOf('ASYNC_INGEST.configure({onComplete:mergeAsyncIngestResult});',begin);
 assert(begin>=0&&end>begin,'async ingest merge anchors not found');
 let part=src.slice(begin,end);
 const entry=[
  '// '+MARK,
  'let sbcV66111MergeTail=Promise.resolve();',
  'async function mergeAsyncIngestResultUnlocked(job,result){',
  "  const tenantId=Number(job?.tenantId);",
  "  if(!Number.isSafeInteger(tenantId)||tenantId<1)throw Object.assign(new Error('INGEST_TENANT_REQUIRED'),{code:'INGEST_TENANT_REQUIRED'});"
 ].join('\n');
 part=once(part,'async function mergeAsyncIngestResult(job,result){',entry,'Tenant-bound merge entry');
 part=once(part,
   'const customers=Array.isArray(db.customers)?db.customers:[];',
   'const originalCustomers=Array.isArray(db.customers)?db.customers:[];\n  const customers=originalCustomers.map(c=>({...c}));',
   'Snapshot before merge');
 part=once(part,
   'for(const c of customers){const e=',
   'for(const c of customers){if(Number(c?.tenantId)!==tenantId)continue;const e=',
   'Tenant-bound duplicate indexes');
 part=once(part,
   'let added=0,updated=0,duplicates=0,count=0,quarantined=0,enrichmentQueue=[];',
   'let added=0,updated=0,duplicates=0,count=0,quarantined=0,enrichmentQueue=[];\n  let initialSaveCommitted=false;',
   'First durable commit marker');
 part=once(part,
   "const customer={id:'lead_'+crypto.randomBytes(8).toString('hex'),...lead,createdAt:now(),updatedAt:now()};",
   "const customer={id:'lead_'+crypto.randomBytes(8).toString('hex'),...lead,tenantId,createdAt:now(),updatedAt:now()};",
   'New lead tenant provenance');
 part=once(part,
   "db.customers=customers;\n    await saveData();",
   "db.customers=customers;\n    await saveData();\n    initialSaveCommitted=true;",
   'Durable save proof');
 part=once(part,
   "}catch(e){audit({id:'system',name:'SBC Async Ingestion Worker',role:'system'},",
   "}catch(e){if(!initialSaveCommitted&&db.customers===customers)db.customers=originalCustomers;audit({id:'system',name:'SBC Async Ingestion Worker',role:'system'},",
   'Rollback uncommitted projection');
 part+=[
  '',
  'async function mergeAsyncIngestResult(job,result){',
  '  // Serialize overlapping worker completions to avoid duplicate lead insertion.',
  '  const previous=sbcV66111MergeTail;',
  '  let release;',
  '  sbcV66111MergeTail=new Promise(resolve=>{release=resolve});',
  '  await previous;',
  '  try{return await mergeAsyncIngestResultUnlocked(job,result)}',
  '  finally{release()}',
  '}',
  ''
 ].join('\n');
 return src.slice(0,begin)+part+src.slice(end);
}
if(require.main===module){
 const orig=fs.readFileSync(target,'utf8');
 const patched=patchServer(orig);
 assert.equal(patchServer(patched),patched,'transform must be idempotent');
 if(process.argv.includes('--apply')){
   if(process.env.SBC_V66111_ISOLATED_STAGE!=='YES')throw Error('SBC_V66111_REFUSE_NON_DISPOSABLE_STAGE');
   fs.writeFileSync(target,patched);
   console.log('[SBC V66.111] staged tenant-safe serialized ingestion, pending release manifest rebuild');
 }else console.log('[SBC V66.111] PASS dry-run transform, bytes='+patched.length+', staged='+String(patched===orig));
}
module.exports={patchServer,MARK};
