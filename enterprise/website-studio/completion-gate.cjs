'use strict';
// Publication is an audited fulfillment event, never a side effect of generation.
// Readiness must be independently verified and confirmed by the publishing service.
const requirements=Object.freeze([
 ['content','Customer-approved content and verified identity'],
 ['media','Licensed/approved visual assets'],
 ['forms','End-to-end inquiry/booking receipt with anti-spam protections'],
 ['privacy','Consent and privacy requirements'],
 ['domain','Customer-authorized domain and hosting'],
 ['ssl','Live HTTPS and DNS verification'],
 ['accessibility','Rendered accessibility tests'],
 ['performance','Live performance measurements'],
 ['seo','Published SEO and schema checks'],
 ['customerApproval','Recorded final customer sign-off'],
 ['rollback','Verified deploy rollback and backup']
]);
const isReceipt=value=>value&&typeof value==='object'&&!Array.isArray(value)&&value.passed===true&&
 typeof value.evidenceId==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(value.evidenceId)&&
 typeof value.verifiedAt==='string'&&!Number.isNaN(Date.parse(value.verifiedAt))&&
 Date.parse(value.verifiedAt)<=Date.now();
function evaluateCompletion(receipts={}){
 const checks=requirements.map(([key,label])=>({key,label,passed:isReceipt(receipts?.[key])===true}));
 const missing=checks.filter(c=>!c.passed).map(c=>c.key);
 // Evidence completeness alone is NOT a publication authorization. A separate
 // owner-controlled deployment transaction must issue the release permit.
 return {evidenceComplete:missing.length===0,readyToPublish:false,complete:false,missing,checks};
}
module.exports={evaluateCompletion,requirements};
