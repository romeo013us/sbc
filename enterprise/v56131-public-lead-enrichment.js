'use strict';
const crypto=require('crypto');
const VERSION='56.13.1';
const clean=(v,n=500)=>String(v??'').trim().slice(0,n);
function normalizeUrl(v){const s=clean(v,500);if(!s)return '';return /^https?:\/\//i.test(s)?s:`https://${s}`;}
function hasPublicBusinessEmail(email,website){
  const e=clean(email,180).toLowerCase(); const w=clean(website,500).toLowerCase();
  if(!e||!/^\S+@\S+\.\S+$/.test(e))return false;
  const domain=w.replace(/^https?:\/\//,'').split('/')[0].replace(/^www\./,'');
  const ed=e.split('@')[1]||'';
  return Boolean(domain&&ed&&ed===domain);
}
function extractSignals(html,finalUrl){
  const text=String(html||'');
  const lower=text.toLowerCase();
  const title=(text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,180);
  const emails=[...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)].map(m=>m[0].toLowerCase()).filter((v,i,a)=>a.indexOf(v)===i).slice(0,10);
  const bookingTerms=['book','booking','appointment','schedule','reserve','calendly','acuity','fresha','squareup'];
  const socialTerms=['facebook.com','instagram.com','linkedin.com','yelp.com','google.com/maps','g.page'];
  const hasBookingPath=bookingTerms.some(x=>lower.includes(x));
  const socialPresence=socialTerms.filter(x=>lower.includes(x));
  return {finalUrl,title,emails,hasBookingPath,socialPresence,htmlBytes:Buffer.byteLength(text,'utf8')};
}
async function probeWebsite(website,{timeoutMs=8000}={}){
  const url=normalizeUrl(website); if(!url)return {status:'SKIPPED',reason:'NO_WEBSITE'};
  const started=Date.now();
  try{
    const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(timeoutMs),headers:{'User-Agent':'SBC-Revenue-Intelligence/56.13.1'}});
    const html=(await response.text()).slice(0,750000);
    const latencyMs=Date.now()-started;
    const signals=extractSignals(html,response.url||url);
    return {status:'VERIFIED',httpStatus:response.status,reachable:response.ok,latencyMs,slow:latencyMs>=2500,signals};
  }catch(error){return {status:'UNREACHABLE',latencyMs:Date.now()-started,error:clean(error.message,220)};}
}
async function enrichCustomer(customer,{timeoutMs=8000}={}){
  const website=normalizeUrl(customer?.website); const started=new Date().toISOString();
  const result=await probeWebsite(website,{timeoutMs});
  const intelligence=customer.leadIntelligence&&typeof customer.leadIntelligence==='object'?customer.leadIntelligence:{};
  const enrichment={source:'SBC_PUBLIC_WEB_ENRICHMENT_V56.13.1',checkedAt:started,status:result.status,website:website||'',httpStatus:result.httpStatus||null,latencyMs:result.latencyMs||null,slowSite:Boolean(result.slow),reachable:Boolean(result.reachable),signals:result.signals||{},error:result.error||''};
  const domainEmail=hasPublicBusinessEmail(customer.email,website);
  intelligence.enrichment=enrichment;
  intelligence.verifiedSignals={
    businessEmailDomainMatch:domainEmail,
    bookingPathDetected:Boolean(result.signals?.hasBookingPath),
    socialPresence:Array.isArray(result.signals?.socialPresence)?result.signals.socialPresence:[],
    websiteReachable:Boolean(result.reachable)
  };
  intelligence.enrichmentId=crypto.createHash('sha256').update(`${customer.id||''}|${website}|${started}`).digest('hex').slice(0,24);
  customer.leadIntelligence=intelligence;
  customer.enrichmentStatus=result.status;
  customer.enrichmentCheckedAt=started;
  customer.updatedAt=new Date().toISOString();
  return {customer,result};
}
module.exports={VERSION,probeWebsite,enrichCustomer,extractSignals,hasPublicBusinessEmail,normalizeUrl};
