'use strict';
// Trusted server-side SELECT adapter. No writes, scheduling, or publication authority.
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const slug=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9_-]{0,63}$/.test(x);
const version=x=>Number.isSafeInteger(x)&&x>=1;
async function loadInventoryInputs(pool,{tenantId,bank,logoSha256,reviews,now=Date.now()}={}){
 if(!Number.isSafeInteger(tenantId)||tenantId<1||!hash(logoSha256)||!Number.isSafeInteger(now)||now<0||typeof reviews?.get!=='function'||!Array.isArray(bank?.holiday)||!Array.isArray(bank?.campaigns)||bank.holiday.length>3||bank.campaigns.length>60)throw Error('INVALID_INVENTORY_STORAGE_SCOPE');
 const campaigns=[...bank.holiday,...bank.campaigns],slugs=campaigns.map(c=>c?.slug),allowed=new Set(slugs);
 if(!slugs.length||slugs.some(s=>!slug(s))||allowed.size!==slugs.length)throw Error('INVALID_INVENTORY_STORAGE_SCOPE');
 const sql=`SELECT CAST(s.tenant_id AS CHAR) AS tenantId,s.slug,s.format,s.job_id AS jobId,s.sha256,s.source_asset_id AS sourceAssetId,s.logo_sha256 AS logoSha256,s.review_version AS reviewVersion,s.final_approved_sha256 AS finalApprovedSha256,
 (SELECT CONCAT(LEFT(DATE_FORMAT(MAX(r.verified_at),'%Y-%m-%dT%H:%i:%s.%f'),23),'Z') FROM sbc_core_marketing_readbacks r WHERE r.tenant_id=s.tenant_id AND r.slug=s.slug AND r.format=s.format AND r.revision=s.revision AND r.sha256=s.sha256) AS verifiedAt
 FROM (SELECT m.*,ROW_NUMBER() OVER(PARTITION BY m.slug,m.format ORDER BY m.revision DESC) AS rn FROM sbc_core_marketing_inventory m WHERE m.tenant_id=? AND m.slug IN (${slugs.map(()=>'?').join(',')})) s WHERE s.rn=1 LIMIT 190`;
 const [rows]=await pool.execute({sql,timeout:3000},[tenantId,...slugs]);
 if(!Array.isArray(rows)||rows.length>189)throw Error('INVALID_INVENTORY_STORAGE_ROW');
 const [history]=await pool.execute({sql:'SELECT DISTINCT CAST(tenant_id AS CHAR) AS tenantId,source_asset_id AS sourceAssetId,sha256 FROM sbc_core_marketing_source_history WHERE tenant_id=? LIMIT 100001',timeout:3000},[tenantId]);
 if(!Array.isArray(history)||history.length>100000||history.some(h=>h?.tenantId!==String(tenantId)||!hash(h.sourceAssetId)||!hash(h.sha256)))throw Error('INVALID_INVENTORY_HISTORY');
 const used=new Set(history.map(h=>h.sourceAssetId)),usedDigests=new Set(history.map(h=>h.sha256)),keys=new Set(),assets=[];
 for(const r of rows){
  if(!r||r.tenantId!==String(tenantId)||!allowed.has(r.slug)||!['square','landscape','portrait'].includes(r.format)||typeof r.jobId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(r.jobId)||![r.sha256,r.sourceAssetId,r.logoSha256].every(hash)||!version(r.reviewVersion)||(r.finalApprovedSha256!==null&&r.finalApprovedSha256!==r.sha256)||keys.has(r.slug+':'+r.format))throw Error('INVALID_INVENTORY_STORAGE_ROW');
  keys.add(r.slug+':'+r.format);if(usedDigests.has(r.sha256))used.add(r.sourceAssetId);
  const current=reviews.get({tenantId,projectId:'sbc-marketing'},r.jobId),approved=current?.state==='approved'&&current.version===r.reviewVersion&&current.assetId===r.sourceAssetId;
  assets.push({slug:r.slug,format:r.format,sha256:r.sha256,sourceAssetId:r.sourceAssetId,logoSha256:r.logoSha256,reviewVersion:r.reviewVersion,currentReviewVersion:version(current?.version)?current.version:r.reviewVersion,reviewState:approved?'approved':'unreviewed',finalApprovedSha256:approved?r.finalApprovedSha256:null,verifiedAt:approved?r.verifiedAt:null});
 }
 if(used.size>100000)throw Error('INVALID_INVENTORY_HISTORY');
 return {bank,campaigns,assets,usedSourceIds:[...used],logoSha256,now};
}
module.exports={loadInventoryInputs};
