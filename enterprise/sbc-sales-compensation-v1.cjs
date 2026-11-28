'use strict';
/* SBC Sales Command V1 — pure compensation math, no transfers, no fulfillment.
 * Rates are PROPOSED TERMS until an owner records each worker's signed agreement.
 * Revenue means verified, owner-reconciled collected sales, net of refunds.
 */
const TIERS=Object.freeze({
 standard:Object.freeze({hourlyCents:500,quotaCents:260000,commissionBps:1000}),
 senior:Object.freeze({hourlyCents:600,quotaCents:433300,commissionBps:1500}),
 // Versioned contract keys are stored in the existing immutable monthly terms and statement tier fields.
 standard_v2:Object.freeze({hourlyCents:500,quotaCents:216700,commissionBps:900}),
 senior_v2:Object.freeze({hourlyCents:600,quotaCents:433300,commissionBps:1200})
});
const TEAM_DAILY_TARGET_CENTS=60000;
const TEAM_MONTHLY_TARGET_CENTS=1300000;
const VALID_ID=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;
function id(v){const x=String(v??'');if(!VALID_ID.test(x))throw Error('INVALID_SALES_IDENTIFIER');return x;}
function tenant(v){const n=Number(v);if(!Number.isSafeInteger(n)||n<1)throw Error('SALES_TENANT_REQUIRED');return n;}
function monthKey(v){
 const m=String(v??'');
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(m))throw Error('INVALID_SALES_MONTH');
 return m;
}
const monthFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit'});
function miamiMonth(date){
 const d=new Date(date);
 if(!Number.isFinite(d.getTime()))throw Error('INVALID_CAPTURE_TIMESTAMP');
 const parts=monthFormatter.formatToParts(d);
 return parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;
}
function amount(v,name='INVALID_CREDIT_AMOUNT'){
 if(!Number.isSafeInteger(v)||v<0||v>100000000000)throw Error(name);
 return v;
}
function credit(input,{tenantId,managerId}={}){
 const c=input||{};
 if(tenant(c.tenantId)!==tenant(tenantId))throw Error('CREDIT_TENANT_MISMATCH');
 if(id(c.managerId)!==id(managerId))throw Error('CREDIT_MANAGER_MISMATCH');
 if(c.proofVerified!==true)throw Error('CAPTURE_PROOF_REQUIRED');
 if(c.ownerAttested!==true)throw Error('OWNER_COST_ATTESTATION_REQUIRED');
 if(!['NEW_CUSTOMER','ACTIVE_UPSELL','MANUALLY_SOLD_RENEWAL'].includes(c.source))
  throw Error('CREDIT_SOURCE_INVALID');
 const gross=amount(c.grossCents),refund=amount(c.refundCents??0),
       direct=amount(c.directCostCents),labor=amount(c.laborCents??0),
       fees=amount(c.processingCents??0);
 if(gross<=0||refund>gross)throw Error('INVALID_CREDIT_AMOUNT');
 const grossNet=gross-refund;
 return {orderId:id(c.orderId),managerId:id(c.managerId),tenantId:tenant(c.tenantId),
   capturedAt:String(c.capturedAt),source:c.source,grossCents:grossNet,
   directCostCents:direct,laborCents:labor,processingCents:fees,
   refundCents:refund,profitCents:grossNet-direct-labor-fees};
}
function statement({tenantId,managerId,month,tier,credits=[]}={}){
 const t=tenant(tenantId),m=id(managerId),period=monthKey(month);
 if(!Object.hasOwn(TIERS,tier))throw Error('INVALID_COMPENSATION_TIER');
 if(!Array.isArray(credits)||credits.length>10000)throw Error('SALES_CREDIT_SNAPSHOT_INVALID');
 const found=new Set(),included=[];
 for(const raw of credits){
  const c=credit(raw,{tenantId:t,managerId:m});
  if(found.has(c.orderId))throw Error('DUPLICATE_SALES_CREDIT');
  found.add(c.orderId);
  if(miamiMonth(c.capturedAt)===period)included.push(c);
 }
 const revenueCents=included.reduce((v,c)=>v+c.grossCents,0);
 const profitCents=included.reduce((v,c)=>v+c.profitCents,0);
 if(!Number.isSafeInteger(revenueCents)||!Number.isSafeInteger(profitCents))throw Error('SALES_TOTAL_OVERFLOW');
 const config=TIERS[tier],eligible=revenueCents>=config.quotaCents;
 const commissionCents=eligible?Math.round(Math.max(0,profitCents)*config.commissionBps/10000):0;
 return {tenantId:t,managerId:m,month:period,tier,
  quotaCents:config.quotaCents,commissionBps:config.commissionBps,
  hourlyCents:config.hourlyCents,orderCount:included.length,revenueCents,profitCents,
  goalAttainmentPercent:Math.round(revenueCents/config.quotaCents*10000)/100,
  eligible,commissionCents,commissionStatus:eligible?'ELIGIBLE_PENDING_OWNER_REVIEW':'BELOW_QUOTA',
  paymentInitiated:false,ownerApprovalRequired:true,proof:'OWNER_RECONCILED_SBC_RECORDED_SQUARE_CAPTURE; NOT BANK_SETTLEMENT'};
}
module.exports={TIERS,TEAM_DAILY_TARGET_CENTS,TEAM_MONTHLY_TARGET_CENTS,tenant,id,monthKey,miamiMonth,amount,credit,statement};
