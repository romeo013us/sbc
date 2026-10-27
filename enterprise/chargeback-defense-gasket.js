'use strict';const crypto=require('crypto');
class ChargebackDefenseGasket{
 async interceptDisputeEvent(payload={}){if(!payload.chargeId)throw new Error('CHARGE_ID_REQUIRED');const bundle={bundleId:`EVD_${crypto.randomBytes(6).toString('hex').toUpperCase()}`,chargeId:String(payload.chargeId),trackingId:payload.trackingId||null,timestamp:new Date().toISOString(),evidenceHash:crypto.createHash('sha256').update(JSON.stringify({chargeId:payload.chargeId,trackingId:payload.trackingId||null})).digest('hex'),submission:'PREPARED_ONLY'};return {submitted:false,requiresHuman:true,reason:'PROCESSOR_DISPUTE_SUBMISSION_REQUIRES_PROVIDER_POLICY_AND_EVIDENCE_REVIEW',bundle};}
}
module.exports=ChargebackDefenseGasket;
