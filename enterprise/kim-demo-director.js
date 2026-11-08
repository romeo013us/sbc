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
  // Explicit opt-in: missing/empty API credits must never slow down demo creation.
  if(String(process.env.SBC_DEMO_AI_ENABLED||'false').toLowerCase()!=='true')return null;
  const key=process.env.OPENAI_API_KEY;if(!key)return null;
  const model=process.env.SBC_DEMO_AI_MODEL||process.env.SBC_AI_MODEL||'gpt-6-astra';
  try{
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(Number(process.env.SBC_DEMO_AI_TIMEOUT_MS||6500)),body:JSON.stringify({model,instructions:'You are Kim, SBC Demo Director and senior website strategist. Design sales-ready websites for real businesses. Return JSON only. Never invent certifications, awards, years in business, testimonials, guarantees, prices, credentials, or other factual claims not supplied. Make the design specific to the industry, audience, business personality and supplied brand assets. Avoid generic blue SaaS templates.',input:[{role:'user',content:prompt}],reasoning:{effort:'low'},max_output_tokens:1400})});
    const j=await r.json(); if(!r.ok)return null;
    let raw=String(j.output_text||'').trim().replace(/^```json\s*|\s*```$/g,'');
    return JSON.parse(raw);
  }catch{return null}
}

// SBC V66.113: deterministic, zero-token demo content for every industry.
// Industry examples are concepts, NEVER claims about an unverified business.
const SERVICE_EXAMPLES=[
 {match:/auto|mechanic|tire|collision|detailing|car wash/i,items:[['Vehicle Service','A clear service overview with an easy path to request an appointment.'],['Tires & Maintenance','Example categories that can be replaced with verified services.'],['Get a Service Estimate','A simple way for a customer to describe what their vehicle needs.']],headline:name=>name+' — Make your next service easy'},
 {match:/salon|beauty|barber|spa|nail|lash/i,items:[['Explore Services','A simple overview of available appointment categories.'],['Book a Consultation','Help visitors choose a next step before an appointment.'],['Client Care','Make contact information and follow-up easy to find.']],headline:name=>name+' — Your next appointment starts here'},
 {match:/roof|contractor|construction|hvac|plumb|electric|handyman|clean|landscap|pressure/i,items:[['Service Overview','Show the work your business accepts and the areas it serves.'],['Request an Estimate','Let customers describe a project before a consultation.'],['Project Scheduling','Make the next step clear from the first inquiry.']],headline:name=>name+' — Start your next project'},
 {match:/restaurant|cafe|bakery|food|cater|grill/i,items:[['Menu & Offerings','A clear place for current menu details when provided.'],['Hours & Location','Make verified operating information easy to discover.'],['Event or Table Inquiry','A focused next step for customers looking to visit or book.']],headline:name=>name+' — Discover what is on offer'},
 {match:/notary|apostille/i,items:[['Document Services','Help customers understand which document types can be reviewed.'],['Appointments','Make scheduling an appointment easier.'],['Service Area','Explain where appointments can be arranged.']],headline:name=>name+' — Make the next step simple'},
 {match:/law|legal|attorney|finance|account|insurance|adjust/i,items:[['Service Areas','Introduce the categories relevant to the practice.'],['Consultation Requests','Give prospective clients a clear next step.'],['Document Preparation','Explain what information to have ready for a conversation.']],headline:name=>name+' — Start with a conversation'},
 {match:/retail|store|shop|e-commerce/i,items:[['Product Categories','Organize product highlights for faster browsing.'],['Store Information','Show location, hours, and ways to get in touch.'],['Customer Inquiries','Make product questions easy to submit.']],headline:name=>name+' — Explore what is available'}
];
function freeSmartServices(demo,industry){
 const provided=Array.isArray(demo.services)?demo.services:[];
 const explicit=provided.map(s=>typeof s==='string'?{name:cleanString(s,80),text:'Learn about this service and request more information.'}:{name:cleanString(s?.name||s?.title,80),text:cleanString(s?.text||s?.description,220)||'Contact the business to learn more.'}).filter(s=>s.name);
 if(explicit.length)return {services:explicit.slice(0,6),verifiedFromUser:true};
 const kind=SERVICE_EXAMPLES.find(t=>t.match.test(industry));
 const rows=kind?.items||[['Service Information','Introduce the services this business confirms it offers.'],['Request Details','Create a clear path for inquiries or quotes.'],['Contact & Location','Make business contact details easy to find.']];
 return {services:rows.map(([name,text])=>({name,text})),verifiedFromUser:false};
}
function freeSmartHeadline(name,industry){const k=SERVICE_EXAMPLES.find(t=>t.match.test(industry));return k?.headline(name)||name+' — See what is possible';}

async function direct(demo){
  const c=demo.customer||{}; const industry=cleanString(demo.industry||'Local Business',100); const pb=playbook(industry);
  const free=freeSmartServices(demo,industry);
  const services=free.services;
  const fallback={businessName:cleanString(c.businessName||c.contactName||'Your Business',120),industry,primaryColor:pb.primary,accentColor:pb.accent,style:pb.style,layout:pb.layout,tone:pb.tone,sections:pb.sections,cta:pb.cta,headline:cleanString(demo.headline,180)||freeSmartHeadline(cleanString(c.businessName||c.contactName||'Your Business',120),industry),subheadline:cleanString(demo.subheadline,320)||`Explore services, request the next step, and reach ${c.businessName||'the business'} easily from any device.`,about:cleanString(demo.about,700)||`A proposed online experience for ${c.businessName||'this business'}${c.city?` in ${c.city}`:''}, with service information and a clearer path to contact. Details should be confirmed with the business before publication.`,services};
  const intelligence=demo.leadIntelligence||{};
  const prompt=`Business profile:\n${JSON.stringify({businessName:fallback.businessName,industry,city:c.city||'',services,about:demo.about||'',headline:demo.headline||'',subheadline:demo.subheadline||'',brandColors:{primary:demo.primaryColor||'',accent:demo.accentColor||''},contactName:c.contactName||''})}\n\nLIVE BUSINESS INTELLIGENCE (public-web audit only):\n${JSON.stringify({websiteStatus:intelligence.websiteStatus||'',opportunities:intelligence.opportunities||[],strengths:intelligence.strengths||[],serviceHints:intelligence.serviceHints||[],websiteAudit:intelligence.websiteAudit?{title:intelligence.websiteAudit.title,description:intelligence.websiteAudit.description,headings:intelligence.websiteAudit.headings,ctas:intelligence.websiteAudit.ctas,gaps:intelligence.websiteAudit.gaps,themeColor:intelligence.websiteAudit.themeColor,socials:intelligence.websiteAudit.socials}:null})}\n\nIndustry playbook:\n${JSON.stringify(pb)}\n\nCreate a premium website blueprint. Return these JSON keys only: businessName, industry, primaryColor, accentColor, style, layout, tone, sections, cta, headline, subheadline, about, services (array of {name,text}). Keep unsupported factual claims out.`;
  const ai=await callOpenAI(prompt); // Skipped entirely unless the owner expressly enables paid AI.
  const plan=safePlan(ai,fallback); plan.examplesOnly=!free.verifiedFromUser; plan.visualSystem=plan.visualSystem||visualSystemFor(industry); plan.mediaIntent={hero:true,gallery:true,motion:true,video:'customer-supplied-or-motion-fallback'}; return {plan,aiUsed:Boolean(ai),playbook:pb,source:ai?'paid-ai':'free-industry-rules',serviceClaimsConfirmed:free.verifiedFromUser};
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

module.exports={direct,playbook,freeSmartServices,freeSmartHeadline};
