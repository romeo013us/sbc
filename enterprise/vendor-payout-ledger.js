'use strict';const crypto=require('crypto');
class VendorPayoutLedger{
 constructor(){this.vaultBalanceCents=0}
 async splitMargins(tx,gross,cost,policy={}){const g=Math.max(0,Number(gross)||0),c=Math.max(0,Number(cost)||0);if(c>g)return {ok:false,error:'WHOLESALE_COST_EXCEEDS_GROSS'};const spread=g-c;const approval=policy.autoPayout===true&&policy.providerConfigured===true;return {splitId:`SPL_${crypto.randomBytes(6).toString('hex').toUpperCase()}`,transactionId:tx,grossCents:g,costCents:c,netSpreadCents:spread,payoutAuthorized:approval,payoutSubmitted:false,requiresHuman:!approval};}
}
module.exports=VendorPayoutLedger;
