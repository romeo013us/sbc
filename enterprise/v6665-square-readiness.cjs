'use strict';
// V66.65: Pure, non-mutating Square launch triage. This is not payment proof.
// Never include access tokens, customer data, order IDs or raw provider errors.
function assess(input={}){
 const configured=input.configured===true;
 const webhookConfigured=input.webhookConfigured===true;
 const writerReady=input.writerReady===true;
 const ownerPaused=input.ownerPaused===true;
 const providerReachable=input.provider?.reachable===true;
 const environment=['production','sandbox'].includes(input.environment)?input.environment:'unknown';
 const providerCode=String(input.provider?.code||'UNKNOWN');
 const safeProviderCode=/^(?:HTTP_(?:400|401|403|404|429|500|502|503|504)|NOT_CONFIGURED|TIMEOUT|PROVIDER_UNREACHABLE|LOCATION_MISMATCH|LOCATION_INACTIVE|LOCATION_ACTIVE|UNKNOWN)$/.test(providerCode)?providerCode:'UNKNOWN';
 const blockers=[];
 if(!configured)blockers.push({code:'SQUARE_PROVIDER_NOT_CONFIGURED',action:'Review Square access token, environment and location ID in GoDaddy Secrets; do not paste credentials.'});
 if(configured&&!providerReachable)blockers.push({code:'SQUARE_LOCATION_NOT_REACHABLE',action:'Check Square environment, location permission and provider status. This GET-only probe did not confirm an active location.'});
 if(!webhookConfigured)blockers.push({code:'SQUARE_WEBHOOK_NOT_CONFIGURED',action:'Confirm the Square webhook URL and signature key. Do not create a charge to test this setting.'});
 if(!writerReady)blockers.push({code:'SBC_WRITER_OR_RECOVERY_GATE',action:'Inspect owner launch-gates for writer lease, MySQL connectivity and recovery state; do not force-unlock.'});
 if(ownerPaused)blockers.push({code:'OWNER_CHECKOUTS_PAUSED',action:'Use normal owner governance to review the pause, only after all safety checks pass.'});
 const preflightReady=blockers.length===0;
 return {
  status:preflightReady?'PREFLIGHT_READY_LIVE_PAYMENT_NOT_PROVEN':'PREFLIGHT_BLOCKED',
  preflightReady,
  productionCertified:false,
  paymentCapturedAndReconciled:false,
  signedWebhookObserved:false,
  fulfillmentVerified:false,
  environment,
  locationProbeCode:safeProviderCode,
  blockers,
  autonomousSquareCircuit:'NOT_OBSERVED_BY_THIS_ENDPOINT',
  incidentNote:'An earlier Square circuit-open message is not proof of current state. Check current activity and payment readiness without retrying pending orders.',
  nextEvidence:['Owner-supervised Square sandbox or approved small test purchase',
    'Provider-confirmed COMPLETED payment matching order, location, currency and amount',
    'Authenticated signed webhook and idempotent CRM reconciliation',
    'Fulfillment and rollback verification on a non-customer test order'],
  safeOperations:{readOnly:true,newOrdersCreated:false,paymentLinksCreated:false,chargesInitiated:false,recoveryUnlocked:false}
 };
}
module.exports={assess};
