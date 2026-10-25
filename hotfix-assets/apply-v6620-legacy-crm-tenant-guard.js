'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6620_LEGACY_CRM_TENANT_GUARDS';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' count '+n);return s.replace(a,b)}
function apply(root){
 const file=path.join(root,'server.js');let server=fs.readFileSync(file,'utf8');
 if(server.includes(MARKER))throw Error(MARKER+': duplicate application');
 const starts=[
  "app.post('/api/customers',auth,ownerOnly,async(req,res)=>{",
  "app.put('/api/customers/:id',auth,ownerOnly,async(req,res)=>{",
  "app.post('/api/customers/:id/account-notes',auth,async(req,res)=>{",
  "app.delete('/api/customers/:id',auth,ownerOnly,async(req,res)=>{",
  "app.post('/api/customers/bulk-delete',auth,ownerOnly,async(req,res)=>{",
  "app.post('/api/quotes',auth,ownerOnly"
 ];
 for(const start of starts)if(server.split(start).length!==2)throw Error(MARKER+': route anchor missing '+start);
 const baselineStart=starts[0];
 server=once(server,baselineStart,"// "+MARKER+": explicitly scoped legacy routes; verified v6606 SQL PATCH remains available.\nconst V6620_LEGACY_CRM=require('./enterprise/v6620-legacy-crm-tenant-guard.cjs');\n"+baselineStart,'tenant helper');
 function part(i,change){
  const a=server.indexOf(starts[i]),b=server.indexOf(starts[i+1],a+starts[i].length);
  if(a<0||b<=a)throw Error(MARKER+': route bounds '+i);
  const orig=server.slice(a,b),updated=change(orig);
  if(orig===updated)throw Error(MARKER+': no effective change '+i);
  server=server.slice(0,a)+updated+server.slice(b);
 }
 part(0,s=>once(s,
  "const dup=leadDuplicateMatches(candidate);",
  "const dup=leadDuplicateMatches(candidate).filter(m=>V6620_LEGACY_CRM.owns(m.customer,requireRequestTenant(req)));",
  'customer duplicate detection tenant scope'));
 part(1,s=>{
  s=once(s,"const c=db.customers.find(x=>x.id===req.params.id);",
   "const c=db.customers.find(x=>x.id===req.params.id&&V6620_LEGACY_CRM.owns(x,requireRequestTenant(req)));",'edit customer tenant scope');
  s=once(s,"Object.assign(c,req.body||{},{id:c.id,updatedAt:now()});",
   "const unsafe=V6620_LEGACY_CRM.validatePatch(req.body);if(unsafe)return res.status(400).json({ok:false,error:unsafe});Object.assign(c,req.body,{id:c.id,tenantId:c.tenantId,updatedAt:now()});",
   'edit whitelist and immutable tenancy');
  return s;
 });
 part(2,s=>once(s,"const c=db.customers.find(x=>x.id===req.params.id);",
 "const c=db.customers.find(x=>x.id===req.params.id&&V6620_LEGACY_CRM.owns(x,requireRequestTenant(req)));",'account note tenant scope'));
 part(3,s=>once(s,"const i=db.customers.findIndex(x=>x.id===req.params.id);",
 "const i=db.customers.findIndex(x=>x.id===req.params.id&&V6620_LEGACY_CRM.owns(x,requireRequestTenant(req)));",'delete tenant scope'));
 part(4,s=>{
  s=once(s,"const ids=Array.isArray(req.body?.ids)?",
    "const tenantId=requireRequestTenant(req);const ids=Array.isArray(req.body?.ids)?",'bulk scoped tenant');
  s=once(s,"const removed=db.customers.filter(c=>ids.includes(String(c.id)));",
    "const removed=db.customers.filter(c=>ids.includes(String(c.id))&&V6620_LEGACY_CRM.owns(c,tenantId));",'bulk tenant selection');
  s=once(s,"db.customers=db.customers.filter(c=>!ids.includes(String(c.id)));",
    "db.customers=db.customers.filter(c=>!(ids.includes(String(c.id))&&V6620_LEGACY_CRM.owns(c,tenantId)));",'bulk post-persist tenant scope');
  return s;
 });
 // V66.38: a successful local JSON fallback is NOT a MySQL commit.
 const silentFallback=/console\.error\('SBC MySQL write failed after retries; preserving local backup instead of crashing:',lastError\?\.message\|\|lastError\);\s*try \{ const json=JSON\.stringify\(db,null,2\); const tmp=DATA_FILE\+'\.tmp'; fs\.writeFileSync\(tmp,json\); fs\.renameSync\(tmp,DATA_FILE\); \} catch\(localErr\)\{ console\.error\('\[SBC MYSQL\] local backup also failed:',localErr\.message\); \}/g;
 const fallbacks=[...server.matchAll(silentFallback)];
 if(fallbacks.length!==1)throw Error(MARKER+': expected one silent JSON fallback, found '+fallbacks.length);
 server=server.replace(silentFallback,[
  "console.error('[SBC MYSQL] relational write was NOT committed; rejecting mutation:',lastError?.code||lastError?.message||lastError);",
  "const failed=new Error('MYSQL_RELATIONAL_COMMIT_FAILED');",
  "failed.code='MYSQL_RELATIONAL_COMMIT_FAILED';failed.cause=lastError;",
  "throw failed;"
 ].join('\n             '));
 // Before any legacy CRM mutation, reject read-only, shutdown or missing SQL pool.
 const legacyGuard="if(SBC_RUNTIME_READ_ONLY||sbcShutdownStarted||!mysqlPool||!MYSQL_RECOVERY_EVALUATED)return res.status(423).json({ok:false,error:'CRM_RELATIONAL_WRITER_UNAVAILABLE',readOnly:true});";
 const saveFailure="try{await saveData();}catch(error){console.error('[SBC LEGACY CRM] MySQL persistence rejected',error?.code||'MYSQL_WRITE_FAILED');return res.status(503).json({ok:false,error:'CRM_RELATIONAL_COMMIT_FAILED',retryable:true});}";
 for(let i=0;i<5;i++){
  const start=starts[i];
  const a=server.indexOf(start),b=server.indexOf(starts[i+1],a+start.length);
  if(a<0||b<=a)throw Error(MARKER+': V66.38 route range missing '+i);
  const segment=server.slice(a,b);
  if(segment.split('await saveData();').length!==2)throw Error(MARKER+': V66.38 ambiguous persistence call '+i);
  const updated=segment.replace(start,start+legacyGuard).replace('await saveData();',saveFailure);
  server=server.slice(0,a)+updated+server.slice(b);
 }
 fs.writeFileSync(file,server);
 fs.mkdirSync(path.join(root,'enterprise'),{recursive:true});
 fs.copyFileSync(path.join(__dirname,'v6620-legacy-crm-tenant-guard.cjs'),path.join(root,'enterprise','v6620-legacy-crm-tenant-guard.cjs'));
 const test=path.join(__dirname,'v6620-legacy-crm-tenant-guard-test.cjs');
 if(!fs.existsSync(test))throw Error(MARKER+': regression test absent');
 fs.mkdirSync(path.join(root,'scripts'),{recursive:true});
 fs.copyFileSync(test,path.join(root,'scripts','v6620-legacy-crm-tenant-guard-test.cjs'));
 return {marker:MARKER,changed:true,customerRoutes:5,nonTenantMutationsBlocked:true,immutableTenantAndIds:true,recoveryAndWriterGatesUnchanged:true};
}
module.exports={apply,MARKER};
