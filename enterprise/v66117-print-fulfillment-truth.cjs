'use strict';
/* SBC V66.117: read-only print desk from EXISTING, tenant-scoped orders/jobs.
 * No artificial margin, vendor confirmations, outside API, AI, or new state.
 */
const PRINT=/\b(business\s+cards?|flyers?|brochures?|postcards?|banners?|door\s*hangers?|print(?:ing|ed)?|labels?|stickers?)\b/i;
function vendorName(input){
 const id=String(input||'').toLowerCase().replace(/[^a-z]/g,'');
 return id==='fouroverfour'?'4OVER4':id==='vistaprint'?'VistaPrint':id==='internal'?'SBC Internal':'Unassigned';
}
function validVendorOrderId(raw){
 const id=String(raw||'').trim();
 if(!/^[A-Za-z0-9][A-Za-z0-9._:/#-]{3,119}$/.test(id))return false;
 if(/^(?:test(?:ing)?|demo|fake|pending|unknown|none|n\/a|tbd|no.?order|manual[-_]\d+|placeholder)(?:[-_:].*)?$/i.test(id))return false;
 return true;
}
function jobIsPrint(j){
 const supplier=vendorName(j?.vendor);
 return supplier==='4OVER4'||supplier==='VistaPrint'||PRINT.test(String(j?.product||''))||String(j?.category||'').toLowerCase()==='print';
}
function validDate(s){const n=Date.parse(String(s||''));return Number.isFinite(n)?n:0}
function summarize({tenantId,orders=[],jobs=[],paymentConfirmed=()=>false,limit=100}={}){
 const tid=Number(tenantId);
 if(!Number.isSafeInteger(tid)||tid<1)throw Object.assign(new Error('TENANT_REQUIRED'),{code:'TENANT_REQUIRED'});
 const scopedOrders=new Map((Array.isArray(orders)?orders:[]).filter(o=>Number(o?.tenantId)===tid&&o.id).map(o=>[String(o.id),o]));
 const matching=(Array.isArray(jobs)?jobs:[]).filter(j=>Number(j?.tenantId)===tid&&jobIsPrint(j)).slice(0,10000);
 const results=matching.map(j=>{
   const order=scopedOrders.get(String(j.orderId||'')),provider=vendorName(j.vendor);
   let paid=false;
   try{paid=!!(order&&paymentConfirmed(order))}catch{paid=false}
   const stage=String(j.status||'').trim().toLowerCase();
   const vstatus=String(j.vendorStatus||'').trim().toLowerCase();
   const orderReference=String(j.vendorOrderNumber||'').trim();
   const receipt=validVendorOrderId(orderReference);
   const approved=j.requirements?.artworkApproved===true||j.requirements?.proofApproved===true||Boolean(j.requirements?.proofApprovedAt);
   const revenue=Number(order?.price);
   const cost=Number(j.actualCost||j.verifiedCost||0);
   // Order value is a bundle total, not revenue attributable to each print line.
   // A raw default cost of 0 must not be shown as profit.
   let status,nextAction;
   if(!order){status='ORPHAN_ORDER';nextAction='Recover the matching paid order before processing';}
   else if(!paid){status='PAYMENT_PROOF_REQUIRED';nextAction='Reconcile the payment evidence before any vendor submission';}
   else if(stage==='needs_reconciliation'||vstatus==='submission_outcome_unknown'){status='VENDOR_RECONCILIATION';nextAction='Check supplier portal before any retry to prevent duplicates';}
   else if(['delivered','fulfilled','completed'].includes(stage)){status='DELIVERED';nextAction='Confirm delivery and close the customer record';}
   else if(['shipped','dispatched'].includes(stage)){status='SHIPPED';nextAction='Track the shipment and notify the customer';}
   else if(['submitted','in_production','processing'].includes(stage)||['submitted','in_production'].includes(vstatus)){
     status=receipt?'SUPPLIER_IN_PROGRESS':'VENDOR_RECEIPT_MISSING';
     nextAction=receipt?'Track the supplier order':'Reconcile supplier submission and record a real order number';
   }else if(stage==='failed'||stage==='blocked'){status='BLOCKED';nextAction='Review the failed job before any resubmission';}
   else if(j.requiresOwnerClearance&&!j.ownerClearanceAt){status='OWNER_APPROVAL_REQUIRED';nextAction='Review the existing owner financial approval';}
   else if(!approved){status='PROOF_AND_DETAILS_REVIEW';nextAction='Check approved artwork, quantity, finish and shipping information';}
   else{status='READY_FOR_MANUAL_SUPPLIER_ORDER';nextAction='Place the authorized supplier order and record its real receipt';}
   return {jobId:String(j.id||''),orderId:String(j.orderId||''),customerName:String(order?.customerName||j.customerName||'').slice(0,120),
     product:String(j.product||'').slice(0,180),quantity:Number(j.quantity||1),provider,status,nextAction,
     stage:stage||'unknown',vendorOrderNumber:receipt?orderReference:null,orderPaid:paid,
     recordedCostKnown:cost>0,orderGrossAmount:Number.isFinite(revenue)&&revenue>=0?revenue:null,
     printLineMargin:null,createdAt:String(j.createdAt||''),
     note:'Order gross amount may include other bundled services. Print-line profit is not asserted without allocated revenue and verified supplier cost.'};
 }).sort((a,b)=>validDate(b.createdAt)-validDate(a.createdAt));
 const counts={};
 for(const j of results)counts[j.status]=(counts[j.status]||0)+1;
 const needed=results.filter(x=>!['DELIVERED','SHIPPED','SUPPLIER_IN_PROGRESS'].includes(x.status)).length;
 return {version:'66.117',source:'EXISTING_TENANT_FULFILLMENT_JOBS',tenantId:tid,totalPrintJobs:results.length,needsOwnerAttention:needed,
   counts,rows:results.slice(0,Math.max(1,Math.min(200,Number(limit)||100))),
   caveats:['No supplier order is placed by this report','Unknown artwork approval is flagged for review, not asserted as failed',
     'A completed Square payment does not itself prove supplier submission','Profit margins require allocated print-line revenue and evidenced wholesale/shipping costs']};
}
module.exports={validVendorOrderId,vendorName,jobIsPrint,summarize};
