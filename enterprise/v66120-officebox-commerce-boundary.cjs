'use strict';
/** One-time SBC Square orders never originate a recurring Office Box entitlement.
 * Office Box recurring plans are billed by a provider-verified subscription rail;
 * this check only rejects unsafe sales orders, and creates no payment/link/tenant.
 */
const OWN=Object.prototype.hasOwnProperty;
const OFFICE_ID=/^office[\s_-]?box(?:[\s_-]|$)/i;
const OFFICE_NAME=/^(?:sbc\s+)?office\s+box(?:\s+|$)/i;
const META=['officeBoxSku','officeBoxPlan','officeBoxPlanId','officeBoxSubscriptionId',
  'officeBoxSubscription','officeBoxV2CorrelationId','officeBoxActivationUrl',
  'officeBoxActivationSentAt','officeBoxV2Status','officeBoxV2ReconciledAt'];
const has=(v,k)=>Boolean(v&&typeof v==='object'&&OWN.call(v,k));
function officePlanLine(line){
  if(!line||typeof line!=='object')return false;
  if(has(line,'officeBoxSku')||has(line,'officeBoxPlan'))return true;
  if(OFFICE_ID.test(String(line.sku||'').trim())||
     OFFICE_ID.test(String(line.id||'').trim()))return true;
  return OFFICE_NAME.test(String(line.name||'').trim());
}
function protectedNotes(notes){
  if(!notes||typeof notes!=='object'||Array.isArray(notes))return false;
  return META.some(k=>has(notes,k))||
    (Array.isArray(notes.items)&&notes.items.some(officePlanLine));
}
function guardOneTimeSquareSale(body,items){
  if(protectedNotes(body)||
     Array.isArray(items)&&items.some(officePlanLine)||
     (body&&typeof body==='object'&&officePlanLine(body)))
    return Object.freeze({ok:false,status:422,code:'OFFICEBOX_RECURRING_CHECKOUT_REQUIRED'});
  return Object.freeze({ok:true});
}
module.exports={officePlanLine,protectedNotes,guardOneTimeSquareSale};
