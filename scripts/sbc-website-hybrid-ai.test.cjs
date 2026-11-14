'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createController}=require('../enterprise/website-studio/hybrid-ai.cjs');
const prepared={vibe:'cinematic',heroStyle:'split',serviceLayout:'bento',density:'airy',headlineSuggestion:'A better first impression',subheadlineSuggestion:'Explore what this business can offer.',rationale:'Trade-oriented hero with high-contrast call to action.'};
function fixture({configured=true,ai=async()=>({design:prepared,usage:{input_tokens:2500,output_tokens:600}})}={}){
 let store={websiteDemos:[{id:'new',customerId:'c1',tenantId:11,status:'Draft',customer:{businessName:'Real Business'},industry:'Handyman Services'}, {id:'approved',customerId:'c2',tenantId:11,status:'Approved',customer:{businessName:'Existing Business'}}, {id:'foreign',tenantId:22,status:'Draft'}]},writes=0,enabled=true,calls=0;
 const controller=createController({getStore:()=>store,saveStore:async s=>{writes++;store=structuredClone(s);return {ok:true}},writerReady:()=>enabled,configured,now:()=>new Date('2026-11-14T20:00:00Z'),invokeModel:async brief=>{calls++;return ai(brief)}});
 return {controller,get:()=>store,setWriter:v=>enabled=v,calls:()=>calls,writes:()=>writes};
}
test('auto enhancement happens only for newly created sites, never pre-existing records',async()=>{
 const f=fixture();
 assert.equal((await f.controller.enhance({siteId:'new',tenantId:11,mode:'auto-new',createdNow:false})).status,'SKIPPED_NOT_NEW');
 assert.equal(f.calls(),0);
 const out=await f.controller.enhance({siteId:'new',tenantId:11,mode:'auto-new',createdNow:true});
 assert.equal(out.status,'ENHANCED_PRIVATE_DRAFT');assert.equal(f.calls(),1);
 assert.equal(f.get().websiteDemos[0].websiteStudioVisual.vibe,'cinematic');
 assert.equal(f.get().websiteDemos[0].websiteStudioAI.reviewRequired,true);
 assert.equal(f.get().websiteDemos[0].websiteStudioVisual.headline,'');
 assert.equal((await f.controller.enhance({siteId:'new',tenantId:11,mode:'auto-new',createdNow:true})).status,'SKIPPED_ALREADY_ATTEMPTED');
 assert.equal(f.calls(),1);
});
test('manual upgrade of approved site stores private proposal and never alters publication or active visual',async()=>{
 const f=fixture();const before=structuredClone(f.get().websiteDemos[1]);
 const result=await f.controller.enhance({siteId:'approved',tenantId:11,mode:'manual-upgrade'});
 assert.equal(result.status,'PROPOSAL_ONLY_APPROVED_SITE');
 const current=f.get().websiteDemos[1];assert.equal(current.status,'Approved');assert.equal(current.websiteStudioVisual,undefined);
 assert.equal(current.websiteStudioAI.design.vibe,'cinematic');assert.equal(current.websiteStudioAI.reviewRequired,true);
 for(const key of Object.keys(before))assert.deepEqual(current[key],before[key]);
});
test('tenant isolation, writer lock and disabled provider fail closed without billing',async()=>{
 const f=fixture();assert.equal((await f.controller.enhance({siteId:'foreign',tenantId:11,mode:'manual-upgrade'})).status,'WEBSITE_NOT_FOUND');
 f.setWriter(false);assert.equal((await f.controller.enhance({siteId:'new',tenantId:11,mode:'auto-new',createdNow:true})).status,'WRITER_UNAVAILABLE');
 const disabled=fixture({configured:false});
 assert.equal((await disabled.controller.enhance({siteId:'new',tenantId:11,mode:'auto-new',createdNow:true})).status,'AI_NOT_CONFIGURED');
 assert.equal(disabled.calls(),0);assert.equal(disabled.writes(),0);
});
test('spend reserves before request and never exceeds $40 even with concurrent requests',async()=>{
 const f=fixture();
 const runs=Array.from({length:500},(_,i)=>f.controller.enhance({siteId:'new',tenantId:11,mode:'manual-upgrade'}));
 const out=await Promise.all(runs);
 assert.equal(out.filter(x=>x.status==='ENHANCED_PRIVATE_DRAFT').length,500);
 const s=f.controller.status();assert.equal(s.limitUsd,40);assert(s.usedUsd>0&&s.usedUsd<40);assert.equal(s.reservedUsd,0);
});
test('preserves active draft edits and refuses invalid generated output',async()=>{
 const f=fixture({ai:async()=>({design:{...prepared,vibe:'<script>'},usage:{input_tokens:2500,output_tokens:600}})});
 f.get().websiteDemos[0].websiteStudioVisual={vibe:'warm',headline:'Approved headline'};
 const r=await f.controller.enhance({siteId:'new',tenantId:11,mode:'manual-upgrade'});
 assert.equal(r.status,'AI_OUTPUT_REJECTED');
 assert.equal(f.get().websiteDemos[0].websiteStudioVisual.vibe,'warm');
 assert.equal(f.get().websiteDemos[0].websiteStudioVisual.headline,'Approved headline');
});
test('model cannot receive customer phone, email, CRM research snippets or unverified services',async()=>{
 let input;
 const f=fixture({ai:async brief=>{input=brief;return {design:prepared,usage:{input_tokens:2000,output_tokens:200}}}});
 f.get().websiteDemos[0].customer.phone='305-555-0123';f.get().websiteDemos[0].customer.email='secret@example.com';f.get().websiteDemos[0].leadIntelligence={research:'unsafe research note'};f.get().websiteDemos[0].services=[{name:'unverified window tinting'}];
 await f.controller.enhance({siteId:'new',tenantId:11,mode:'manual-upgrade'});
 assert.doesNotMatch(JSON.stringify(input),/305-555|secret@example|unsafe research|unverified window tinting/);
});
test('strict monthly budget blocks a request when less than reserved allowance remains',async()=>{
 const f=fixture();
 f.get().websiteStudioAIBudget={month:'2026-11',spentMicroUsd:39_995_000,reservations:[],receipts:[]};
 const r=await f.controller.enhance({siteId:'new',tenantId:11,mode:'auto-new',createdNow:true});
 assert.equal(r.status,'AI_BUDGET_EXHAUSTED');assert.equal(f.calls(),0);
 assert.equal(f.controller.status().remainingUsd,0.005);
});
test('ambiguous provider failure holds the reservation instead of silently freeing possible spend',async()=>{
 const f=fixture({ai:async()=>{throw Error('Connection reset after submit')}});
 const r=await f.controller.enhance({siteId:'new',tenantId:11,mode:'auto-new',createdNow:true});
 assert.equal(r.status,'AI_PROVIDER_UNAVAILABLE');assert.equal(r.reservationHeld,true);
 assert.equal(f.controller.status().reservedUsd,0.01);
});
test('AI settings status is scoped to the Studio budget, not the entire OpenAI account',()=>{
 const f=fixture();const x=f.controller.status();
 assert.equal(x.model,'gpt-6-luna');assert.equal(x.appliesTo,'SBC Website Studio only');
 assert.equal(x.imageGenerationEnabled,false);
});

test('Hybrid AI HTTP endpoints are owner-gated, tenant-isolated, and reject client prompts',async()=>{
 const {register}=require('../enterprise/sbc-website-production-routes.cjs');
 const saved=fixture();
 const app={routes:new Map(),get(path,...h){this.routes.set('GET '+path,h)},post(path,...h){this.routes.set('POST '+path,h)},patch(path,...h){this.routes.set('PATCH '+path,h)}};
 const auth=(req,res,next)=>req.user?next():res.status(401).json({ok:false});
 const owner=(req,res,next)=>req.user?.role==='owner'?next():res.status(403).json({ok:false});
 register(app,{auth,ownerOnly:owner,requireTenant:req=>req.user.tenantId,db:{customers:[]},getStore:saved.get,saveStore:async()=>({ok:true}),writerReady:()=>true,hybridAIController:saved.controller});
 async function call(method,path,{who='owner',tenant=11,id='new',body={}}={}){
  const handlers=app.routes.get(method+' '+path);assert(handlers,'route registered '+method+' '+path);
  const req={params:{id},body,user:who==='none'?null:{role:who,tenantId:tenant,id:'u-'+who}};
  const res={statusCode:200,status(n){this.statusCode=n;return this},json(v){this.body=v;return this},setHeader(){return this}};
  for(const h of handlers){let next=false;await h(req,res,()=>next=true);if(!next)break;}
  return res;
 }
 const path='/api/website-production/sites/:id/studio/ai/upgrade';
 assert.equal((await call('POST',path,{who:'none'})).statusCode,401);
 assert.equal((await call('POST',path,{who:'caller'})).statusCode,403);
 assert.equal((await call('POST',path,{id:'foreign'})).statusCode,404);
 assert.equal((await call('POST',path,{body:{prompt:'Change pricing'}})).statusCode,400);
 const read=await call('GET','/api/website-production/sites/:id/studio/ai');
 assert.equal(read.statusCode,200);assert.equal(read.body.budget.limitUsd,40);
});
