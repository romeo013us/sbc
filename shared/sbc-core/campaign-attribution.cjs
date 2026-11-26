'use strict';
// Matching only; callers must read trusted campaign, checkout and verified provider records.
// No financial mutations, authorization, net-revenue totals or causal attribution.
const channels=new Set(['facebook','instagram','linkedin','google_business']);
const id=v=>typeof v==='string'&&/^[A-Za-z0-9:_-]{1,160}$/.test(v);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const slug=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,63}$/.test(v);
const hintOK=x=>x&&channels.has(x.channel)&&slug(x.campaignSlug)&&sha(x.assetSha256);
const sameHint=(a,b)=>hintOK(a)&&hintOK(b)&&['channel','campaignSlug','assetSha256'].every(k=>a[k]===b[k]);
const timestamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v?Date.parse(v):NaN;
function parseInboundAttributionHint(q){
 if(!q||typeof q!=='object'||Array.isArray(q)||q.utm_medium!=='organic_social')return null;
 const h={channel:q.utm_source,campaignSlug:q.utm_campaign,assetSha256:q.utm_content};return hintOK(h)?Object.freeze(h):null;
}
function matchCaptureAttribution({tenantRef,campaign,checkout,ledger,verifiedPayment}={}){
 const reject=reason=>Object.freeze({eligible:false,reason,paymentAuthority:false});
 if(!id(tenantRef)||![campaign,checkout,ledger,verifiedPayment].every(r=>r&&r.tenantRef===tenantRef))return reject('TENANT_OR_RECORD_MISMATCH');
 if(campaign.status!=='published'||!sameHint(campaign,checkout))return reject('CAMPAIGN_NOT_MATCHED');
 if(!sha(ledger.eventKey)||checkout.eventKey!==ledger.eventKey||verifiedPayment.eventKey!==ledger.eventKey||ledger.kind!=='capture'||ledger.environment!=='production'||!['square','stripe'].includes(ledger.provider)||!id(ledger.accountId)||!id(checkout.paymentId)||verifiedPayment.paymentId!==checkout.paymentId||![checkout,verifiedPayment].every(r=>['provider','environment','accountId'].every(k=>r[k]===ledger[k])))return reject('PAYMENT_NOT_MATCHED');
 const published=timestamp(campaign.publishedAt),created=timestamp(checkout.createdAt),paid=timestamp(ledger.occurredAt);
 if(![published,created,paid].every(Number.isFinite)||published>created||created>paid)return reject('TIMELINE_INVALID');
 if(!Number.isSafeInteger(ledger.amountMinor)||ledger.amountMinor<=0||typeof ledger.currency!=='string'||!/^[A-Z]{3}$/.test(ledger.currency))return reject('LEDGER_AMOUNT_INVALID');
 return Object.freeze({eligible:true,tenantRef,eventKey:ledger.eventKey,provider:ledger.provider,accountId:ledger.accountId,paymentId:checkout.paymentId,channel:campaign.channel,campaignSlug:campaign.campaignSlug,assetSha256:campaign.assetSha256,amountMinor:ledger.amountMinor,currency:ledger.currency,revenueBasis:'gross_capture_candidate',causalProof:false,paymentAuthority:false});
}
module.exports=Object.freeze({parseInboundAttributionHint,matchCaptureAttribution});
