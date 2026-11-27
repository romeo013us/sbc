'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {getCampaignRevenueSummary}=require('../shared/sbc-core/campaign-roi.cjs');
test('gross captures preserve currency and integer precision, never claim net settled revenue',async()=>{
 const records=[{campaignSlug:'bf2026',channel:'facebook',assetSha256:'a'.repeat(64),currency:'USD',captureCount:'2',grossMinor:'90071992547409930'},{campaignSlug:'bf2026',channel:'facebook',assetSha256:'a'.repeat(64),currency:'EUR',captureCount:'1',grossMinor:'10000'}];
 const r=await getCampaignRevenueSummary({execute:async(_q,args)=>{assert.deepEqual(args,['sbc:1',30]);return [records];}},{tenantRef:'sbc:1'});
 assert.equal(r.revenueBasis,'gross_attributed_captures');assert.equal(r.netRevenueAvailable,false);assert.equal(r.rows[0].grossMinor,'90071992547409930');assert.equal(r.rows[1].currency,'EUR');assert.equal(r.rows.length,2);
});
test('invalid scope and time range never access database; invalid output fails closed',async()=>{
 const pool={execute:async()=>assert.fail('must not query')};for(const p of [{tenantRef:''},{tenantRef:'sbc:1',days:0},{tenantRef:'sbc:1',days:'30'},{tenantRef:'sbc:1',days:366}])await assert.rejects(getCampaignRevenueSummary(pool,p),/INVALID_CAMPAIGN_REPORT/);
 await assert.rejects(getCampaignRevenueSummary({execute:async()=>[[{grossMinor:'NaN'}]]},{tenantRef:'sbc:1'}),/INVALID_CAMPAIGN_ROW/);
});
