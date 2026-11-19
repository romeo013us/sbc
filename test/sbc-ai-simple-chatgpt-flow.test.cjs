'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const H=require('../enterprise/sbc-ai-site-handoff.cjs');
const root=path.join(__dirname,'..');

test('each website package gets ONE customer-verified request for ChatGPT, not three mandatory builds',()=>{
 const c={businessName:'Dario Auto Paint',industry:'Auto Body Shop',city:'Miami',
   websiteVerifiedDetails:{verified:false,services:['Unverified services']}};
 for(const tier of [199,499,799,999]){
  const p=H.buildTierPrompt(c,tier);
  assert.match(p,/ONE complete website project/i);
  assert.match(p,/Dario Auto Paint/);
  assert.match(p,new RegExp('\\$'+tier+'\\b'));
  assert.match(p,/ZIP/i);
  assert.doesNotMatch(p,/Unverified services/);
  assert.doesNotMatch(p,/create THREE|all three/i);
 }
 assert.throws(()=>H.buildTierPrompt(c,1000),/INVALID_TIER/);
});

test('customer-scoped owner endpoint provides selected-tier briefs without changing saved proposals',async()=>{
 const routes={},app={get:(p,...f)=>routes[p]=f,patch(){},post(){}};
 const customer={id:'c1',tenantId:1,businessName:'Dario Auto Paint',industry:'Auto Body Shop'};
 const original={aiWebsiteProposals:[]};
 H.register(app,{auth:()=>{},ownerOnly:()=>{},requireTenant:()=>1,db:{customers:[customer]},
   getStore:()=>original,saveStore:async()=>{throw Error('GET MUST NOT WRITE')},writerReady:()=>false,serializeSiteMutation:fn=>fn()});
 let body;
 const req={params:{id:'c1'}},res={setHeader(){},json(value){body=value;return this},status(){return this}};
 await routes['/api/website-production/customers/:id/ai-proposals'].at(-1)(req,res);
 assert.equal(body.ok,true);
 assert.equal(body.mode,'CHATGPT_MANUAL_HANDOFF');
 for(const tier of [199,499,799,999]){
  assert.match(body.prompts[String(tier)],new RegExp('\\$'+tier+'\\b'));
 }
 assert.deepEqual(original.aiWebsiteProposals,[]);
});

test('owner-first simple interface hides advanced three-card controls by default',()=>{
 const ui=fs.readFileSync(path.join(root,'public/sbc-ai-site-handoff-v1.js'),'utf8');
 const mirror=fs.readFileSync(path.join(root,'browser_public/sbc-ai-site-handoff-v1.js'),'utf8');
 assert.equal(ui,mirror);
 assert.match(ui,/id="sbcAIQuickTier"/);
 assert.match(ui,/id="sbcAIQuickFile"/);
 assert.match(ui,/id="sbcAIQuickUpload"/);
 assert.match(ui,/id="sbcAICopy"/);
 assert.match(ui,/<details[^>]*id="sbcAIAdvanced"/);
 assert.doesNotMatch(ui,/<details[^>]*id="sbcAIAdvanced"[^>]*\sopen(?:\s|>)/);
 assert.match(ui,/ChatGPT builds the website/i);
 assert.match(ui,/Upload &amp; save proposal/); // protected existing advanced workflow
 assert.match(ui,/sandbox="allow-scripts"/);
});

test('simple customer flow copies ONLY selected-tier request and saves the provided ZIP under that tier',async()=>{
 const src=fs.readFileSync(path.join(root,'public/sbc-ai-site-handoff-v1.js'),'utf8');
 const nodes=new Map(),markup=[];
 const elem=id=>{
  if(!nodes.has(id))nodes.set(id,{
   id,value:id==='sbcAIQuickTier'?'199':'',files:[],innerHTML:'',textContent:'',
   dataset:{},classList:{toggle(){}},listeners:{},
   addEventListener(type,fn){this.listeners[type]=fn;},
   click(){return this.listeners.click?.({preventDefault(){}})}
  });
  return nodes.get(id);
 };
 const doc={getElementById:elem,querySelectorAll:()=>[]};
 const copied=[],requests=[];
 const serviceApi=async url=>url.endsWith('/uploads')?{ok:true,uploads:[]}:{
  ok:true,revision:0,variants:{},prompt:'OLD THREE-TIER PROMPT',
  prompts:{'199':'BUILD ONLY STARTER','499':'BUILD ONLY CUSTOM','799':'BUILD ONLY ADVANCED'}
 };
 const ctx={document:doc,
  window:{location:{href:'https://command.example/'}},
  navigator:{clipboard:{writeText:async t=>copied.push(t)}},
  URL,console,fetch:async(url,opts)=>{
   requests.push({url,opts});return {ok:true,json:async()=>({
    ok:true,durable:true,upload:{previewPath:'/api/website-production/customers/c1/ai-proposals/uploads/up_123/preview/index.html'}
   })};
  }
 };
 vm.runInNewContext(src,ctx,{filename:'sbc-ai-site-handoff-v1.js'});
 const openModal=(title,html)=>markup.push({title,html});
 await ctx.window.SBC_AI_SITE_HANDOFF.open({id:'c1',businessName:'Verified Business'},{serviceApi,openModal});
 assert(markup.some(x=>x.html.includes('sbcAIQuickTier')));
 elem('sbcAIQuickTier').value='499';
 await elem('sbcAICopy').click();
 assert.equal(copied.at(-1),'BUILD ONLY CUSTOM');
 const file={name:'client.zip',size:1024};
 elem('sbcAIQuickFile').files=[file];
 await elem('sbcAIQuickUpload').click();
 assert.equal(requests.length,1);
 assert.match(requests[0].url,/\/uploads\/499$/);
 assert.equal(requests[0].opts.body,file);
 assert.equal(elem('sbcAIFrame').src.includes('index.html'),true);
});
