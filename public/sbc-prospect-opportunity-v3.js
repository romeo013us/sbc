/* SBC Prospect Opportunity V3 — deterministic offline planning from existing audits. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SBCProspectOpportunityV3=api;
})(typeof window==='undefined'?{}:window,function(){
 'use strict';
 const AGE=30*86400000;
 const OFFER=[
  {service:'Website Improvement Review',scope:'Review measured SEO, mobile speed, and accessibility findings; quote after confirming the customer website and required work.'},
  {service:'Website Care Review',scope:'Discuss ongoing maintenance only after verifying ownership, current subscriptions, scope and authorization; $79/month is optional, not auto-billed.'},
  {service:'Business Visibility Review',scope:'Offer a separate manual Google Business Profile assessment; no GBP condition or ranking is inferred from Lighthouse.'}
 ];
 function clean(v,n=160){return typeof v==='string'?v.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n):''}
 function suppress(c={}){
  return c.doNotContact===true||c.salesSuppressed===true||c.isSuppressed===true||
   /^(opt.?out|unsubscribe|do not contact|do not call|duplicate|lost|deleted|closed)$/i.test(clean(c.status));
 }
 function safeAudit(a,now){
  if(a?.status!=='measured')return null;
  const timestamp=Date.parse(a.measuredAt);
  if(!Number.isFinite(timestamp)||timestamp>now+300000||now-timestamp>AGE)return null;
  if(a.source!=='Google PageSpeed Insights (Lighthouse lab)')return null;
  const s=a.scores;
  if(!s||typeof s!=='object')return null;
  const values=Object.fromEntries(['seo','performance','accessibility','bestPractices'].map(k=>{
   const n=s[k];
   return [k,Number.isInteger(n)&&n>=0&&n<=100?n:null];
  }));
  return {timestamp,scores:values};
 }
 function evaluate(business={},audit={},now=Date.now()){
  const when=Number(now);
  if(!Number.isFinite(when))throw Error('INVALID_REVIEW_DATE');
  const valid=safeAudit(audit,when),expired=audit?.status==='measured'&&!valid;
  const opportunities=[];
  if(valid){
   const {seo,performance,accessibility}=valid.scores;
   if(seo!==null&&seo<90)opportunities.push({topic:'SEO',measuredScore:seo,source:'Lighthouse lab',recommendation:'Review search-friendly page titles, descriptions and technical SEO findings.'});
   if(performance!==null&&performance<75)opportunities.push({topic:'Mobile performance',measuredScore:performance,source:'Lighthouse lab',recommendation:'Review images, loading behavior and mobile rendering.'});
   if(accessibility!==null&&accessibility<90)opportunities.push({topic:'Accessibility',measuredScore:accessibility,source:'Lighthouse lab',recommendation:'Review accessible page controls, text alternatives and contrast.'});
  }
  const evidenceCount=opportunities.length;
  const score=valid?Math.min(100,20+Math.min(60,evidenceCount*20)+(clean(business.industry)?10:0)+(clean(business.businessName)?10:0)):null;
  const blocked=suppress(business);
  const offerIdeas=valid&&evidenceCount?OFFER.map(x=>({...x,requiresOwnerQuote:true,autoBill:false})): [];
  return {
   kind:'audited_opportunity_not_conversion_probability',
   businessName:clean(business.businessName)||'Business identity not verified',
   verification:valid?'measured':expired?'expired':'unverified',
   score,opportunities,offerIdeas,
   outreach:{allowed:false,action:blocked?'DO_NOT_CONTACT':'VERIFY_PERMISSION',reason:blocked?'Suppression or terminal status indicated':'Contact assignment, permission and outbound requirements must be verified in the authorized CRM.'},
   evidenceDate:valid?new Date(valid.timestamp).toISOString():null,
   caveat:'Research priority only. No promised lead conversion, sales, business ranking, or Google Business Profile condition.'
  };
 }
 function triage(items=[],now=Date.now()){
  if(!Array.isArray(items))return [];
  return items.slice(0,500).map(x=>{
   const details=evaluate(x?.business||{},x?.audit||{},now);
   return {...details,blocked:details.outreach.action==='DO_NOT_CONTACT'};
  }).sort((a,b)=>Number(a.blocked)-Number(b.blocked)||
   Number(b.score!==null)-Number(a.score!==null)||
   (b.score??-1)-(a.score??-1)||
   a.businessName.localeCompare(b.businessName));
 }
 function report(business={},audit=null,now=Date.now()){
  const view=evaluate(business,audit,now);
  const rows=[
   'SUCCESSFUL BY CHOICE — PRELIMINARY DIGITAL OPPORTUNITY PLAN',
   'Business: '+view.businessName,
   'Prepared: '+new Date(now).toISOString(),
   'Status: '+view.verification,
   'Source: Google PageSpeed Insights (Lighthouse lab)',
   'Evidence timestamp: '+(view.evidenceDate||'Not verified'),
   '',
   'MEASURED FINDINGS',
   ...(view.opportunities.length?view.opportunities.map(o=>o.topic+' — '+o.measuredScore+'/100 (Lighthouse lab); '+o.recommendation):['No current measured opportunity can be asserted.']),
   '',
   'SBC SERVICE DISCUSSIONS (not a quote or obligation)',
   ...(view.offerIdeas.length?view.offerIdeas.map(x=>x.service+': '+x.scope):['Owner must gather current evidence and confirm service needs before recommending a package.']),
   '',
   'FOLLOW-UP CONTROLS',
   'Outreach: '+view.outreach.action+' — '+view.outreach.reason,
   'Owner review required before sending, billing, modifying accounts or launching projects.',
   'Not verified: Google Business Profile, Google rankings, customer revenue, conversions, competitor market share, client consent or identity.',
   'Single synthetic Lighthouse scores can vary by run, connection, and device profile.',
   'Because Why Not?'
  ];
  return rows.join('\n');
 }
 function offlineRehearsal(){
  const at=Date.parse('2026-11-16T18:00:00Z');
  const testAudit={status:'measured',source:'Google PageSpeed Insights (Lighthouse lab)',measuredAt:new Date(at-3600000).toISOString(),
   scores:{seo:65,performance:59,accessibility:82,bestPractices:96}};
  const business={businessName:'SBC OFFLINE FIXTURE',industry:'Barber'};
  const scenarios=[
   evaluate(business,testAudit,at).verification==='measured',
   evaluate(business,{status:'unavailable'},at).score===null,
   evaluate({...business,doNotContact:true},testAudit,at).outreach.action==='DO_NOT_CONTACT',
   evaluate(business,{...testAudit,measuredAt:'2025-01-01T00:00:00Z'},at).verification==='expired'
  ];
  return {mode:'OFFLINE_ONLY',scenarioCount:scenarios.length,pass:scenarios.every(Boolean),
   networkCalls:0,payments:0,crmWrites:0,liveVerified:false};
 }
 return Object.freeze({evaluate,triage,report,offlineRehearsal});
});
