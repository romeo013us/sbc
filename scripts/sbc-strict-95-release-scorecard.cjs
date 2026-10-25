'use strict';
/* An evidence-driven release gate: unknown is NOT a passing grade. */
const fs=require('node:fs'),path=require('node:path');
const RELEASE='SBC_9_5_VERIFICATION_PROTOCOL_V1';
const domains={
 company:[
  ['qualified_pipeline',20],['confirmed_paid_sales',25],['verified_gross_margin_and_runway',20],
  ['successful_fulfillment',20],['customer_satisfaction_or_retention',15]
 ],
 saas:[
  ['authorized_tenant_scoped_CRM',25],['paid_checkout_webhook_fulfillment',25],
  ['consented_Twilio_call_and_CRM_log',15],['tenant_RBAC_and_consent',15],
  ['tested_backup_restore',10],['stable_usable_mobile_desktop_UI',10]
 ],
 build:[
  ['matching_commit_and_green_source_CI',20],['authenticated_live_browser_regression',20],
  ['measured_goDaddy_real_user_performance',15],['security_and_tenant_integrity',20],
  ['read_only_recovery_and_restore_drill',15],['repeatable_deployment_and_rollback',10]
 ]
};
const mustPass=[
 'stable_usable_mobile_desktop_UI','authorized_tenant_scoped_CRM','paid_checkout_webhook_fulfillment',
 'tenant_RBAC_and_consent','tested_backup_restore','repeatable_deployment_and_rollback'
];
function evaluate(doc){
 const sections={};let allPass=true;
 for(const [name,criteria] of Object.entries(domains)){
  let verifiedPoints=0,verifiedCount=0;
  const details=criteria.map(([id,weight])=>{
   const e=doc?.[name]?.[id];
   const verified=e?.verified===true &&
     typeof e?.evidence==='string' && e.evidence.trim().length>=10 &&
     typeof e?.observedAt==='string' && !Number.isNaN(Date.parse(e.observedAt));
   if(verified){verifiedPoints+=weight;verifiedCount++;}
   return {id,weight,status:verified?'EVIDENCE_CLAIMED':'UNVERIFIED',evidence:verified?e.evidence:null};
  });
  // Do not give a precise global score when any dimension is unmeasured.
  const complete=verifiedCount===criteria.length;
  const status=complete&&verifiedPoints>=95?'CANDIDATE_PASS':'NOT_CERTIFIED';
  if(status!=='CANDIDATE_PASS')allPass=false;
  sections[name]={verifiedPoints,maxPoints:100,coverage:verifiedCount+'/'+criteria.length,status,criteria:details};
 }
 const p0=mustPass.map(id=>{
  const source=Object.entries(domains).find(([,values])=>values.some(([x])=>x===id));
  const e=doc?.[source?.[0]]?.[id];
  return {id,verified:!!(e?.verified===true && typeof e.evidence==='string'&&e.evidence.trim().length>=10)};
 });
 const sha=String(doc?.commit||'');
 const sourceBound=/^[a-f0-9]{40}$/i.test(sha);
 const p0Pass=p0.every(x=>x.verified);
 const status=allPass&&p0Pass&&sourceBound?'ELIGIBLE_FOR_OWNER_FINAL_REVIEW':'NO_GO';
 return {protocol:RELEASE,commit:sourceBound?sha:null,status,minimumPerDimension:95,
   allCriticalGatesPassing:p0Pass,sections,p0,
   note:'Evidence claims need independent owner/provider verification. CI tests alone never certify Company, SaaS or live Production. No live payments, contacts or data changes are performed.'};
}
if(require.main===module){
 const args=process.argv.slice(2);
 const evidenceFlag=args.indexOf('--evidence');
 const filename=evidenceFlag>=0?args[evidenceFlag+1]:null;
 let source={};
 if(filename){source=JSON.parse(fs.readFileSync(path.resolve(filename),'utf8'));}
 const result=evaluate(source);
 console.log(JSON.stringify(result,null,2));
 if(args.includes('--require-95')&&result.status!=='ELIGIBLE_FOR_OWNER_FINAL_REVIEW')process.exitCode=2;
}
module.exports={evaluate,domains,mustPass,RELEASE};