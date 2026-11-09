'use strict';
// SBC V66.140. Read-only eligibility + all-lines-complete check. No AI/provider I/O.
const DONE=new Set(['completed','complete','fulfilled','delivered']);
const PRINT=/\b(business\s+cards?|flyers?|brochures?|postcards?|banners?|door\s*hangers?|print(?:ing|ed)?|labels?|stickers?|dtf|shirts?|apparel)\b/i;
const NO_ARTWORK=/^(?:office\s*box(?:\s+(?:subscription|service|account|access|plan))?|(?:microsoft\s*365|m365)(?:\s+(?:email|setup|license|mailbox))?|(?:business\s+)?email(?:\s+(?:mailbox|setup|account))?|domain\s+(?:registration|renewal|setup)|(?:web\s+)?hosting(?:\s+(?:renewal|setup|subscription))?|ssl\s+(?:certificate|renewal|setup))$/i;
function noArtworkService(order){
 const items=Array.isArray(order?.items)?order.items:[];
 if(items.length!==1)return false;
 const name=String(items[0]?.name||'').trim();
 if(PRINT.test(name)||/\b(bundle|starter|complete|essentials|growth|website|design|wordpress|package|launch)\b/i.test(name))return false;
 return NO_ARTWORK.test(name);
}
function validTracking(number){
 const n=String(number||'').trim();
 return /^[A-Za-z0-9_-]{6,150}$/.test(n)&&!/^(?:test|demo|fake|pending|unknown|none|placeholder|notavailable|tbd)/i.test(n);
}
function validReceipt(number){
 const n=String(number||'').trim();
 return /^[A-Za-z0-9][A-Za-z0-9._:/#-]{3,119}$/.test(n)&&!/^(?:test|demo|fake|pending|unknown|none|placeholder|tbd)/i.test(n);
}
function summary({components=[],jobs=[]}={}){
 const parts=Array.isArray(components)?components:[];
 const checked=Array.isArray(jobs)?jobs:[];
 const multi=parts.length>1;
 const ids=parts.map(x=>String(x?.id||'').trim());
 if(!multi)return {requiresAllLines:false,ready:true,total:parts.length,complete:0,missing:[],status:'SINGLE_SERVICE'};
 if(ids.some(x=>!x)||new Set(ids).size!==ids.length)return {requiresAllLines:true,ready:false,total:parts.length,complete:0,missing:ids,status:'MAPPING_REQUIRED'};
 let completed=0;
 const entries=parts.map(x=>{
  const id=String(x.id).trim();
  const matching=checked.filter(j=>String(j?.item_id??j?.itemId??'')===id);
  const job=matching.length===1?matching[0]:null;
  const state=String(job?.status||'').toLowerCase();
  const vendorState=String(job?.vendor_status??job?.vendorStatus??'').toLowerCase();
  const supplier=String(job?.vendor||'').toLowerCase().replace(/[^a-z]/g,'');
  const isPrint=PRINT.test(String(x?.name||job?.product||''))||['fouroverfour','vistaprint'].includes(supplier);
  const isInternal=supplier==='internal';
  const done=!!job&&DONE.has(state)&&(isInternal?(!vendorState||DONE.has(vendorState)):DONE.has(vendorState));
  const vendorReceipt=isInternal||validReceipt(job?.vendor_order_number??job?.vendorOrderNumber);
  const deliveryEvidence=!isPrint||validTracking(job?.tracking_number??job?.trackingNumber);
  const ready=done&&vendorReceipt&&deliveryEvidence;
  if(ready)completed++;
  return {itemId:id,itemName:String(x?.name||'SBC service').slice(0,100),ready,
    reason:!job?'MISSING_DURABLE_JOB':!done?'JOB_NOT_DELIVERED':!vendorReceipt?'VENDOR_RECEIPT_REQUIRED':!deliveryEvidence?'TRACKING_PROOF_REQUIRED':'COMPLETE'};
 });
 return {requiresAllLines:true,ready:completed===parts.length,total:parts.length,complete:completed,
   missing:entries.filter(x=>!x.ready),status:completed===parts.length?'ALL_LINES_COMPLETE':'BUNDLE_ITEMS_OPEN'};
}
module.exports={noArtworkService,summary,PRINT};
