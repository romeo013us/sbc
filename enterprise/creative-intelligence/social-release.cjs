'use strict';
// Trusted offline operator only. A candidate ZIP is not a publication receipt.
const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const {stageSocialJpeg}=require('./social-jpeg.cjs'),{storedZip}=require('./website-export.cjs');
const hash=b=>createHash('sha256').update(b).digest('hex'),isHash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
async function buildSocialRelease({entries,priorSourceIds,...options}){
 if(!Array.isArray(entries)||entries.length<1||entries.length>3||!Array.isArray(priorSourceIds)||priorSourceIds.some(x=>!isHash(x)))throw Error('INVALID_SOCIAL_RELEASE');
 const seen=new Set(priorSourceIds),jobs=new Set(),digests=new Set(),files={},publicEntries=[],privateReceipts=[];
 for(const entry of entries){
  if(!entry||Object.keys(entry).length!==3||typeof entry.jobId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(entry.jobId)||!isHash(entry.approvedSha256)||!Number.isSafeInteger(entry.reviewVersion)||entry.reviewVersion<1||jobs.has(entry.jobId))throw Error('INVALID_SOCIAL_RELEASE');
  jobs.add(entry.jobId);
  const stage=await stageSocialJpeg({...options,jobId:entry.jobId});
  if(stage.sha256!==entry.approvedSha256||stage.reviewVersion!==entry.reviewVersion)throw Error('SOCIAL_FINAL_APPROVAL_REQUIRED');
  if(seen.has(stage.sourceAssetId)||digests.has(stage.sha256))throw Error('SOCIAL_CREATIVE_REUSED');
  if(typeof stage.alt!=='string'||!stage.alt.trim()||stage.alt.length>180||/[\x00-\x1f\x7f]/.test(stage.alt))throw Error('INVALID_SOCIAL_ALT');
  seen.add(stage.sourceAssetId);digests.add(stage.sha256);
  const bytes=await fs.readFile(path.join(options.outputRoot,stage.file));if(hash(bytes)!==stage.sha256||bytes.length!==stage.bytes)throw Error('SOCIAL_STAGE_INTEGRITY');
  const name='assets/social/campaigns/'+stage.sha256+'.jpg';files[name]=bytes;
  publicEntries.push({sha256:stage.sha256,url:'https://sbcmia.com/'+name,alt:stage.alt,mime:stage.mime,width:stage.width,height:stage.height,bytes:stage.bytes});
  privateReceipts.push({jobId:entry.jobId,sourceAssetId:stage.sourceAssetId,reviewVersion:stage.reviewVersion,sha256:stage.sha256});
 }
 const scope={tenantId:options.tenantId,projectId:'sbc-marketing'};
 // Recheck every approval before returning the handoff; never package private customer media.
 for(const r of privateReceipts){const current=await options.reviews.exportApproved(scope,r.jobId),review=options.reviews.get(scope,r.jobId);if(review?.state!=='approved'||review.version!==r.reviewVersion||current.asset.id!==r.sourceAssetId)throw Error('REVIEW_REQUIRED');}
 const manifest={schemaVersion:1,publicationReady:false,entries:publicEntries};
 files['assets/social/campaigns/manifest.json']=JSON.stringify(manifest,null,2)+'\n';
 return {publicationReady:false,manifest,files,zip:storedZip(files),privateReceipts};
}
module.exports={buildSocialRelease};
