'use strict';
/* SBC V66.113 — no AI credits or external network, test ten industry playbooks,
 * XSS-safe output, functional demo form and visually distinct styles. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {direct,freeSmartServices,freeSmartHeadline}=require('../enterprise/kim-demo-director');
const {buildSite,styleFor}=require('../enterprise/sbc-site-design-engine');
const {buildInquiry}=require('../enterprise/sbc-demo-interactive-v1');
(async()=>{
 const prior=process.env.SBC_DEMO_AI_ENABLED,oldKey=process.env.OPENAI_API_KEY,oldFetch=globalThis.fetch;
 process.env.SBC_DEMO_AI_ENABLED='false';process.env.OPENAI_API_KEY='synthetic-placeholder-not-real';
 let networkCalls=0;globalThis.fetch=async()=>{networkCalls++;throw Error('Network must not be called in free demo mode')};
 try{
  const cases=[
   ['auto repair','Vehicle Service','tactile'],
   ['salon and beauty','Explore Services','editorial'],
   ['pressure washing contractor','Service Overview','tactile'],
   ['restaurant','Menu & Offerings','editorial'],
   ['mobile notary','Document Services','tactile'],
   ['legal services','Service Areas','professional'],
   ['retail','Product Categories','tactile']
  ];
  const layouts=new Set();
  for(const [industry,service,expectedStyle]of cases){
    const business='Synthetic '+industry;
    const seed={customer:{businessName:business,contactName:'Test Customer',city:'Miami',phone:''},industry,services:[],leadIntelligence:{websiteStatus:'unknown',opportunities:[],strengths:[]}};
    const out=await direct(seed);
    assert.equal(out.aiUsed,false,industry+' must not use paid AI');
    assert.equal(out.source,'free-industry-rules');
    assert.equal(out.plan.examplesOnly,true);
    assert.equal(out.plan.services[0].name,service);
    assert(out.plan.headline.includes(business));
    const site=buildSite({...seed,aiPlan:out.plan,services:out.plan.services,designStyle:out.plan.layout});
    assert.equal(site.style,expectedStyle,industry+' needs its own design family');
    assert(site.html.includes('<form id="sbcDemoRequest"'));
    assert(site.html.includes('NOT')||site.html.includes('does not send'));
    assert(site.html.includes(service.replaceAll('&','&amp;')),industry+' service must appear safely escaped');
    assert(site.html.includes('/sbc-demo-interactive-v1.js'));
    assert(site.html.includes('Illustrative service categories.'));
    assert(site.html.includes('id="contact"'));
    assert(site.html.includes('name="service"'));
    layouts.add(site.style);
  }
  assert(layouts.size>=3,'must vary visual style across industries');
  const provided=await direct({customer:{businessName:'Test'},industry:'Auto Repair',services:[{name:'Brake Repair',text:'Customer confirmed service'}]});
  assert.equal(provided.plan.examplesOnly,false);
  assert.equal(provided.plan.services[0].name,'Brake Repair');
  const hostile=buildInquiry({business:'<img src=x onerror=alert(1)>'},[{name:'<script>bad</script>'}]);
  assert(hostile.includes('&lt;img'));assert(hostile.includes('&lt;script&gt;'));
  assert(!hostile.includes('<script>bad</script>'));
  assert(!hostile.includes('<img src=x onerror'));
  const js=fs.readFileSync(path.join(__dirname,'../public/sbc-demo-interactive-v1.js'),'utf8');
  assert(js.includes('event.preventDefault()'));
  assert(!/\bfetch\(|XMLHttpRequest|navigator\.sendBeacon|localStorage|sessionStorage/.test(js),'browser demo must not send/store visitor details');
  assert.equal(networkCalls,0,'zero OpenAI/API calls in free demo mode');

  // Opt-in paid path is also mocked: prove REST output shape is parsed and
  // that an expensive global model cannot silently override cheap demo Luna.
  const oldModel=process.env.SBC_DEMO_AI_MODEL;
  process.env.SBC_DEMO_AI_ENABLED='true';
  delete process.env.SBC_DEMO_AI_MODEL;
  let paidMockCalls=0,submitted;
  globalThis.fetch=async(_url,options)=>{
    paidMockCalls++;
    submitted=JSON.parse(options.body);
    return {ok:true,json:async()=>({id:'response-synthetic',status:'completed',output:[
      {type:'reasoning',id:'reasoning-not-text'},
      {type:'message',content:[{type:'output_text',text:JSON.stringify({
        headline:'Mocked AI-enhanced business headline',industry:'Auto Repair',
        services:[{name:'Brake Repair',text:'Customer-supplied service description'}]
      })}]}
    ]})};
  };
  const paid=await direct({customer:{businessName:'Synthetic Garage'},industry:'Auto Repair',services:[{name:'Brake Repair',text:'Customer-supplied service description'}]});
  assert.equal(paidMockCalls,1,'explicit opt-in performs exactly one mocked AI call');
  assert.equal(submitted.model,'gpt-6-luna','demo must not inherit expensive global model');
  assert.equal(submitted.max_output_tokens,1400);
  assert.equal(paid.aiUsed,true,'REST output[] must parse without SDK output_text');
  assert.equal(paid.plan.headline,'Mocked AI-enhanced business headline');
  if(oldModel===undefined)delete process.env.SBC_DEMO_AI_MODEL;else process.env.SBC_DEMO_AI_MODEL=oldModel;

  console.log('[SBC V66.113] PASS: zero paid AI, seven tailored industries, three layout families, verified service copy, service request demo, XSS escaping, no network or data storage');
 }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;if(prior===undefined)delete process.env.SBC_DEMO_AI_ENABLED;else process.env.SBC_DEMO_AI_ENABLED=prior}
})().catch(e=>{console.error(e);process.exitCode=1});
