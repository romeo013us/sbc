'use strict';
const assert=require('node:assert/strict');
const {evaluate}=require('./v6656-acceptance-reconciliation.cjs');
const none=evaluate();
assert.equal(none.status,'NOT_CERTIFIED_INDEPENDENT_REVIEW_REQUIRED');
assert.equal(none.checks.every(x=>x.status==='UNVERIFIED'),true);
const doc={runtime:{sourceCommit:'a'.repeat(40),previewCommit:'aaaaaaa',preview:{startupHealthy:true,desktopUsable:true,mobileUsable:true,stableSeconds:90}},
 databaseAudit:{table_counts:{sbc_customers:499,sbc_orders:251}},
 dashboard:{totalCRM:499,totalOrders:251,qualifiedLeads:{count:495,definition:'active-qualified',tenantScope:'7'},salesQualifiedLeads:{count:483,definition:'active-qualified',tenantScope:'7'}},
 payments:{squareCapturedCents:0,sbcLedgerCapturedCents:0,accountingGrossCents:0},
 restore:{independentBackupRestored:false},business:{providerPaidCustomerOrder:false}};
const result=evaluate(doc);
assert.equal(result.checks.find(x=>x.id==='qualified_lead_views_reconcile').status,'DISCREPANCY');
assert.equal(result.checks.find(x=>x.id==='provider_capture_and_webhook_evidence').status,'UNVERIFIED');
assert.equal(result.status,'NOT_CERTIFIED_INDEPENDENT_REVIEW_REQUIRED');
const conflict=evaluate({...doc,databaseAudit:{table_counts:{sbc_customers:498,sbc_orders:252}},payments:{squareCapturedCents:34900,sbcLedgerCapturedCents:30000,accountingGrossCents:34900}});
for(const id of ['crm_total_reconciles','orders_total_reconciles','captured_gross_reconciles'])
 assert.equal(conflict.checks.find(x=>x.id===id).status,'DISCREPANCY',id);
const unrelated=evaluate({...doc,dashboard:{...doc.dashboard,salesQualifiedLeads:{count:483,definition:'sales-ready-only',tenantScope:'7'}}});
assert.equal(unrelated.checks.find(x=>x.id==='qualified_lead_views_reconcile').status,'UNVERIFIED');
const all={...doc,dashboard:{...doc.dashboard,salesQualifiedLeads:{count:495,definition:'active-qualified',tenantScope:'7'}},
 payments:{squareCapturedCents:34900,sbcLedgerCapturedCents:34900,accountingGrossCents:34900,providerCaptureVerified:true,signedWebhookVerified:true,accountingReviewed:true},
 restore:{independentBackupRestored:true,recordIntegrityChecked:true,tenantIsolationChecked:true,evidenceReference:'https://example.org/evidence'},
 business:{providerPaidCustomerOrder:true,customerAcceptedDelivery:true,durableCRMHistoryVerified:true,grossMarginCents:1000}};
assert.equal(evaluate(all).blockers.length,0);
assert.equal(evaluate(all).status,'NOT_CERTIFIED_INDEPENDENT_REVIEW_REQUIRED');
console.log('[SBC V6656] PASS aggregate-only three-track acceptance diagnostics, no fake revenue, same-definition lead comparison, missing evidence fails');
