'use strict';
/**
 * Super SBC: strict, read-only channel identity and attribution contract.
 * Additive: no connectors, secrets, external requests, database writes, posting,
 * or customer records. Production publishing remains in approved connectors.
 */
const CAMPAIGN='super_sbc_growth';
const CHANNELS=Object.freeze({
  facebook:Object.freeze({source:'facebook',medium:'organic_social',accountId:'1473280249199334',name:'Successful By Choice'}),
  linkedin:Object.freeze({source:'linkedin',medium:'organic_social',accountId:'146995513',name:'Successful By Choice LLC'}),
  google:Object.freeze({source:'google',medium:'organic_gbp',accountId:'locations/3970405300470441047',name:'Successful By Choice'})
});
const DESTINATIONS=Object.freeze({
  websites:'https://sbcmia.com/',
  hosting:'https://sbcwebsites.com/'
});
function campaignUrl({channel,destination='websites',content='general'}={}){
  const c=CHANNELS[channel];
  if(!c)throw new TypeError('Unsupported channel');
  if(!Object.prototype.hasOwnProperty.call(DESTINATIONS,destination))throw new TypeError('Unsupported destination');
  if(typeof content!=='string'||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(content))throw new TypeError('Invalid content label');
  const url=new URL(DESTINATIONS[destination]);
  url.searchParams.set('utm_source',c.source);
  url.searchParams.set('utm_medium',c.medium);
  url.searchParams.set('utm_campaign',CAMPAIGN);
  url.searchParams.set('utm_content',content);
  return url.toString();
}
function verifyAccount({channel,accountId,name}={}){
  const c=CHANNELS[channel];
  if(!c)return {ok:false,reason:'UNSUPPORTED_CHANNEL'};
  if(String(accountId??'')!==c.accountId)return {ok:false,reason:'ACCOUNT_ID_MISMATCH'};
  if(String(name??'')!==c.name)return {ok:false,reason:'ACCOUNT_NAME_MISMATCH'};
  return {ok:true,reason:'VERIFIED'};
}
function metric(value){
  if(value===null||value===undefined||value==='')return null;
  if(typeof value!=='number' && typeof value!=='string')return null;
  const n=Number(value);
  return Number.isFinite(n)&&n>=0?n:null;
}
function measuredSnapshot({ga4={},search={},crm={},payments={}}={}){
  return {
    website:{activeUsers:metric(ga4.active_users),sessions:metric(ga4.sessions),ga4KeyEvents:metric(ga4.conversions)},
    search:{impressions:metric(search.impressions),clicks:metric(search.clicks)},
    crm:{leads:metric(crm.leads),qualified:metric(crm.qualified),quotes:metric(crm.quotes)},
    payments:{capturedOrders:metric(payments.capturedOrders),revenue:metric(payments.revenue),netContribution:metric(payments.netContribution)},
    integrity:'Missing data is unknown, not zero. GA4 key events are not CRM leads or paid orders. No revenue without verified payment evidence.'
  };
}
module.exports={CAMPAIGN,CHANNELS,DESTINATIONS,campaignUrl,verifyAccount,measuredSnapshot};
