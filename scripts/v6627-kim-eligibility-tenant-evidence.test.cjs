'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {apply,strictVerified}=require('../hotfix-assets/apply-v6627-kim-eligibility-tenant-evidence.js');
for(const value of ['verified','VERIFIED','PASSED','sales_ready','sales-ready']){
 assert.equal(strictVerified({verificationStatus:value}),true,'approved status '+value);
}
for(const value of ['unverified','not verified','pending verification','needs-verification','failed','revoked','VERIFIED_PENDING']){
 assert.equal(strictVerified({verificationStatus:value,verified:true}),false,'explicit negative/uncertain '+value);
}
assert.equal(strictVerified({verified:true}),true);
assert.equal(strictVerified({verified:false}),false);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6627-'));
const put=(name,data)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);};
try{
 const kim=[
 "function suppressed(c){return c?.doNotContact===true||c?.salesSuppressed===true||String(c?.status||'').toLowerCase()==='do not contact';}",
 "function eligible(c){",
 "  const verification=String(c.verificationStatus||'').toLowerCase();",
 "  const temp=String(c.leadTemperature||'').toLowerCase();",
 "  return (verification.includes('verified')||verification==='passed'||c.verified===true) && (temp==='warm'||temp==='hot');",
 "}",
 "function sbcAdvisoryScreen(db, tenantId, limit, eligible, recentMission) {",
 "  const scopedId=Number(tenantId);",
 "  const all=(Array.isArray(db?.customers)?db.customers:[]).filter(c=>Number(c?.tenantId)===scopedId);",
 "  const verified=all.filter(eligible);const ready=verified.filter(c=>!recentMission(c));",
 "  return {ok:true,advisoryOnly:true,tenantId:scopedId,tenantCustomers:all.length,",
 "    qualifiedWarmHot:verified.length,prospects:ready.length};",
 "}",
 "async function runMission(customer){",
 "    if(!customer)throw new Error('Customer is required.');",
 "    const evaluation=await tenBrain.evaluate({customer,tenantId:customer.tenantId||1,interactionData});",
 "}"
 ].join('\n');
 const server="MYSQL_RECOVERY_REQUIRED SBC_RUNTIME_WRITER_LEASE_REQUIRED\nconsole.log(JSON.stringify({tenantCustomers:result?.tenantCustomers||0,qualifiedWarmHot:result?.qualifiedWarmHot||0}));";
 put('enterprise/v56135-kim-mission-controller.js',kim);put('server.js',server);
 const result=apply(root);
 assert.equal(result.verifiedSubstringRemoved,true);
 const output=fs.readFileSync(path.join(root,'enterprise/v56135-kim-mission-controller.js'),'utf8');
 assert.doesNotMatch(output,/verification\.includes\('verified'\)/);
 assert.doesNotMatch(output,/customer\.tenantId\|\|1/);
 assert.match(output,/Number\.isSafeInteger\(Number\(customer\.tenantId\)\)/);
 assert.match(output,/unresolvedTenantRecords/);
 const runtime=vm.runInNewContext(output.replace(/async function runMission[\s\S]*$/,''),{});
 assert.equal(runtime,undefined);
 const env={};vm.createContext(env);vm.runInContext(output.replace(/async function runMission[\s\S]*$/,''),env);
 const leads=[
  {tenantId:1,leadTemperature:'hot',verificationStatus:'unverified'},
  {tenantId:1,leadTemperature:'warm',verificationStatus:'VERIFIED'},
  {tenantId:1,leadTemperature:'warm',verificationStatus:'pending'},
  {tenantId:null,leadTemperature:'hot',verificationStatus:'verified'},
  {tenantId:2,leadTemperature:'hot',verificationStatus:'verified'}
 ];
 const summary=env.sbcAdvisoryScreen({customers:leads},1,10,env.eligible,()=>false);
 assert.equal(summary.tenantCustomers,3);
 assert.equal(summary.tenantWarmHot,3);
 assert.equal(summary.unresolvedTenantRecords,1);
 assert.equal(summary.qualifiedWarmHot,1);
 assert.throws(()=>apply(root),/duplicate patch/);
 console.log('V6627 explicit Kim eligibility, tenant fail-closed and aggregate diagnostics PASS');
}finally{fs.rmSync(root,{recursive:true,force:true})}