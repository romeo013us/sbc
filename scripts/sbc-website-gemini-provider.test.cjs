'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createController}=require('../enterprise/website-studio/hybrid-ai.cjs');
const SAMPLE={vibe:'cinematic',heroStyle:'split',serviceLayout:'bento',density:'airy',headlineSuggestion:'Built for your customers',subheadlineSuggestion:'Explore an elegant private website experience.',rationale:'Editorial grid and bold call-to-action.'};
test('Google Gemini response is structured, key stays server-side, usage is conservatively counted',async()=>{
 const G=require('../enterprise/website-studio/gemini-provider.cjs');
 let calls=0;
 const got=await G.invokeGemini({businessName:'Example Repairs',industry:'Handyman Services'},{
  apiKey:'test-only-key',model:'gemini-3.8-flash',fetcher:async(url,opt)=>{
   calls++;assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
   assert.equal(opt.headers['x-goog-api-key'],'test-only-key');assert.equal(opt.method,'POST');
   const b=JSON.parse(opt.body);assert.equal(b.generationConfig.responseMimeType,'application/json');
   assert(b.generationConfig.responseSchema.required.includes('heroStyle'));
   return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(SAMPLE)}]}}],usageMetadata:{promptTokenCount:250,candidatesTokenCount:180,thoughtsTokenCount:50,totalTokenCount:480}})};
  }
 });
 assert.equal(calls,1);assert.equal(got.design.vibe,'cinematic');
 assert.deepEqual(got.usage,{input_tokens:250,output_tokens:230});
 assert.equal(G.costMicroUsd(got.usage,got.model),Math.ceil(250*1.50+230*7.50));
});
test('Gemini rejects unsupported model, provider error, invalid JSON, and unverified billing',async()=>{
 const G=require('../enterprise/website-studio/gemini-provider.cjs');
 const call=(data,model='gemini-3.8-flash')=>G.invokeGemini({businessName:'Example'},{apiKey:'test',model,fetcher:async()=>({ok:true,json:async()=>data})});
 await assert.rejects(call({candidates:[{content:{parts:[{text:JSON.stringify(SAMPLE)}]}}]}),/AI_USAGE_UNVERIFIED/);
 await assert.rejects(call({candidates:[{content:{parts:[{text:'<script>'}]}}],usageMetadata:{promptTokenCount:40,candidatesTokenCount:30}}),/AI_OUTPUT_REJECTED/);
 await assert.rejects(call({},'attacker'),/AI_PROVIDER_MODEL_UNSUPPORTED/);
 await assert.rejects(G.invokeGemini({}, {apiKey:'test',fetcher:async()=>({ok:false,status:429})}),/AI_PROVIDER_UNAVAILABLE/);
});
test('Gemini manual upgrade never overwrites an Approved site or published data',async()=>{
 let store={websiteDemos:[{id:'site',tenantId:2,status:'Approved',customer:{businessName:'Example'},industry:'Beauty'}]};
 let calls=0;
 const c=createController({getStore:()=>store,saveStore:async v=>{store=structuredClone(v);return {ok:true}},writerReady:()=>true,
  configured:true,geminiEnabled:true,now:()=>new Date('2026-11-14T21:00:00Z'),
  invokeModel:async()=>{throw Error('Wrong provider')},
  invokeGemini:async()=>{calls++;return {design:SAMPLE,model:'gemini-3.8-flash',usage:{input_tokens:200,output_tokens:200}}}
 });
 assert.equal(c.status().providers.gemini.configured,true);
 const r=await c.enhance({siteId:'site',tenantId:2,mode:'manual-upgrade',provider:'gemini'});
 assert.equal(r.status,'PROPOSAL_ONLY_APPROVED_SITE');assert.equal(calls,1);
 assert.equal(store.websiteDemos[0].status,'Approved');assert.equal(store.websiteDemos[0].websiteStudioVisual,undefined);
 assert.equal(store.websiteDemos[0].websiteStudioAI.provider,'gemini');assert.equal(store.websiteStudioAIBudget.receipts[0].provider,'gemini');
 assert.equal((await c.enhance({siteId:'site',tenantId:2,mode:'manual-upgrade',provider:'bad-provider'})).status,'INVALID_AI_PROVIDER');
 assert.equal(calls,1);
});
test('Gemini auto-enhances only a newly created site when explicitly configured',async()=>{
 let store={websiteDemos:[{id:'site',tenantId:2,status:'Draft',customer:{businessName:'Example'},industry:'Trades'}]},calls=0;
 const c=createController({getStore:()=>store,saveStore:async v=>{store=structuredClone(v);return {ok:true}},writerReady:()=>true,
 configured:false,geminiEnabled:true,defaultProvider:'gemini',now:()=>new Date('2026-11-14T21:00:00Z'),
 invokeGemini:async()=>{calls++;return {design:SAMPLE,model:'gemini-3.8-flash',usage:{input_tokens:200,output_tokens:200}}}
 });
 assert.equal((await c.enhance({siteId:'site',tenantId:2,mode:'auto-new',createdNow:false})).status,'SKIPPED_NOT_NEW');
 assert.equal((await c.enhance({siteId:'site',tenantId:2,mode:'auto-new',createdNow:true})).status,'ENHANCED_PRIVATE_DRAFT');
 assert.equal((await c.enhance({siteId:'site',tenantId:2,mode:'auto-new',createdNow:true})).status,'SKIPPED_ALREADY_ATTEMPTED');assert.equal(calls,1);
});
test('Owner upgrade API accepts Gemini choice, rejects arbitrary prompts and other keys',async()=>{
 const {register}=require('../enterprise/sbc-website-production-routes.cjs');const app={routes:new Map(),get(p,...a){this.routes.set('GET '+p,a)},post(p,...a){this.routes.set('POST '+p,a)},patch(p,...a){this.routes.set('PATCH '+p,a)}};
 let picked;register(app,{auth:(q,r,n)=>n(),ownerOnly:(q,r,n)=>q.user.role==='owner'?n():r.status(403).json({ok:false}),requireTenant:q=>q.user.tenantId,db:{customers:[]},getStore:()=>({websiteDemos:[{id:'site',tenantId:2}]}),saveStore:async()=>({ok:true}),writerReady:()=>true,hybridAIController:{status:()=>({configured:true}),enhance:async x=>{picked=x;return {status:'PROPOSAL_ONLY_APPROVED_SITE'}}}});
 const path='/api/website-production/sites/:id/studio/ai/upgrade';
 async function call(body){const q={params:{id:'site'},body,user:{role:'owner',tenantId:2}},res={statusCode:200,status(n){this.statusCode=n;return this},setHeader(){return this},json(x){this.body=x;return this}};for(const h of app.routes.get('POST '+path)){let next=false;await h(q,res,()=>next=true);if(!next)break;}return res}
 assert.equal((await call({provider:'gemini'})).statusCode,200);assert.equal(picked.provider,'gemini');
 assert.equal((await call({provider:'gemini',prompt:'publish'})).statusCode,400);
 assert.equal((await call({provider:'attacker'})).statusCode,400);
});
test('Both frontend mirrors expose Google Gemini choice without exposing server API secrets',()=>{
 const root=path.resolve(__dirname,'..'),a=fs.readFileSync(path.join(root,'public/sbc-website-production-v1.js'),'utf8'),b=fs.readFileSync(path.join(root,'browser_public/sbc-website-production-v1.js'),'utf8');
 assert.equal(a,b);assert.match(a,/id="sbcStudioAIProvider"/);assert.match(a,/value="gemini"/);
 assert.match(a,/body:JSON\.stringify\(\{provider/);
 assert.doesNotMatch(a,/GEMINI_API_KEY/);
});
