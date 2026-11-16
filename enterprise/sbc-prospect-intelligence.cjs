'use strict';
/**
 * SBC Prospect Intelligence v1: owner-invoked, read-only, public website evidence.
 * No BuzzBoard code/data, automatic email, credit spending, CRM mutations, or subscriptions.
 * PageSpeed's fixed HTTPS endpoint fetches URLs; SBC never downloads target URLs directly.
 */
const {isIP}=require('node:net');
const PATH='/api/owner/prospect-intelligence/audit';
const UPSTREAM='https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const MAX_PER_HOUR=12;
const CHECKS=Object.freeze({
 'document-title':'Page title',
 'meta-description':'Meta description',
 'viewport':'Mobile viewport',
 'color-contrast':'Color contrast',
 'is-on-https':'HTTPS',
 'robots-txt':'Robots guidance',
 'link-text':'Descriptive links',
 'image-alt':'Image alternative text',
 'uses-responsive-images':'Responsive images'
});
function normalizeWebsite(raw){
 try{
  if(typeof raw!=='string'||raw.length>450)throw Error();
  const v=new URL(raw.trim());
  const host=v.hostname.toLowerCase().replace(/\.$/,'');
  if(v.protocol!=='https:'||!host||v.username||v.password||v.port||isIP(host))throw Error();
  if(!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host)||host.split('.').some(x=>x.startsWith('-')||x.endsWith('-'))||!/^[a-z]{2,63}$/.test(host.split('.').pop()))throw Error();
  if(/(?:^|\.)(?:localhost|local|internal|invalid|test|example)$/.test(host)||host.endsWith('.localhost'))throw Error();
  // Audit the public homepage only. Never forward private query params to a provider.
  return 'https://'+host+'/';
 }catch{throw Error('PUBLIC_HTTPS_SITE_REQUIRED')}
}
function score(value){
 const n=Number(value);
 return value===null||value===undefined||!Number.isFinite(n)||n<0||n>1?null:Math.round(n*100);
}
function parseReport(payload,website,at){
 const cats=payload?.lighthouseResult?.categories||{};
 const checks=payload?.lighthouseResult?.audits||{};
 const scores={performance:score(cats.performance?.score),accessibility:score(cats.accessibility?.score),
  seo:score(cats.seo?.score),bestPractices:score(cats['best-practices']?.score)};
 const findings=Object.keys(CHECKS).map(id=>{
  const measured=checks[id];const n=measured?.score;
  const result=n===null||n===undefined||typeof n!=='number'||!Number.isFinite(n)?'unverified':n>=.9?'pass':'opportunity';
  return {id,label:CHECKS[id],result,source:'PageSpeed Insights Lighthouse audit'};
 });
 return {ok:true,status:'measured',website,source:'Google PageSpeed Insights (Lighthouse lab)',
  measuredAt:new Date(at).toISOString(),scores,findings,
  caveat:'A single synthetic Lighthouse run is not a traffic, revenue, Google ranking, or conversion estimate. Some audit checks may be unverified.'};
}
const unavailable=(site,reason,now)=>({ok:true,status:'unavailable',website:site||null,source:'Google PageSpeed Insights (Lighthouse lab)',
 checkedAt:new Date(now).toISOString(),reason,scores:null,findings:[],
 caveat:'No findings are asserted when the external measurement is unavailable.'});
function createAuditor({fetcher=globalThis.fetch,clock=Date.now}={}){
 if(typeof fetcher!=='function')throw Error('FETCH_REQUIRED');
 return async website=>{
  const now=clock();
  const site=normalizeWebsite(website);
  const url=new URL(UPSTREAM);
  url.searchParams.set('url',site);
  url.searchParams.set('strategy','mobile');
  for(const category of ['performance','accessibility','best-practices','seo'])url.searchParams.append('category',category);
  try{
   const res=await fetcher(url.href,{method:'GET',redirect:'error',
    headers:{Accept:'application/json'},signal:AbortSignal.timeout(23000)});
   if(!res?.ok)return unavailable(site,res?.status===429?'UPSTREAM_RATE_LIMITED':'UPSTREAM_UNAVAILABLE',now);
   const result=await res.json();
   if(!result?.lighthouseResult?.categories)return unavailable(site,'UPSTREAM_DATA_INCOMPLETE',now);
   return parseReport(result,site,now);
  }catch{return unavailable(site,'UPSTREAM_UNAVAILABLE',now)}
 };
}
function register(app,{auth,ownerOnly,requireTenant,fetcher=globalThis.fetch,clock=Date.now}){
 const audit=createAuditor({fetcher,clock});
 const limits=new Map();
 app.get(PATH,auth,ownerOnly,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  let tenant;try{tenant=Number(requireTenant(req))}catch{tenant=0}
  const owner=String(req.user?.id||'').trim();
  if(!Number.isSafeInteger(tenant)||tenant<1||!owner||req.user?.role!=='owner')return res.status(403).json({ok:false,code:'OWNER_TENANT_REQUIRED'});
  let website;try{website=normalizeWebsite(req.query?.website)}catch{return res.status(422).json({ok:false,code:'PUBLIC_HTTPS_SITE_REQUIRED'})}
  const now=clock(),key=tenant+':'+owner,previous=limits.get(key)||[],window=previous.filter(t=>now-t<3600000&&now>=t);
  if(window.length>=MAX_PER_HOUR)return res.status(429).json({ok:false,code:'AUDIT_HOURLY_LIMIT_REACHED',limit:MAX_PER_HOUR});
  window.push(now);limits.set(key,window);
  if(limits.size>200){for(const [k,v] of limits)if(!v.length||now-Math.max(...v)>3600000)limits.delete(k)}
  const result=await audit(website);
  return res.json(result);
 });
}
module.exports={PATH,normalizeWebsite,parseReport,createAuditor,register};
