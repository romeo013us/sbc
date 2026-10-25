'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6628_KIM_CANONICAL_DB_REBIND';
function once(src,a,b,name){const n=src.split(a).length-1;if(n!==1)throw Error(MARKER+': '+name+' expected once, found '+n);return src.replace(a,b);}
function apply(root){
 const kimPath=path.join(root,'enterprise','v56135-kim-mission-controller.js');
 const serverPath=path.join(root,'server.js');
 let kim=fs.readFileSync(kimPath,'utf8'),server=fs.readFileSync(serverPath,'utf8');
 if(kim.includes(MARKER)||server.includes(MARKER))throw Error(MARKER+': duplicate patch');
 server=once(server,'KIM_MISSION_ENGINE.createController({db,saveData,audit,','KIM_MISSION_ENGINE.createController({db,getCanonicalDb:()=>db,saveData,audit,','server controller dynamic data dependency');
 kim=once(kim,'function createController({db,saveData,audit,','function createController({db,getCanonicalDb,saveData,audit,','controller dynamic data dependency');
 kim=once(kim,'  const state={version:VERSION,lastCycleAt:',
  [
  '  // '+MARKER+': refresh the CRM object after async MySQL hydration.',
  '  function refreshCanonicalDb(){',
  "    const current=typeof getCanonicalDb==='function'?getCanonicalDb():db;",
  '    if(!current||!Array.isArray(current.customers)||!Array.isArray(current.orders)){',
  "      throw Object.assign(new Error('CRM_CANONICAL_DATA_UNAVAILABLE'),{code:'CRM_CANONICAL_DATA_UNAVAILABLE'});",
  '    }',
  '    db=current;',
  '    return current;',
  '  }',
  '  const state={version:VERSION,lastCycleAt:'
  ].join('\n'),'canonical refresh helper');
 kim=once(kim,
  "    if(!customer)throw new Error('Customer is required.');\n    if(!Number.isSafeInteger(Number(customer.tenantId))||Number(customer.tenantId)<1)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED'});",
  [
  "    if(!customer)throw new Error('Customer is required.');",
  "    if(!Number.isSafeInteger(Number(customer.tenantId))||Number(customer.tenantId)<1)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED'});",
  "    const current=refreshCanonicalDb().customers.find(c=>String(c.id)===String(customer.id));",
  "    if(!current||Number(current.tenantId)!==Number(customer.tenantId))throw Object.assign(new Error('CRM_CUSTOMER_CONTEXT_STALE'),{code:'CRM_CUSTOMER_CONTEXT_STALE'});",
  '    customer=current;'
  ].join('\n'),'resolve canonical customer for authorized mission');
 kim=once(kim,
  "    if(state.running)return {ok:true,skipped:true,reason:'cycle_already_running'};\n    if(advisoryOnly)return sbcAdvisoryScreen(db,tenantId,limit,eligible,recentMission);",
  "    if(state.running)return {ok:true,skipped:true,reason:'cycle_already_running'};\n    refreshCanonicalDb();\n    if(advisoryOnly)return sbcAdvisoryScreen(db,tenantId,limit,eligible,recentMission);",
  'rebind Kim advisory to hydrated CRM');
 kim=once(kim,'  async function reconcilePaidOrders(limit=MAX_BATCH,tenantId=null){',
  '  async function reconcilePaidOrders(limit=MAX_BATCH,tenantId=null){\n    refreshCanonicalDb();','rebind paid order read');
 kim=once(kim,'  function overview(){return {version:VERSION,',
  '  function overview(){try{refreshCanonicalDb()}catch(_){/* read-only boot may hydrate later */}return {version:VERSION,','rebind overview after hydration');
 kim=once(kim,
  '  function findCustomer(id){return (db?.customers||[]).find(c=>String(c.id)===String(id));}',
  '  function findCustomer(id){refreshCanonicalDb();return (db?.customers||[]).find(c=>String(c.id)===String(id));}',
  'rebind customer resolver');
 const routes=fs.readFileSync(path.join(root,'routes','v56135-kim-mission.js'),'utf8');
 if(!routes.includes('global.__SBC_REQUIRE_TENANT(req)'))throw Error(MARKER+': route tenant guard missing');
 if(!server.includes('SBC_RUNTIME_WRITER_LEASE_REQUIRED')||!server.includes('MYSQL_RECOVERY_REQUIRED'))throw Error(MARKER+': recovery/writer invariant missing');
 fs.writeFileSync(kimPath,kim);fs.writeFileSync(serverPath,server);
 return {marker:MARKER,changed:true,crmWrites:false,tenantGuardPreserved:true,canonicalAfterHydration:true};
}
module.exports={apply,MARKER};