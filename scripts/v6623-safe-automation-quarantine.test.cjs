'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {apply,MARKER}=require('../hotfix-assets/apply-v6623-safe-automation-quarantine.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6623-'));
const put=(rel,s)=>{const p=path.join(root,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s)};
try{
 put('server.js',[
 'MYSQL_RECOVERY_REQUIRED SBC_RUNTIME_WRITER_LEASE_REQUIRED SBC_V6539_SAFE_NO_DDL_STARTUP',
 '      SIX_PHASE_V56170.start();',
 "  const revenueAutopilotEnabled=String(process.env.SBC_REVENUE_AUTOPILOT_ENABLED||'true').toLowerCase()!=='false';",
 "    const kimMissionEnabled=String(process.env.SBC_KIM_AUTONOMOUS_ROUTINE||'true').toLowerCase()!=='false';",
 'startMissionControl(); startEliteCloserSupervisor(); startEliteHardeningSupervisor(); startRevenueAutopilotSupervisor(); startRevenueGrowthSupervisor(); startGrowthLedger();',
 "if(String(process.env.SBC_GOD_TIER_REVENUE_ENABLED||'true').toLowerCase()==='false')return;"
 ].join('\n'));
 put('enterprise/v56170-six-phase-autopilot.js',[
 'async function phase4(c){if(c.autopilotCheckoutUrl)return {ok:true,existing:true,url:c.autopilotCheckoutUrl};',
 "if(!c){await mark(job,'FAILED','customer_not_found');continue;}if(job.phase==='OUTBOUND')"
 ].join('\n'));
 const result=apply(root);
 assert.equal(result.automatedOrderCreationHeld,true);
 assert.equal(result.queuedJobsTenantChecked,true);
 const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
 const engine=fs.readFileSync(path.join(root,'enterprise/v56170-six-phase-autopilot.js'),'utf8');
 assert.ok(!server.includes('SIX_PHASE_V56170.start();'));
 assert.ok(!server.includes('startMissionControl(); startEliteCloserSupervisor();'));
 assert.ok(engine.includes("reason:'"+MARKER+"_ORDER_CREATION_DISABLED'"));
 assert.ok(engine.includes("Number(c.tenantId)!==Number(job.tenant_id)"));
 assert.ok(server.includes('MYSQL_RECOVERY_REQUIRED'));
 assert.ok(server.includes('SBC_RUNTIME_WRITER_LEASE_REQUIRED'));
 assert.throws(()=>apply(root),/already applied/);
 console.log('SBC V6623 order prevention and tenant-scoped queue hold PASS');
}finally{fs.rmSync(root,{recursive:true,force:true})}