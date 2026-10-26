'use strict';
// SBC V66.55: no inferred grades, no averages masking an individual weak system.
// Submitted evidence is NEVER equivalent to independent provider certification.
const fs=require('node:fs'),path=require('node:path');
const VERSION='SBC_95_THREE_TRACK_V2',THRESHOLD=95;
const RUBRIC=Object.freeze({
 build:[
  {id:'source_bound_reproducible_deploy_rollback',weight:15,kinds:['CI','ROLLBACK']},
  {id:'published_stability_and_performance',weight:15,kinds:['PERFORMANCE']},
  {id:'authenticated_desktop_mobile_control_audit',weight:15,kinds:['LIVE_BROWSER']},
  {id:'tenant_authentication_and_writer_security',weight:20,kinds:['SECURITY']},
  {id:'backup_restore_disaster_recovery',weight:20,kinds:['RESTORE']},
  {id:'observability_alerting_and_incident_response',weight:15,kinds:['OPERATIONS']}
 ],
 saas:[
  {id:'tenant_scoped_crm_leads_and_permissions',weight:20,kinds:['SECURITY','LIVE_BROWSER']},
  {id:'square_checkout_webhook_paid_reconciliation',weight:20,kinds:['SQUARE','SIGNED_WEBHOOK']},
  {id:'paid_order_delivery_and_owner_gates',weight:15,kinds:['FULFILLMENT']},
  {id:'twilio_consent_call_and_crm_logging',weight:10,kinds:['VOICE']},
  {id:'mobile_accessibility_and_no_silent_clicks',weight:15,kinds:['LIVE_BROWSER','ACCESSIBILITY']},
  {id:'data_durability_and_tenant_restore',weight:10,kinds:['RESTORE']},
  {id:'customer_onboarding_billing_and_support',weight:10,kinds:['SUPPORT']}
 ],
 company:[
  {id:'verified_qualified_prospect_pipeline',weight:15,kinds:['CRM_OPERATIONS']},
  {id:'measured_outreach_conversion',weight:20,kinds:['CRM_OPERATIONS']},
  {id:'settled_revenue_and_accounting_agreement',weight:25,kinds:['SQUARE','ACCOUNTING']},
  {id:'measured_costs_margins_and_runway',weight:15,kinds:['ACCOUNTING']},
  {id:'delivered_orders_and_customer_acceptance',weight:15,kinds:['CUSTOMER']},
  {id:'renewals_retention_and_service_quality',weight:10,kinds:['CUSTOMER','ACCOUNTING']}
 ]
});
const KINDS=new Set(['CI','ROLLBACK','PERFORMANCE','LIVE_BROWSER','SECURITY','RESTORE','OPERATIONS','SQUARE','SIGNED_WEBHOOK','FULFILLMENT','VOICE','ACCESSIBILITY','SUPPORT','CRM_OPERATIONS','ACCOUNTING','CUSTOMER']);
const CRITICAL=new Set([
 'source_bound_reproducible_deploy_rollback','authenticated_desktop_mobile_control_audit',
 'tenant_authentication_and_writer_security','backup_restore_disaster_recovery',
 'tenant_scoped_crm_leads_and_permissions','square_checkout_webhook_paid_reconciliation',
 'paid_order_delivery_and_owner_gates','data_durability_and_tenant_restore',
 'settled_revenue_and_accounting_agreement'
]);
const TTL_DAYS={build:30,saas:45,company:90};
function validArtifact(a){
 return !!a&&KINDS.has(a.kind)&&typeof a.reference==='string'&&
 /^https:\/\/[^\s<>]{10,500}$/.test(a.reference)&&
 /^[a-f0-9]{64}$/i.test(String(a.sha256||''));
}
function assess(item,criterion,domain,commit,now){
 const time=typeof item?.observedAt==='string'?Date.parse(item.observedAt):NaN;
 const timely=Number.isFinite(time)&&time<=now+300000&&time>=now-TTL_DAYS[domain]*86400000;
 const score=typeof item?.score==='number'&&Number.isFinite(item.score)&&item.score>=0&&item.score<=100?item.score:null;
 const artifacts=Array.isArray(item?.artifacts)?item.artifacts:[];
 const kinds=new Set(artifacts.map(a=>a?.kind));
 const complete=artifacts.length>0&&artifacts.every(validArtifact)&&criterion.kinds.every(k=>kinds.has(k));
 const claimed=item?.verified===true&&item?.commit===commit&&!!commit&&timely&&complete&&score!==null;
 const meets=claimed&&score>=THRESHOLD;
 return {id:criterion.id,weight:criterion.weight,critical:CRITICAL.has(criterion.id),
  submittedScore:claimed?score:null,status:!claimed?'UNVERIFIED':meets?'SUBMITTED_95_OR_BETTER':'BELOW_95',
  expectedEvidence:criterion.kinds};
}
function evaluate(doc={},opts={}){
 const now=opts.now instanceof Date?opts.now.getTime():Number.isFinite(opts.now)?opts.now:Date.now();
 const commit=/^[a-f0-9]{40}$/i.test(String(doc.commit||''))?doc.commit:null;
 const sections={},blockers=[];
 for(const [name,items] of Object.entries(RUBRIC)){
  const entries=items.map(c=>assess(doc?.[name]?.[c.id],c,name,commit,now));
  const full=entries.every(e=>e.submittedScore!==null);
  const weighted=full?Number(entries.reduce((sum,e)=>sum+e.submittedScore*e.weight/100,0).toFixed(2)):null;
  const failed=entries.filter(e=>e.status!=='SUBMITTED_95_OR_BETTER');
  blockers.push(...failed.map(e=>name+'.'+e.id));
  sections[name]={
    status:full&&weighted>=THRESHOLD&&failed.length===0?'ELIGIBLE_FOR_INDEPENDENT_REVIEW':'NOT_CERTIFIED',
    submittedScore:weighted,coverage:entries.filter(e=>e.submittedScore!==null).length+'/'+entries.length,
    checks:entries,blockers:failed.map(e=>e.id)
  };
 }
 const eligible=!!commit&&Object.values(sections).every(x=>x.status==='ELIGIBLE_FOR_INDEPENDENT_REVIEW');
 return {protocol:VERSION,commit,status:eligible?'ELIGIBLE_FOR_INDEPENDENT_REVIEW':'NO_GO',
   thresholdPerTrack:THRESHOLD,thresholdPerSubsystem:THRESHOLD,
   officeBoxAuthorized:false,sections,blockers,
   warning:'Evidence references and submitted scores are unverified claims until an independent reviewer checks provider records, live browser performance, restore logs and accounting. CI cannot certify the Company or SaaS operations. This tool never reads private databases or authorizes Office Box.'};
}
if(require.main===module){
 const args=process.argv.slice(2),i=args.indexOf('--evidence');
 let data={};if(i>=0){if(!args[i+1])throw Error('Missing --evidence path');data=JSON.parse(fs.readFileSync(path.resolve(args[i+1]),'utf8'));}
 const out=evaluate(data);console.log(JSON.stringify(out,null,2));
 if(args.includes('--require-95')&&out.status!=='ELIGIBLE_FOR_INDEPENDENT_REVIEW')process.exitCode=2;
}
module.exports={evaluate,RUBRIC,KINDS,CRITICAL,VERSION,THRESHOLD};
