'use strict';
// Read-only candidate report. Gross capture associations, not settlement or net ROI.
const SQL=`SELECT a.campaign_slug AS campaignSlug,a.channel,a.asset_sha256 AS assetSha256,t.currency,
 CAST(COUNT(*) AS CHAR) AS captureCount,CAST(SUM(t.amount_minor) AS CHAR) AS grossMinor
 FROM sbc_core_campaign_ledger_attributions a
 JOIN sbc_core_transactions_ledger t ON t.tenant_ref=a.tenant_ref AND t.event_key=a.event_key AND t.provider=a.provider AND t.environment=a.environment AND t.account_id=a.account_id
 JOIN sbc_core_campaign_registry c ON c.tenant_ref=a.tenant_ref AND c.channel=a.channel AND c.campaign_slug=a.campaign_slug AND c.asset_sha256=a.asset_sha256
 WHERE a.tenant_ref=? AND t.kind='capture' AND t.environment='production' AND c.published_at<=t.occurred_at AND t.occurred_at>=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL ? DAY) AND t.occurred_at<=UTC_TIMESTAMP(3)
 GROUP BY a.campaign_slug,a.channel,a.asset_sha256,t.currency ORDER BY a.campaign_slug,a.channel,a.asset_sha256,t.currency LIMIT 501`;
async function getCampaignRevenueSummary(pool,{tenantRef,days=30}={}){
 if(typeof tenantRef!=='string'||!/^[A-Za-z0-9:_-]{1,160}$/.test(tenantRef)||!Number.isInteger(days)||days<1||days>365)throw Error('INVALID_CAMPAIGN_REPORT');
 const [rows]=await pool.execute({sql:SQL,timeout:3000},[tenantRef,days]);
 if(!Array.isArray(rows)||rows.length>500)throw Error('CAMPAIGN_REPORT_LIMIT');
 const result=rows.map(r=>{if(typeof r.campaignSlug!=='string'||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(r.campaignSlug)||!['facebook','instagram','linkedin','google_business'].includes(r.channel)||typeof r.assetSha256!=='string'||!/^[a-f0-9]{64}$/.test(r.assetSha256)||typeof r.currency!=='string'||!/^[A-Z]{3}$/.test(r.currency)||![r.captureCount,r.grossMinor].every(v=>typeof v==='string'&&/^[1-9][0-9]{0,64}$/.test(v)))throw Error('INVALID_CAMPAIGN_ROW');return {campaignSlug:r.campaignSlug,channel:r.channel,assetSha256:r.assetSha256,currency:r.currency,captureCount:r.captureCount,grossMinor:r.grossMinor};});
 return {days,revenueBasis:'gross_attributed_captures',netRevenueAvailable:false,causalProof:false,rows:result};
}
module.exports={getCampaignRevenueSummary};
