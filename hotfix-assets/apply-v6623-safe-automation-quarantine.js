'use strict';
const fs=require('node:fs');
const path=require('node:path');
const MARKER='SBC_V6623_SAFE_AUTOMATION_QUARANTINE';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' anchor count '+n);return s.replace(a,b)}
function apply(root){
 const serverPath=path.join(root,'server.js');
 const enginePath=path.join(root,'enterprise','v56170-six-phase-autopilot.js');
 let server=fs.readFileSync(serverPath,'utf8');
 let engine=fs.readFileSync(enginePath,'utf8');
 if(server.includes(MARKER)||engine.includes(MARKER))throw Error(MARKER+': already applied');
 server=once(server,
   '      SIX_PHASE_V56170.start();',
   "      console.warn('["+MARKER+"] automatic six-phase sales cycle held until order provenance has been verified; owner dashboard remains available.');",
   'unattended six-phase engine');
 server=once(server,
   "  const revenueAutopilotEnabled=String(process.env.SBC_REVENUE_AUTOPILOT_ENABLED||'true').toLowerCase()!=='false';",
   "  const revenueAutopilotEnabled=String(process.env.SBC_REVENUE_AUTOPILOT_ENABLED||'false').toLowerCase()==='true' && false; // "+MARKER+": hold unattended outreach until tenant-scoped review",
   'outreach worker default');
 server=once(server,
   "    const kimMissionEnabled=String(process.env.SBC_KIM_AUTONOMOUS_ROUTINE||'true').toLowerCase()!=='false';",
   "    const kimMissionEnabled=false; // "+MARKER+": hold unattended mission cycle pending tenant scope review",
   'Kim autonomous worker');
 server=once(server,
   'startMissionControl(); startEliteCloserSupervisor(); startEliteHardeningSupervisor(); startRevenueAutopilotSupervisor(); startRevenueGrowthSupervisor(); startGrowthLedger();',
   "console.warn('["+MARKER+"] unscoped sales supervisors held; manual CRM, owner approval and paid-order processing remain available.');",
   'unscoped sales supervisors');
 server=once(server,
   "if(String(process.env.SBC_GOD_TIER_REVENUE_ENABLED||'true').toLowerCase()==='false')return;",
   "if(String(process.env.SBC_GOD_TIER_REVENUE_ENABLED||'false').toLowerCase()!=='true')return; // "+MARKER+": explicit opt-in only",
   'God Tier reconciliation default');
 engine=once(engine,
   'async function phase4(c){if(c.autopilotCheckoutUrl)return {ok:true,existing:true,url:c.autopilotCheckoutUrl};',
   "async function phase4(c){if(c.autopilotCheckoutUrl)return {ok:true,existing:true,url:c.autopilotCheckoutUrl};return {ok:false,held:true,reason:'"+MARKER+"_ORDER_CREATION_DISABLED',requiresOwnerReview:true};",
   'automatic order creation');
 engine=once(engine,
   "if(!c){await mark(job,'FAILED','customer_not_found');continue;}if(job.phase==='OUTBOUND')",
   "if(!c){await mark(job,'FAILED','customer_not_found');continue;}if(!Number.isSafeInteger(Number(job.tenant_id))||Number(job.tenant_id)<1||Number(c.tenantId)!==Number(job.tenant_id)){await mark(job,'FAILED','tenant_scope_mismatch');continue;}if(job.phase==='OUTBOUND')",
   'queued outbound tenant validation');
 for(const item of ['MYSQL_RECOVERY_REQUIRED','SBC_RUNTIME_WRITER_LEASE_REQUIRED','SBC_V6539_SAFE_NO_DDL_STARTUP'])if(!server.includes(item))throw Error(MARKER+': missing existing guard '+item);
 fs.writeFileSync(serverPath,server);
 fs.writeFileSync(enginePath,engine);
 return {marker:MARKER,changed:true,automatedOrderCreationHeld:true,unscopedSalesJobsHeld:true,queuedJobsTenantChecked:true,crmWrites:false,recoveryGateUnchanged:true};
}
module.exports={apply,MARKER};