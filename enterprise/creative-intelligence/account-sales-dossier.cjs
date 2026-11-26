'use strict';
// Trusted server-side inputs only. Dossier is a review artifact, not outreach authorization.
const {createHash}=require('node:crypto');
const {auditProspectBrand}=require('./prospect-brand-auditor.cjs');
const {suppressed,synthetic}=require('../sbc-trusted-research-v1.cjs');
const id=v=>typeof v==='string'&&/^[A-Za-z0-9:_-]{1,160}$/.test(v);
function freeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;}
function buildAccountSalesDossier({tenantRef,lead,auditSnapshot=null,now=Date.now()}={}){
 if(!id(tenantRef)||lead?.tenantRef!==tenantRef||!id(lead?.leadId))throw Error('INVALID_DOSSIER_SCOPE');
 const audit=auditProspectBrand(lead,{tenantRef,snapshot:auditSnapshot,now});
 const blocked=suppressed(lead)||synthetic(lead)||lead.suppressed===true;
 const basis=lead.leadIntelligence?.ownerTrust?.basis;
 const body={schemaVersion:1,tenantRef,leadId:lead.leadId,businessName:audit.businessName,researchBasis:['LORNA_RESEARCH_SUBMISSION','OWNER_EXISTING_BATCH'].includes(basis)?basis:null,externalVerificationConfirmed:false,contactReview:blocked?'blocked':'required',outreachAuthorized:false,websiteEvidence:{status:audit.evidenceStatus,url:audit.websiteUrl,coverage:audit.coverage,findings:audit.findings},creativeReadiness:{hasApprovedPreview:false,reason:'WEBSITE_PREVIEW_NOT_INDEPENDENTLY_VERIFIED'},recommendedOffer:blocked?null:audit.recommendedPackage,talkingPoints:{openerEn:blocked?null:audit.salesBrief.openerEn,openerEs:blocked?null:audit.salesBrief.openerEs,proofPoints:blocked?[]:audit.salesBrief.proofPoints},reviewRequired:true,automaticOutreach:false,verificationStatusChanged:false};
 return freeze({...body,dossierSha256:createHash('sha256').update(JSON.stringify(body)).digest('hex')});
}
module.exports=Object.freeze({buildAccountSalesDossier});
