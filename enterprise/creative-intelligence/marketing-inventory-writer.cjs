'use strict';
// Offline trusted operator; a dedicated, non-reconnecting connection must own the runtime writer lock.
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(x),slug=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9_-]{0,63}$/.test(x);
const sizes={square:[1080,1080],landscape:[1200,628],portrait:[1080,1920]},lock='sbc:runtime:writer:v1';
const latestSql='SELECT revision,job_id,sha256,source_asset_id,logo_sha256,review_version,final_approved_sha256 FROM sbc_core_marketing_inventory WHERE tenant_id=? AND slug=? AND format=? ORDER BY revision DESC LIMIT 1';
const cas='IS_USED_LOCK(?)=CONNECTION_ID() AND (SELECT COALESCE(MAX(revision),0) FROM sbc_core_marketing_inventory WHERE tenant_id=? AND slug=? AND format=?)=?';
const unused='NOT EXISTS (SELECT 1 FROM sbc_core_marketing_source_history WHERE tenant_id=? AND (source_asset_id=? OR sha256=?))';
const time=n=>new Date(n).toISOString().replace('T',' ').replace('Z','');
function createInventoryWriter({conn,tenantId,logoSha256,campaignSlugs,reviews,assertWriter,clock=Date.now,verify}={}){
 if(!Number.isSafeInteger(tenantId)||tenantId<1||!hash(logoSha256)||!Array.isArray(campaignSlugs)||!campaignSlugs.length||campaignSlugs.length>63||campaignSlugs.some(x=>!slug(x))||new Set(campaignSlugs).size!==campaignSlugs.length||typeof conn?.execute!=='function'||typeof reviews?.get!=='function'||typeof assertWriter!=='function')throw Error('INVALID_INVENTORY_WRITER');
 const allowed=new Set(campaignSlugs),scope={tenantId,projectId:'sbc-marketing'};
 const guard=async()=>{if(await assertWriter()!==true)throw Error('INVENTORY_WRITER_REQUIRED');};
 function key(x){if(!x||!allowed.has(x.slug)||!Object.hasOwn(sizes,x.format)||!id(x.jobId)||!Number.isInteger(x.expectedRevision)||x.expectedRevision<0||x.expectedRevision>=4294967295)throw Error('INVALID_INVENTORY_WRITE');return [tenantId,x.slug,x.format];}
 async function latest(x,k){await guard();const [rows]=await conn.execute(latestSql,k);if(!Array.isArray(rows)||rows.length>1||(rows[0]?.revision??0)!==x.expectedRevision)throw Error('STALE_INVENTORY_REVISION');return rows[0]||null;}
 function review(job,asset,v){const r=reviews.get(scope,job);if(!Number.isInteger(v)||v<1||v>4294967295||r?.state!=='approved'||r.version!==v||r.assetId!==asset)throw Error('REVIEW_REQUIRED');}
 function stamp(){const n=clock();if(!Number.isSafeInteger(n)||n<0)throw Error('INVALID_INVENTORY_CLOCK');return time(n);}
 async function append(x,k,s,approval){const t=stamp();await guard();review(x.jobId,s.sourceAssetId,s.reviewVersion);
  const [r]=await conn.execute('INSERT INTO sbc_core_marketing_inventory (tenant_id,slug,format,revision,job_id,sha256,source_asset_id,logo_sha256,review_version,final_approved_sha256,final_approved_actor,final_approved_at,recorded_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? FROM DUAL WHERE '+cas+' AND '+unused,[...k,x.expectedRevision+1,x.jobId,s.sha256,s.sourceAssetId,logoSha256,s.reviewVersion,approval?s.sha256:null,approval||null,approval?t:null,t,lock,...k,x.expectedRevision,tenantId,s.sourceAssetId,s.sha256]);
  if(r.affectedRows!==1)throw Error('INVENTORY_WRITE_NOT_CONFIRMED');return {status:'REVISION_RECORDED',revision:x.expectedRevision+1,publicationReady:false};}
 async function recordStage(x){const k=key(x),s=x.stage;const [w,h]=sizes[x.format];if(!s||!hash(s.sha256)||!hash(s.sourceAssetId)||s.logoSha256!==logoSha256||s.width!==w||s.height!==h||s.mime!=='image/jpeg'||s.publicationReady!==false)throw Error('INVALID_INVENTORY_WRITE');await latest(x,k);return append(x,k,s,null);}
 function approvedSource(x,r){if(!r||r.job_id!==x.jobId||r.logo_sha256!==logoSha256||!hash(r.sha256)||!hash(r.source_asset_id))throw Error('FINAL_APPROVAL_MISMATCH');review(x.jobId,r.source_asset_id,r.review_version);return {sha256:r.sha256,sourceAssetId:r.source_asset_id,reviewVersion:r.review_version};}
 async function approve(x){const k=key(x);if(!hash(x.approvedSha256)||!id(x.actorId))throw Error('INVALID_INVENTORY_WRITE');const r=await latest(x,k),s=approvedSource(x,r);if(s.sha256!==x.approvedSha256||r.final_approved_sha256!==null)throw Error('FINAL_APPROVAL_MISMATCH');return append(x,k,s,x.actorId);}
 async function recordReadback(x){const k=key(x),r=await latest(x,k),s=approvedSource(x,r);if(r.final_approved_sha256!==s.sha256)throw Error('FINAL_APPROVAL_MISMATCH');
  const check=verify||require('../../scripts/verify-social-deploy.cjs').verifySocialDeploy;const receipt=await check(x.manifest),entry=receipt?.entries?.find(e=>e.sha256===s.sha256),[w,h]=sizes[x.format],at=Date.parse(entry?.verifiedAt),n=clock();
  if(receipt?.mediaVerified!==true||receipt.publicationReady!==false||!hash(receipt.manifestSha256)||!entry||entry.width!==w||entry.height!==h||!Number.isFinite(at)||new Date(at).toISOString()!==entry.verifiedAt||!Number.isSafeInteger(n)||at>n||n-at>60000)throw Error('INVALID_INVENTORY_READBACK');
  await guard();review(x.jobId,s.sourceAssetId,s.reviewVersion);
  const [insert]=await conn.execute('INSERT INTO sbc_core_marketing_readbacks (tenant_id,slug,format,revision,sha256,verified_at,manifest_sha256) SELECT ?,?,?,?,?,?,? FROM DUAL WHERE '+cas+' AND '+unused,[...k,x.expectedRevision,s.sha256,time(at),receipt.manifestSha256,lock,...k,x.expectedRevision,tenantId,s.sourceAssetId,s.sha256]);
  if(insert.affectedRows!==1)throw Error('INVENTORY_WRITE_NOT_CONFIRMED');return {status:'READBACK_RECORDED',revision:x.expectedRevision,publicationReady:false};}
 return Object.freeze({recordStage,approve,recordReadback});
}
module.exports={createInventoryWriter};
