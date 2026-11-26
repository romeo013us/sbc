'use strict';
// Read-only projection of trusted operator evidence. No scheduling or publication authority.
const FORMATS=Object.freeze(['square','landscape','portrait']);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const slug=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,63}$/.test(v);
const version=v=>Number.isSafeInteger(v)&&v>=1;
function projectInventory({campaigns,assets,usedSourceIds,logoSha256,now=Date.now()}={}){
 if(!Array.isArray(campaigns)||campaigns.length>63||campaigns.some(c=>!slug(c?.slug))||!Array.isArray(assets)||assets.length>189||!Array.isArray(usedSourceIds)||usedSourceIds.length>100000||!usedSourceIds.every(hash)||!hash(logoSha256)||!Number.isSafeInteger(now)||now<0)throw Error('INVALID_INVENTORY_INPUT');
 const planned=new Set(campaigns.map(c=>c.slug)),used=new Set(usedSourceIds),byKey=new Map(),digests=new Set(),sourceOwners=new Map();
 if(planned.size!==campaigns.length)throw Error('INVENTORY_CONFLICT');
 for(const a of assets){
  if(!a||!planned.has(a.slug)||!FORMATS.includes(a.format)||![a.sha256,a.sourceAssetId,a.logoSha256].every(hash)||!version(a.reviewVersion)||!version(a.currentReviewVersion)||!['approved','rejected','unreviewed'].includes(a.reviewState))throw Error('INVALID_INVENTORY_ASSET');
  const key=a.slug+':'+a.format;if(byKey.has(key)||digests.has(a.sha256)||(sourceOwners.has(a.sourceAssetId)&&sourceOwners.get(a.sourceAssetId)!==a.slug))throw Error('INVENTORY_CONFLICT');byKey.set(key,a);digests.add(a.sha256);sourceOwners.set(a.sourceAssetId,a.slug);
 }
 const states={missing:0,previously_used:0,logo_mismatch:0,review_required:0,final_review_required:0,readback_required:0,media_verified:0},rows=[];
 for(const campaign of campaigns)for(const format of FORMATS){
  const a=byKey.get(campaign.slug+':'+format);let state='missing';
  if(a){const at=Date.parse(a.verifiedAt);state=used.has(a.sourceAssetId)?'previously_used':a.logoSha256!==logoSha256?'logo_mismatch':a.reviewState!=='approved'||a.currentReviewVersion!==a.reviewVersion?'review_required':a.finalApprovedSha256!==a.sha256?'final_review_required':!Number.isFinite(at)||new Date(at).toISOString()!==a.verifiedAt||at>now||now-at>3600000?'readback_required':'media_verified';}
  states[state]++;rows.push({slug:campaign.slug,format,state,sha256:a?.sha256||null});
 }
 return {schemaVersion:1,planned:rows.length,states,rows,publicationReady:false,requiresTrustedEvidence:true};
}
module.exports={projectInventory};
