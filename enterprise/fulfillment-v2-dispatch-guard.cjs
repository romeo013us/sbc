'use strict';
/* Fulfillment 2.0: fail-closed guard for external vendor purchases.
 * This module does not place orders or grant authorization.
 */
const {providerCapturedSquare}=require('./v6640-payment-evidence.cjs');
function reject(code){throw Object.assign(new Error(code),{code,status:409});}
function assertVendorDispatchAuthorized(job){
  if(!job||!Number.isSafeInteger(Number(job.tenantId))||Number(job.tenantId)<1||!String(job.id||'').trim()||!String(job.orderId||'').trim())reject('VENDOR_JOB_IDENTITY_REQUIRED');
  if(job.testOnly===true||job.isTest===true||job.qaMode===true||/^(?:qa|test)[-_]/i.test(String(job.orderId)))reject('VENDOR_QA_DISPATCH_FORBIDDEN');
  // Require an actual reconciled payment record; no synthetic paid flag on a job.
  if(!job.paymentEvidence||!providerCapturedSquare(job.paymentEvidence))reject('VENDOR_CONFIRMED_PAYMENT_REQUIRED');
  if(String(job.paymentEvidence.id||'')!==String(job.orderId)||Number(job.paymentEvidence.tenantId)!==Number(job.tenantId))reject('VENDOR_PAYMENT_ORDER_MISMATCH');
  if(job.ownerApproval?.approved!==true||!String(job.ownerApproval.actorId||'').trim()||!String(job.ownerApproval.approvedAt||'').trim())reject('VENDOR_OWNER_APPROVAL_REQUIRED');
  if(job.vendorSubmissionStatus==='SUBMITTED'||job.vendorSubmissionStatus==='SUBMISSION_OUTCOME_UNKNOWN'||job.vendorSubmissionStatus==='NEEDS_RECONCILIATION')reject('VENDOR_RECONCILIATION_REQUIRED');
  if(!String(job.idempotencyKey||'').trim())reject('VENDOR_IDEMPOTENCY_KEY_REQUIRED');
  return true;
}
module.exports={assertVendorDispatchAuthorized};
