'use strict';
/**
 * SBC Customer Acquisition Engine V1
 * Lead -> verified opportunity -> demo -> outreach draft -> checkout handoff.
 * Does not send unsolicited messages or invent prospect facts.
 */
const crypto=require('crypto');
const VERSION='1.0.0';
const id=(p='acq')=>`${p}_${crypto.randomUUID()}`;
const clean=(v,n=500)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
function normalizePhone(v){return clean(v,80).replace(/[^\d+]/g,'');}
function normalizeEmail(v){return clean(v,255).toLowerCase();}
function scoreLead(c={}){
  let score=0; const reasons=[];
  if(c.businessName){score+=15;reasons.push('business_identity');}
  if(c.phone){score+=15;reasons.push('phone');}
  if(c.email){score+=15;reasons.push('email');}
  if(c.industry){score+=10;reasons.push('industry');}
  if(c.city||c.address){score+=10;reasons.push('location');}
  const ws=String(c.websiteStatus||'').toLowerCase();
  if(!c.website||/no website|missing|none|broken|inactive|expired/.test(ws)){score+=20;reasons.push('digital_gap');}
  else if(c.website){score+=5;reasons.push('website_present');}
  if(c.googleBusinessProfile===false||/not optimized|missing|unclaimed/.test(String(c.googleBusinessStatus||'').toLowerCase())){score+=10;reasons.push('google_profile_gap');}
  if(c.digitalOpportunity||c.notes){score+=5;reasons.push('documented_opportunity');}
  score=Math.max(0,Math.min(100,score));
  const tier=score>=75?'PRIORITY':score>=50?'QUALIFIED':'REVIEW';
  return {score,tier,reasons};
}
function analyze(c={}){
  const s=scoreLead(c);
  return {version:VERSION,analyzedAt:new Date().toISOString(),score:s.score,tier:s.tier,reasons:s.reasons,missing:[
    !c.contactName?'decision_maker_name':'',!c.phone?'phone':'',!c.email?'email':'',!c.industry?'industry':'',!c.website?'website':'',
    (!c.websiteStatus&&!c.website)?'website_status':''
  ].filter(Boolean),recommendedAction:s.tier==='PRIORITY'?'CREATE_DEMO_AND_PREPARE_OUTREACH':s.tier==='QUALIFIED'?'VERIFY_AND_PREPARE_DEMO':'RESEARCH_BEFORE_OUTREACH'};
}
function draft(c,channel='email',demoUrl=''){
  const business=clean(c.businessName||c.contactName||'your business',120);
  const industry=clean(c.industry||'local business',100);
  const link=clean(demoUrl,1000);
  if(channel==='sms') return {channel,subject:'',body:`Hi ${clean(c.contactName||'there',60)}, this is SBC. We put together a ${industry.toLowerCase()}-focused preview for ${business}.${link?` You can view it here: ${link}`:''} If you'd like us to customize it for you, reply YES. Reply STOP to opt out.`};
  return {channel,subject:`A preview we prepared for ${business}`,body:`Hi ${clean(c.contactName||'there',60)},\n\nWe prepared a tailored digital preview for ${business} based on the business information we verified. ${link?`You can review the preview here: ${link}`:'We can provide the preview link once it is ready.'}\n\nIf it looks useful, we can customize it, connect your domain and move it into the SBC launch process.\n\n— Successful By Choice`};
}
function summarize(records=[]){
  const rows=Array.isArray(records)?records:[];
  return {total:rows.length,priority:rows.filter(x=>x.tier==='PRIORITY').length,qualified:rows.filter(x=>x.tier==='QUALIFIED').length,review:rows.filter(x=>x.tier==='REVIEW').length,demos:rows.filter(x=>x.demoId).length,outreachDrafts:rows.reduce((n,x)=>n+Number(x.outreachDraftCount||0),0)};
}
module.exports={VERSION,normalizePhone,normalizeEmail,scoreLead,analyze,draft,summarize,id};
