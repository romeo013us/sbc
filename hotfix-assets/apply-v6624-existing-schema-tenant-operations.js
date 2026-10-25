'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6624_EXISTING_SCHEMA_TENANT_AUTONOMY';
function once(s,needle,replacement,label){const n=s.split(needle).length-1;if(n!==1)throw Error(MARKER+': '+label+' anchor count '+n);return s.replace(needle,replacement)}
function apply(root){
 const serverFile=path.join(root,'server.js');
 const brainFile=path.join(root,'enterprise/v56134-ten-brain.js');
 const kimFile=path.join(root,'enterprise/v56135-kim-mission-controller.js');
 const kimRoutesFile=path.join(root,'routes/v56135-kim-mission.js');
 let server=fs.readFileSync(serverFile,'utf8'),brain=fs.readFileSync(brainFile,'utf8'),kim=fs.readFileSync(kimFile,'utf8');
 let kimRoutes=fs.readFileSync(kimRoutesFile,'utf8');
 if(server.includes(MARKER)||brain.includes(MARKER)||kim.includes(MARKER)||kimRoutes.includes(MARKER))throw Error(MARKER+': duplicate patch');
 // An intelligence evaluation never makes an order or Square checkout. Only an expressly dispatched,
 // consented purchase can reach the existing checkout pathway.
 brain=once(brain,
  "  if(action==='CREATE_CHECKOUT'){\n    try{",
  "  if(action==='CREATE_CHECKOUT' && mode!=='dispatch'){action='CHECKOUT_REVIEW_REQUIRED';nodes.push({brain:'CONTROLLER_BRAIN',state:'HUMAN_PURCHASE_CONFIRMATION_REQUIRED'});}\n  if(action==='CREATE_CHECKOUT'){\n    try{",
  'brain checkout intent versus dispatch');
 // Tenant scope is explicit for scheduled missions. Manual owner actions remain separately authenticated.
 kim=once(kim,
  "  async function cycle({limit=MAX_BATCH,reason='scheduled'}={}){",
  "  async function cycle({limit=MAX_BATCH,reason='scheduled',tenantId=null}={}){",
  'Kim mission tenant argument');
 kim=once(kim,
  "      const candidates=(db?.customers||[]).filter(eligible).filter(c=>!recentMission(c)).slice(0,cap);",
  "      const selectedTenant=Number(tenantId);if(!Number.isSafeInteger(selectedTenant)||selectedTenant<1)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED'});\n      const candidates=(db?.customers||[]).filter(c=>Number(c?.tenantId)===selectedTenant).filter(eligible).filter(c=>!recentMission(c)).slice(0,cap);",
  'Kim mission candidate scope');
 kim=once(kim,
  "      const fulfillment=await reconcilePaidOrders(cap);",
  "      const fulfillment=await reconcilePaidOrders(cap,selectedTenant);",
  'Kim paid-order scope');
 kim=once(kim,
  "  async function reconcilePaidOrders(limit=MAX_BATCH){",
  "  async function reconcilePaidOrders(limit=MAX_BATCH,tenantId=null){",
  'Kim reconcile argument');
 kim=once(kim,
  "    const paid=(db?.orders||[]).filter(o=>/PAID|COMPLETED/i.test(String(o?.paymentStatus||o?.status||''))",
  "    const paid=(db?.orders||[]).filter(o=>tenantId===null||Number(o?.tenantId)===Number(tenantId)).filter(o=>/PAID|COMPLETED/i.test(String(o?.paymentStatus||o?.status||''))",
  'Kim paid order tenant filter');

 // Manual Kim routes also resolve tenant from the authenticated request; never use unscoped lead IDs.
 kimRoutes=once(kimRoutes,
  "const customer=typeof getCustomer==='function'?getCustomer(req.body?.leadId):null;const out=await c.runMission(customer,req.body?.interactionData||{},req.body?.options||{});",
  "const tenantId=global.__SBC_REQUIRE_TENANT(req);const customer=typeof getCustomer==='function'?getCustomer(req.body?.leadId):null;if(!customer||Number(customer.tenantId)!==Number(tenantId))throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED'});const out=await c.runMission(customer,req.body?.interactionData||{},req.body?.options||{});",
  'manual Kim lead tenant validation');
 kimRoutes=once(kimRoutes,
  "reason:req.body?.reason||",
  "tenantId:global.__SBC_REQUIRE_TENANT(req),reason:req.body?.reason||",
  'manual Kim cycle tenant argument');
 // Safe single-tenant advisory startup uses only existing tables and runtime state. It never
 // runs migrations, enables DDL, sends outreach, or creates a checkout.
 const anchor="initMysql().then(async()=>{";
 const functionSource="// SBC_V6624_EXISTING_SCHEMA_TENANT_AUTONOMY: DDL-free tenant intelligence lane.\nlet sbcNoDdlAdvisoryTimer=null,sbcNoDdlAdvisoryRunning=false;\nasync function sbcStartExistingSchemaAdvisory(){\n  if(sbcNoDdlAdvisoryTimer||SBC_RUNTIME_READ_ONLY||!mysqlPool||!MYSQL_RECOVERY_EVALUATED||MYSQL_RECOVERY_REQUIRED||!sbcWriterLeaseReady)return false;\n  let rows;\n  try{[rows]=await mysqlPool.query('SELECT DISTINCT tenant_id FROM sbc_customers WHERE tenant_id IS NOT NULL ORDER BY tenant_id LIMIT 2');}\n  catch(e){console.warn('[SBC_V6624] tenant discovery failed closed:',String(e?.code||'SCHEMA_UNAVAILABLE'));return false;}\n  if(!Array.isArray(rows)||rows.length!==1){console.warn('[SBC_V6624] exactly one tenant required; found='+Number(rows?.length||0));return false;}\n  const tenantId=Number(rows[0].tenant_id);\n  if(!Number.isSafeInteger(tenantId)||tenantId<1||!(db.customers||[]).some(c=>Number(c?.tenantId)===tenantId))return false;\n  const configured=String(process.env.SBC_AUTOMATION_TENANT_ID||'').trim();\n  if(configured&&Number(configured)!==tenantId){console.warn('[SBC_V6624] configured tenant mismatch; autonomous advisory refused');return false;}\n  const pulse=async()=>{\n    if(sbcNoDdlAdvisoryRunning||SBC_RUNTIME_READ_ONLY||!sbcWriterLeaseReady||MYSQL_RECOVERY_REQUIRED||!MYSQL_RECOVERY_EVALUATED)return;\n    sbcNoDdlAdvisoryRunning=true;\n    try{\n      const customers=(db.customers||[]).filter(c=>Number(c?.tenantId)===tenantId);\n      const orders=(db.orders||[]).filter(o=>Number(o?.tenantId)===tenantId);\n      const paid=orders.filter(o=>String(o?.paymentStatus||'').toLowerCase()==='paid').length;\n      global.__SBC_V6624_ADVISORY={tenantId,at:new Date().toISOString(),prospects:customers.length,paidOrders:paid,schemaWrites:false,outreachSent:false};\n      console.log('[SBC_V6624] verified-tenant advisory pulse',JSON.stringify(global.__SBC_V6624_ADVISORY));\n    }catch(e){console.warn('[SBC_V6624] advisory pulse error:',String(e?.code||e?.message||e).slice(0,120));}\n    finally{sbcNoDdlAdvisoryRunning=false;}\n  };\n  await pulse();\n  sbcNoDdlAdvisoryTimer=setInterval(pulse,Math.max(300000,Number(process.env.SBC_ADVISORY_INTERVAL_MS||900000)));\n  sbcNoDdlAdvisoryTimer.unref?.();\n  console.log('[SBC_V6624] DDL remains disabled; verified-tenant advisory is active; consent, payment and writer guards preserved.');\n  return true;\n}";

 server=once(server,anchor,functionSource+'\n'+anchor,'safe operational advisory declaration');
 const startup="initMysql().then(async()=>{if(SBC_RUNTIME_READ_ONLY || !SBC_DDL_ENABLED || !MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady){console.warn('[SBC_V6539_SAFE_NO_DDL_STARTUP] startup workers held: DDL opt-in absent, read-only runtime, recovery not evaluated/required, or exclusive writer lease unavailable.');return;}";
 server=once(server,startup,
 "initMysql().then(async()=>{if(SBC_RUNTIME_READ_ONLY || !SBC_DDL_ENABLED || !MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady){if(!SBC_RUNTIME_READ_ONLY && !SBC_DDL_ENABLED && MYSQL_RECOVERY_EVALUATED && !MYSQL_RECOVERY_REQUIRED && sbcWriterLeaseReady) await sbcStartExistingSchemaAdvisory();console.warn('[SBC_V6539_SAFE_NO_DDL_STARTUP] schema-changing startup workers held; verified existing-schema advisory can operate independently.');return;}",
 'start advisory without DDL');
 server=once(server,
 "    const kimMissionEnabled=false; /* SBC_V6623_SAFE_AUTOMATION_QUARANTINE: hold unattended mission cycle pending tenant scope review */",
 "    const kimMissionEnabled=String(process.env.SBC_KIM_AUTONOMOUS_ROUTINE||'false').toLowerCase()==='true' && String(process.env.SBC_AUTOMATION_TENANT_ID||'').trim()!==''; /* "+MARKER+": explicit tenant and opt-in required */",
 'governed Kim missions with explicit opt-in');
 server=once(server,
 "const out=await SBC_KIM_MISSION.cycle({limit:20,reason:'kim-mission-autopilot'});",
 "const tenantId=Number(process.env.SBC_AUTOMATION_TENANT_ID);if(!Number.isSafeInteger(tenantId)||tenantId<1||!sbcWriterLeaseReady||MYSQL_RECOVERY_REQUIRED)return;const out=await SBC_KIM_MISSION.cycle({limit:20,reason:'kim-mission-autopilot',tenantId});",
 'pass tenant to Kim cycle');
 for(const invariant of ['SBC_RUNTIME_WRITER_LEASE_REQUIRED','SBC_V6539_SAFE_NO_DDL_STARTUP','MYSQL_RECOVERY_REQUIRED','function sbcMayAutoEnableDdl(){return false;}'])if(!server.includes(invariant))throw Error(MARKER+': missing invariant '+invariant);
 fs.writeFileSync(serverFile,server);fs.writeFileSync(brainFile,brain);fs.writeFileSync(kimFile,kim);fs.writeFileSync(kimRoutesFile,kimRoutes);
 return {marker:MARKER,ddlWritesAllowed:false,autonomousEvaluationsCanCreateCheckout:false,singleTenantBusinessAdvisory:true,kimRequiresTenantAndOptIn:true};
}
module.exports={apply,MARKER};
