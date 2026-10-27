'use strict';

const INDUSTRY_PLAYBOOK = [
  {match:/salon|beauty|barber|spa|lashes|nail|esthetic|cosmetic/i,style:'editorial',primary:'#9b5de5',accent:'#f15bb5',layout:'editorial',sections:['services','gallery','about','booking','contact'],cta:'Book an Appointment',tone:'luxury, warm, visual, feminine without being generic'},
  {match:/pressure|cleaning|landscap|lawn|pest|pool|janitorial/i,style:'bold-service',primary:'#0f766e',accent:'#f59e0b',layout:'asymmetric',sections:['services','proof','service-area','about','quote','contact'],cta:'Get a Free Quote',tone:'confident, local, trustworthy, results-focused'},
  {match:/hvac|plumb|electric|roof|contractor|construction|handyman|remodel/i,style:'industrial',primary:'#0f172a',accent:'#f97316',layout:'split',sections:['services','projects','why-us','service-area','quote','contact'],cta:'Request a Quote',tone:'credible, rugged, precise, conversion-focused'},
  {match:/restaurant|cafe|bakery|catering|food|bar|grill/i,style:'culinary',primary:'#171717',accent:'#eab308',layout:'immersive',sections:['menu','story','gallery','hours-location','reservation','contact'],cta:'View Menu',tone:'sensory, editorial, appetizing, neighborhood-specific'},
  {match:/real estate|realtor|realty|property|mortgage/i,style:'property',primary:'#12304a',accent:'#c9a227',layout:'editorial',sections:['featured','services','about','areas','testimonials','contact'],cta:'Schedule a Consultation',tone:'premium, trustworthy, spacious, photography-led'},
  {match:/law|legal|attorney|lawyer/i,style:'authority',primary:'#172033',accent:'#b08d57',layout:'authority',sections:['practice-areas','about','credentials','faq','consultation','contact'],cta:'Request a Consultation',tone:'authoritative, restrained, trustworthy, never flashy'},
  {match:/account|bookkeep|tax|finance|insurance|financial/i,style:'professional',primary:'#123047',accent:'#19a974',layout:'structured',sections:['services','expertise','about','faq','consultation','contact'],cta:'Talk With Us',tone:'clear, dependable, modern professional'},
  {match:/medical|dental|clinic|therapy|health|chiropract|wellness/i,style:'care',primary:'#155e75',accent:'#14b8a6',layout:'calm',sections:['services','providers','patient-info','faq','booking','contact'],cta:'Book an Appointment',tone:'calm, reassuring, accessible, trustworthy'},
  {match:/auto|mechanic|tire|collision|detailing|car wash/i,style:'automotive',primary:'#111827',accent:'#ef4444',layout:'bold',sections:['services','work','reviews','service-area','quote','contact'],cta:'Book Service',tone:'bold, technical, high-confidence, visual'},
  {match:/agency|marketing|software|saas|tech|ai|cyber|digital/i,style:'technology',primary:'#111827',accent:'#7c3aed',layout:'generative',sections:['capabilities','work','process','about','faq','contact'],cta:'Start a Conversation',tone:'sharp, innovative, sophisticated, minimal'},
];

function playbook(industry='') { return INDUSTRY_PLAYBOOK.find(x=>x.match.test(String(industry))) || {style:'modern-local',primary:'#123047',accent:'#f28a19',layout:'asymmetric',sections:['services','about','proof','faq','contact'],cta:'Get Started',tone:'modern, credible, human, locally relevant'}; }

function cleanString(v,max=500){return String(v??'').trim().slice(0,max)}
function safePlan(input, fallback){
  const p={...fallback,...(input&&typeof input==='object'?input:{})};
  p.businessName=cleanString(p.businessName,120)||fallback.businessName;
  p.industry=cleanString(p.industry,100)||fallback.industry;
  p.primaryColor=/^#[0-9a-f]{6}$/i.test(p.primaryColor||'')?p.primaryColor:fallback.primaryColor;
  p.accentColor=/^#[0-9a-f]{6}$/i.test(p.accentColor||'')?p.accentColor:fallback.accentColor;
  p.style=cleanString(p.style,40)||fallback.style;
  p.layout=cleanString(p.layout,40)||fallback.layout;
  p.tone=cleanString(p.tone,240)||fallback.tone;
  p.headline=cleanString(p.headline,180)||fallback.headline;
  p.subheadline=cleanString(p.subheadline,320)||fallback.subheadline;
  p.about=cleanString(p.about,700)||fallback.about;
  p.cta=cleanString(p.cta,60)||fallback.cta;
  p.services=Array.isArray(p.services)?p.services.slice(0,6).map((s,i)=>({name:cleanString(s?.name||s?.title,80)||fallback.services[i]?.name||'Service',text:cleanString(s?.text||s?.description,220)||fallback.services[i]?.text||''})):fallback.services;
  p.sections=Array.isArray(p.sections)?p.sections.slice(0,8).map(x=>cleanString(x,40)).filter(Boolean):fallback.sections;
  return p;
}

async function callOpenAI(prompt){
  const key=process.env.OPENAI_API_KEY;if(!key)return null;
  const model=process.env.SBC_DEMO_AI_MODEL||process.env.SBC_AI_MODEL||'gpt-5.6-luna';
  try{
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(Number(process.env.SBC_DEMO_AI_TIMEOUT_MS||6500)),body:JSON.stringify({model,instructions:'You are Kim, SBC Demo Director and senior website strategist. Design sales-ready websites for real businesses. Return JSON only. Never invent certifications, awards, years in business, testimonials, guarantees, prices, credentials, or other factual claims not supplied. Make the design specific to the industry, audience, business personality and supplied brand assets. Avoid generic blue SaaS templates.',input:[{role:'user',content:prompt}],reasoning:{effort:'low'},max_output_tokens:1400})});
    const j=await r.json(); if(!r.ok)return null;
    let raw=String(j.output_text||'').trim().replace(/^```json\s*|\s*```$/g,'');
    return JSON.parse(raw);
  }catch{return null}
}

async function direct(demo){
  const c=demo.customer||{}; const industry=cleanString(demo.industry||'Local Business',100); const pb=playbook(industry);
  const services=Array.isArray(demo.services)&&demo.services.length?demo.services.slice(0,6):[
    {name:'Core Services',text:'Clear information about the services this business provides.'},
    {name:'Why Customers Choose Us',text:'A focused explanation of the customer experience and value.'},
    {name:'Easy Next Step',text:'A simple path for visitors to contact, book or request a quote.'}
  ];
  const fallback={businessName:cleanString(c.businessName||c.contactName||'Your Business',120),industry,primaryColor:pb.primary,accentColor:pb.accent,style:pb.style,layout:pb.layout,tone:pb.tone,sections:pb.sections,cta:pb.cta,headline:cleanString(demo.headline,180)||`${c.businessName||'Your Business'} — ${pb.cta}`,subheadline:cleanString(demo.subheadline,320)||`A ${pb.tone} digital experience built around what ${c.businessName||'this business'} actually does.`,about:cleanString(demo.about,700)||`${c.businessName||'This business'} serves customers${c.city?` in ${c.city}`:''} with a focused, professional experience.`,services};
  const intelligence=demo.leadIntelligence||{};
  const prompt=`Business profile:\n${JSON.stringify({businessName:fallback.businessName,industry,city:c.city||'',services,about:demo.about||'',headline:demo.headline||'',subheadline:demo.subheadline||'',brandColors:{primary:demo.primaryColor||'',accent:demo.accentColor||''},contactName:c.contactName||''})}\n\nLIVE BUSINESS INTELLIGENCE (public-web audit only):\n${JSON.stringify({websiteStatus:intelligence.websiteStatus||'',opportunities:intelligence.opportunities||[],strengths:intelligence.strengths||[],serviceHints:intelligence.serviceHints||[],websiteAudit:intelligence.websiteAudit?{title:intelligence.websiteAudit.title,description:intelligence.websiteAudit.description,headings:intelligence.websiteAudit.headings,ctas:intelligence.websiteAudit.ctas,gaps:intelligence.websiteAudit.gaps,themeColor:intelligence.websiteAudit.themeColor,socials:intelligence.websiteAudit.socials}:null})}\n\nIndustry playbook:\n${JSON.stringify(pb)}\n\nCreate a premium website blueprint. Return these JSON keys only: businessName, industry, primaryColor, accentColor, style, layout, tone, sections, cta, headline, subheadline, about, services (array of {name,text}). Keep unsupported factual claims out.`;
  const ai=await callOpenAI(prompt);
  const plan=safePlan(ai,fallback); plan.visualSystem=plan.visualSystem||visualSystemFor(industry); plan.mediaIntent={hero:true,gallery:true,motion:true,video:'customer-supplied-or-motion-fallback'}; return {plan,aiUsed:Boolean(ai),playbook:pb};
}

function visualSystemFor(industry=''){
  const s=String(industry).toLowerCase();
  if(/tech|software|saas|ai|cyber/.test(s)) return 'linear-glass+bento';
  if(/law|legal|account|finance|real estate/.test(s)) return 'swiss-editorial';
  if(/salon|beauty|spa|barber/.test(s)) return 'apple-ambient+editorial';
  if(/restaurant|cafe|food/.test(s)) return 'immersive-ambient';
  if(/contractor|construction|auto|hvac|plumb/.test(s)) return 'tactile-industrial';
  if(/agency|marketing|creative/.test(s)) return 'duotone-asymmetric';
  return 'premium-hybrid';
}

module.exports={direct,playbook};
