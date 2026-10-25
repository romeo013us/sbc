'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {apply}=require('../hotfix-assets/apply-v6624-existing-schema-tenant-operations.js');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6624-'));
function put(name,data){const p=path.join(tmp,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,data)}
try {
 put('server.js',[
  'SBC_RUNTIME_WRITER_LEASE_REQUIRED SBC_V6539_SAFE_NO_DDL_STARTUP MYSQL_RECOVERY_REQUIRED',
  'function sbcMayAutoEnableDdl(){return false;}',

  "async function verifyRevenueLeadPool({limit=250}={}){",
  "const candidates=(db.customers||[]).filter(revenueVerificationCandidate).filter(c=>{",
  "async function processRevenueFollowups(){",
  "const rows=(db.customers||[]).filter(c=>{\n    if(isSbcSyntheticTestRecord(c))return false;",
  "async function runRevenueFirstPlay({limit=10,reason='press-play'}={}){",
  "const verification=await verifyRevenueLeadPool({limit:250});",
  "const leads=(db.customers||[]).filter(c=>!isSbcSyntheticTestRecord(c)&&['ROUTED_EMAIL','ROUTED_SMS','ROUTED_HUMAN_CALL'].includes(routeRevenueLead(c).route))",
  "try{ checkout=await REVENUE_SUPERVISOR.createCheckoutForCustomer(c,c.sbcRevenueOfferPackageId); }",
  "const followups=await processRevenueFollowups();",
  "const out=await runRevenueFirstPlay({limit,reason:'revenue-autopilot'});",
  "  const revenueAutopilotEnabled=String(process.env.SBC_REVENUE_AUTOPILOT_ENABLED||'false').toLowerCase()==='true' && false; /* SBC_V6623_SAFE_AUTOMATION_QUARANTINE: hold unattended outreach until tenant-scoped review */",

  "initMysql().then(async()=>{if(SBC_RUNTIME_READ_ONLY || !SBC_DDL_ENABLED || !MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady){console.warn('[SBC_V6539_SAFE_NO_DDL_STARTUP] startup workers held: DDL opt-in absent, read-only runtime, recovery not evaluated/required, or exclusive writer lease unavailable.');return;}",
  "    const kimMissionEnabled=false; /* SBC_V6623_SAFE_AUTOMATION_QUARANTINE: hold unattended mission cycle pending tenant scope review */",
  "const out=await SBC_KIM_MISSION.cycle({limit:20,reason:'kim-mission-autopilot'});"
 ].join('\n'));
 put('enterprise/v56134-ten-brain.js',"  if(action==='CREATE_CHECKOUT'){\n    try{");
 put('enterprise/v56135-kim-mission-controller.js',[
  "  async function cycle({limit=MAX_BATCH,reason='scheduled'}={}){",
  "      const candidates=(db?.customers||[]).filter(eligible).filter(c=>!recentMission(c)).slice(0,cap);",
  "      const autonomousOutbound=String(process.env.SBC_KIM_MISSION_AUTONOMOUS_OUTBOUND||'false').toLowerCase()==='true';",
  "      const fulfillment=await reconcilePaidOrders(cap);",
  "  async function reconcilePaidOrders(limit=MAX_BATCH){",
  "    const paid=(db?.orders||[]).filter(o=>/PAID|COMPLETED/i.test(String(o?.paymentStatus||o?.status||''))"
 ].join('\n'));
 put('routes/v56135-kim-mission.js',"const customer=typeof getCustomer==='function'?getCustomer(req.body?.leadId):null;const out=await c.runMission(customer,req.body?.interactionData||{},req.body?.options||{});\nconst result=await getController().cycle({limit:req.body?.limit||20,reason:req.body?.reason||'manual'});");
 const result=apply(tmp);
 assert.equal(result.ddlWritesAllowed,false);
 assert.equal(result.autonomousEvaluationsCanCreateCheckout,false);
 let s=fs.readFileSync(path.join(tmp,'server.js'),'utf8');
 assert.match(s,/SELECT DISTINCT tenant_id/);
 assert.match(s,/sbcStartExistingSchemaAdvisory/);
 assert.match(s,/SBC_AUTOMATION_TENANT_ID/);
 assert.match(s,/existing-schema-autopilot/);
 assert.doesNotMatch(s,/try\{ checkout=await REVENUE_SUPERVISOR\.createCheckoutForCustomer/);
 assert.match(s,/!sbcWriterLeaseReady/);
 assert.match(fs.readFileSync(path.join(tmp,'enterprise/v56134-ten-brain.js'),'utf8'),/CHECKOUT_REVIEW_REQUIRED/);
 assert.match(fs.readFileSync(path.join(tmp,'enterprise/v56135-kim-mission-controller.js'),'utf8'),/tenantId= null|tenantId=null/);
 assert.match(fs.readFileSync(path.join(tmp,'routes/v56135-kim-mission.js'),'utf8'),/global\.__SBC_REQUIRE_TENANT\(req\)/);
 assert.throws(()=>apply(tmp),/duplicate patch/);
 console.log('SBC V6624 tenant autonomy / DDL independence test PASS');
}finally{fs.rmSync(tmp,{recursive:true,force:true})}