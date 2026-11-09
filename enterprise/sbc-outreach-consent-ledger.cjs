'use strict';
/* Outreach preferences live inside the existing sbc_customers.lead_intelligence_json
 * column. The Command Center SQL serializer does not persist ad-hoc CRM root keys.
 * Do not mistake a memory-only consent value for durable permission evidence.
 */
function outbound(c){const x=c?.leadIntelligence?.sbcOutreach;return x&&typeof x==='object'&&!Array.isArray(x)?x:{};}
function snapshot(c){
 const src=c?.leadIntelligence;
 return {exists:Object.hasOwn(c||{},'leadIntelligence'),value:src&&typeof src==='object'?JSON.parse(JSON.stringify(src)):src};
}
function restore(c,old){if(old?.exists)c.leadIntelligence=old.value;else delete c.leadIntelligence;}
function mutate(c,patch){
 if(!c||typeof c!=='object')throw Error('CONTACT_REQUIRED');
 const li=c.leadIntelligence&&typeof c.leadIntelligence==='object'&&!Array.isArray(c.leadIntelligence)?c.leadIntelligence:{};
 c.leadIntelligence={...li,sbcOutreach:{...outbound(c),...patch}};
 return c.leadIntelligence.sbcOutreach;
}
function hasConsent(c){
 const x=outbound(c);
 if(x.marketingEmailConsent!==true||x.marketingEmailOptOut===true||x.emailUnsubscribed===true||
    c?.doNotContact===true||c?.salesSuppressed===true||c?.isSuppressed===true)return false;
 const date=Date.parse(String(x.marketingEmailConsentAt||''));
 if(!Number.isFinite(date)||date>Date.now()||date<Date.UTC(2020,0,1))return false;
 const source=String(x.marketingEmailConsentSource||'').trim();
 return source.length>=12&&!/(^|[^a-z])(unknown|none|scrap(?:ed|ing)?|purchas(?:ed|e)|public listing|google maps)([^a-z]|$)/i.test(source);
}
function record(c,{date,source,method}){
 if(!/^(signup_form|customer_request|documented_opt_in)$/.test(String(method||'')))throw Error('INVALID_OPT_IN_METHOD');
 const stamp=Date.parse(String(date||''));
 if(!Number.isFinite(stamp)||stamp>Date.now()||stamp<Date.UTC(2020,0,1))throw Error('INVALID_OPT_IN_DATE');
 const src=String(source||'').trim().slice(0,240);
 if(src.length<12||/(scrap|purchas|third.party|public listing|google maps|unknown|n\/a)/i.test(src))throw Error('DIRECT_OPT_IN_EVIDENCE_REQUIRED');
 const previous=outbound(c);
 // An unsubscribe is not reversed merely because a new form was filled in.
 // A verified NEW consent event must occur strictly after the last opt-out.
 if(previous.marketingEmailOptOut===true){
  const last=Date.parse(String(previous.marketingEmailOptOutAt||''));
  if(!Number.isFinite(last)||stamp<=last)throw Error('FRESH_CONSENT_AFTER_OPT_OUT_REQUIRED');
 }
 return mutate(c,{marketingEmailConsent:true,marketingEmailConsentAt:new Date(stamp).toISOString(),
  marketingEmailConsentSource:method+': '+src,marketingEmailOptOut:false,emailUnsubscribed:false});
}
function suppress(c,{reason='OWNER_MARKETING_OPT_OUT',at=new Date().toISOString()}={}){
 return mutate(c,{marketingEmailConsent:false,marketingEmailOptOut:true,
   emailUnsubscribed:true,marketingEmailOptOutAt:at,marketingEmailOptOutReason:String(reason).slice(0,90)});
}
module.exports={outbound,snapshot,restore,mutate,hasConsent,record,suppress};
