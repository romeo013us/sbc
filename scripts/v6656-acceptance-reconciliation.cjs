'use strict';
// Offline aggregate-only audit. Does not connect to providers or mutate business data.
const fs=require('node:fs'),path=require('node:path');
const valid=v=>Number.isSafeInteger(v)&&v>=0;
function check(id,known,passes,detail){
 return {id,status:!known?'UNVERIFIED':passes?'REPORTED_CONSISTENT':'DISCREPANCY',detail};
}
function evaluate(doc={}){
 const db=doc.databaseAudit||{},ui=doc.dashboard||{},runtime=doc.runtime||{},pay=doc.payments||{},biz=doc.business||{},restore=doc.restore||{};
 const checks=[];
 const add=(...x)=>checks.push(check(...x));
 const source=String(runtime.sourceCommit||''),preview=String(runtime.previewCommit||'');
 const bound=/^[0-9a-f]{40}$/i.test(source)&&/^[0-9a-f]{7,40}$/i.test(preview);
 add('goDaddy_source_identity',bound,bound&&source.startsWith(preview),{sourceCommit:bound?source:null,previewCommit:bound?preview:null});
 const p=runtime.preview||{};
 const browserKnown=[p.startupHealthy,p.desktopUsable,p.mobileUsable].every(x=>typeof x==='boolean')&&valid(p.stableSeconds);
 add('preview_boot_and_stability',browserKnown,p.startupHealthy&&p.desktopUsable&&p.mobileUsable&&p.stableSeconds>=60,{stableSeconds:valid(p.stableSeconds)?p.stableSeconds:null});
 const a=db.table_counts?.sbc_customers,b=db.table_counts?.sbc_orders;
 add('crm_total_reconciles',valid(a)&&valid(ui.totalCRM),a===ui.totalCRM,{mysql:valid(a)?a:null,dashboard:valid(ui.totalCRM)?ui.totalCRM:null});
 add('orders_total_reconciles',valid(b)&&valid(ui.totalOrders),b===ui.totalOrders,{mysql:valid(b)?b:null,dashboard:valid(ui.totalOrders)?ui.totalOrders:null});
 const l=ui.qualifiedLeads,other=ui.salesQualifiedLeads;
 const same=valid(l?.count)&&valid(other?.count)&&typeof l?.definition==='string'&&l.definition.length>0&&l.definition===other?.definition&&l.tenantScope===other?.tenantScope;
 add('qualified_lead_views_reconcile',same,l?.count===other?.count,{counts:[valid(l?.count)?l.count:null,valid(other?.count)?other.count:null],sameMetricDefinition:same});
 const amounts=['squareCapturedCents','sbcLedgerCapturedCents','accountingGrossCents'].map(k=>pay[k]);
 const measured=amounts.every(valid);
 add('captured_gross_reconciles',measured,measured&&amounts.every(x=>x===amounts[0]),{amountsCents:measured?amounts:null});
 const provider=pay.providerCaptureVerified===true&&pay.signedWebhookVerified===true&&pay.accountingReviewed===true&&measured;
 add('provider_capture_and_webhook_evidence',provider||[pay.providerCaptureVerified,pay.signedWebhookVerified,pay.accountingReviewed].some(x=>x===false),provider,{actualProviderEvidenceNotAutomaticallyValidated:true});
 const independentRestore=restore.independentBackupRestored===true&&restore.recordIntegrityChecked===true&&restore.tenantIsolationChecked===true&&/^https:\/\//.test(String(restore.evidenceReference||''));
 add('independent_production_backup_restore',independentRestore||restore.independentBackupRestored===false,independentRestore,{syntheticCIIsInsufficient:true});
 const sold=biz.providerPaidCustomerOrder===true&&biz.customerAcceptedDelivery===true&&biz.durableCRMHistoryVerified===true&&valid(biz.grossMarginCents);
 add('real_customer_sale_and_delivery',sold||biz.providerPaidCustomerOrder===false||biz.customerAcceptedDelivery===false,sold,{recordedMarginCents:valid(biz.grossMarginCents)?biz.grossMarginCents:null});
 const blockers=checks.filter(x=>x.status!=='REPORTED_CONSISTENT').map(x=>x.id);
 return {protocol:'SBC_V6656_THREE_TRACK_DIAGNOSTIC',status:'NOT_CERTIFIED_INDEPENDENT_REVIEW_REQUIRED',
  checks,blockers,reportedConsistent:checks.length-blockers.length,checksTotal:checks.length,
  noProductionWrites:true,
  limitations:['Input figures are owner-supplied aggregates, not independently verified provider records.',
   'Matching zero-dollar counts cannot establish real revenue or business performance.',
   'The V66.55 strict Build/SaaS/Company grading gate remains mandatory. No 95/100 grade is inferred.']};
}
if(require.main===module){
 const args=process.argv.slice(2),i=args.indexOf('--input');
 if(i<0||!args[i+1]){console.error('Usage: node scripts/v6656-acceptance-reconciliation.cjs --input local-aggregates.json');process.exitCode=2;}
 else{const doc=JSON.parse(fs.readFileSync(path.resolve(args[i+1]),'utf8'));const result=evaluate(doc);console.log(JSON.stringify(result,null,2));if(args.includes('--require-consistent')&&result.blockers.length)process.exitCode=2;}
}
module.exports={evaluate};
