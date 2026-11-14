'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {register}=require('../enterprise/website-studio/studio-owner-routes.cjs');
const {verifiedProfile}=require('../enterprise/website-studio/contracts.cjs');
function fixture(){
 const app={routes:new Map(),get(path,...handlers){this.routes.set('GET '+path,handlers)},patch(path,...handlers){this.routes.set('PATCH '+path,handlers)}};
 const people={owner:{id:'owner-a',role:'owner',tenantId:11},staff:{id:'staff-a',role:'caller',tenantId:11},foreign:{id:'owner-b',role:'owner',tenantId:22}};
 let store={websiteDemos:[
  {id:'site-a',tenantId:11,customerId:'cust-a',status:'Draft',industry:'Window Tinting Service',customer:{businessName:'CJ Window Tinters',city:'Miami',region:'FL'},unverifiedServices:['Car audio installations'],researchSignals:[{title:'Luxury guarantees are everywhere'}]},
  {id:'site-b',tenantId:22,customerId:'cust-b',status:'Draft',customer:{businessName:'Other Company',city:'Miami'}},
  {id:'site-approved',tenantId:11,customerId:'cust-a',status:'Approved',customer:{businessName:'CJ Window Tinters'}}
 ]};
 let writer=true,saves=0;
 const auth=(req,res,next)=>req.user?next():res.status(401).json({ok:false});
 const ownerOnly=(req,res,next)=>req.user?.role==='owner'?next():res.status(403).json({ok:false});
 register(app,{auth,ownerOnly,requireTenant:req=>req.user.tenantId,getStore:()=>store,
  saveStore:async newStore=>{await new Promise(resolve=>setTimeout(resolve,2));store=structuredClone(newStore);saves++;return {ok:true}},
  writerReady:()=>writer});
 const pattern='/api/website-production/sites/:id/studio';
 async function call(method,suffix='',body,who='owner',id='site-a'){
  const handlers=app.routes.get(method+' '+pattern+suffix);assert(handlers,method+' route '+suffix);
  const req={params:{id},body,user:people[who]||null};
  const res={statusCode:200,headers:{},body:null,status(n){this.statusCode=n;return this},json(x){this.body=x;return this},setHeader(k,v){this.headers[k.toLowerCase()]=v;return this},type(t){this.headers['content-type']=t;return this},send(v){this.body=v;return this}};
  for(let i=0;i<handlers.length;i++){
   let nexted=false;await handlers[i](req,res,()=>{nexted=true});
   if(!nexted)break;
  }
  return res;
 }
 return {call,store:()=>store,setWriter:v=>{writer=v},saves:()=>saves};
}
const profile={business:{name:'CJ Window Tinters',category:'Window Tinting Service',city:'Miami',region:'FL'},services:[{name:'Automotive Window Tinting',description:'Window film consultation and options'},{name:'Paint Protection Film',description:'Only if the owner verifies this offering'}],contact:{phone:'305-555-0119',email:'hello@example.com'}};

test('CRM can prefill a private review form without auto-approving site facts',async()=>{
 const fx=fixture();
 const draft=fx.store().websiteDemos[0];
 draft.customer.phone='305-555-0123';
 draft.customer.email='owner@example.com';
 draft.customer.websiteVerifiedDetails={verified:true,services:['Automotive Window Tinting','Ceramic Film Options']};
 draft.customer.leadIntelligence={researchBrief:{services:['Unverified Audio Installation']}};
 const r=await fx.call('GET');
 assert.equal(r.statusCode,200);
 assert.equal(r.body.approvedProfile,null);
 assert.equal(r.body.suggestedProfile.business.name,'CJ Window Tinters');
 assert.equal(r.body.suggestedProfile.contact.phone,'305-555-0123');
 assert.equal(r.body.suggestedProfile.services[0].name,'Automotive Window Tinting');
 assert.doesNotMatch(JSON.stringify(r.body.suggestedProfile),/Unverified Audio Installation/);
 assert.equal(r.body.suggestedProfile.reviewRequired,true);
 assert.equal(fx.saves(),0);
});

test('owner-only studio read is tenant isolated and does not trust research',async()=>{
 const fx=fixture();
 assert.equal((await fx.call('GET',undefined,undefined,'none')).statusCode,401);
 assert.equal((await fx.call('GET',undefined,undefined,'staff')).statusCode,403);
 assert.equal((await fx.call('GET','',undefined,'owner','site-b')).statusCode,404);
 const r=await fx.call('GET');assert.equal(r.statusCode,200);
 assert.equal(r.body.approvedProfile,null);assert.equal(r.body.version,0);
 assert.equal(r.body.identity.name,'CJ Window Tinters');
 assert.equal(JSON.stringify(r.body).includes('Luxury guarantees'),false);
 assert.equal(JSON.stringify(r.body).includes('Car audio'),false);
});

test('approval requires owner confirmation, safe fields, writer and matching business identity',async()=>{
 const fx=fixture(),suffix='/approved-profile',payload={expectedVersion:0,ownerConfirmed:true,profile};
 assert.equal((await fx.call('PATCH',suffix,payload,'none')).statusCode,401);
 assert.equal((await fx.call('PATCH',suffix,payload,'staff')).statusCode,403);
 assert.equal((await fx.call('PATCH',suffix,payload,'owner','site-b')).statusCode,404);
 assert.equal((await fx.call('PATCH',suffix,{...payload,ownerConfirmed:false})).statusCode,400);
 assert.equal((await fx.call('PATCH',suffix,{...payload,profile:{...profile,business:{...profile.business,name:'Wrong Company'}}})).statusCode,409);
 assert.equal((await fx.call('PATCH',suffix,{...payload,profile:{...profile,verification:{approvedBy:'fake',approvedAt:'2030-01-01T00:00:00Z'}}})).statusCode,400);
 fx.setWriter(false);assert.equal((await fx.call('PATCH',suffix,payload)).statusCode,423);fx.setWriter(true);
 const ok=await fx.call('PATCH',suffix,payload);assert.equal(ok.statusCode,200);
 assert.equal(ok.body.version,1);assert.equal(ok.body.durable,true);assert.equal(fx.saves(),1);
 const saved=fx.store().websiteDemos[0];assert.equal(saved.status,'Draft');
 assert.equal(saved.websiteStudioApprovedProfile.verification.approvedBy,'owner-a');
 assert.doesNotThrow(()=>verifiedProfile(saved.websiteStudioApprovedProfile));
 assert.equal(JSON.stringify(saved.websiteStudioApprovedProfile).includes('Car audio'),false);
 assert.equal((await fx.call('PATCH',suffix,payload)).statusCode,409);
 assert.equal((await fx.call('PATCH',suffix,{...payload,expectedVersion:1},'owner','site-approved')).statusCode,409);
});

test('private studio preview only renders owner-approved facts with locked-down HTTP headers',async()=>{
 const fx=fixture();
 assert.equal((await fx.call('GET','/preview')).statusCode,409);
 await fx.call('PATCH','/approved-profile',{expectedVersion:0,ownerConfirmed:true,profile});
 const result=await fx.call('GET','/preview');
 assert.equal(result.statusCode,200);assert.match(result.headers['content-type'],/html/);
 assert.match(result.headers['content-security-policy'],/sandbox/);
 assert.equal(result.headers['cache-control'],'no-store');
 assert.match(result.body,/CJ Window Tinters/);assert.match(result.body,/Automotive Window Tinting/);
 assert.doesNotMatch(result.body,/Car audio installations|Luxury guarantees|certified professionals/i);
 assert.match(result.body,/noindex,nofollow,noarchive/);
 assert.doesNotMatch(result.body,/<script[^>]+src=/i);
 assert.equal((await fx.call('GET','/preview',undefined,'staff')).statusCode,403);
 assert.equal((await fx.call('GET','/preview',undefined,'owner','site-b')).statusCode,404);
 const bundle=await fx.call('GET','/bundle');assert.equal(bundle.statusCode,200);
 assert.deepEqual(Object.keys(bundle.body.files).sort(),['design-tokens.json','index.html','layout-ast.json','site.js','styles.css'].sort());
 assert.equal(bundle.body.publicationReady,false);
});

test('concurrent approvals honor expectedVersion with a single durable winner',async()=>{
 const fx=fixture(),payload={expectedVersion:0,ownerConfirmed:true,profile};
 const [a,b]=await Promise.all([fx.call('PATCH','/approved-profile',payload),fx.call('PATCH','/approved-profile',payload)]);
 assert.deepEqual([a.statusCode,b.statusCode].sort(),[200,409]);assert.equal(fx.saves(),1);
});

test('art-directed private auto-preview works for a first-time draft without fact approval',async()=>{
 const fx=fixture();
 assert.equal((await fx.call('GET','/auto-preview',undefined,'none')).statusCode,401);
 assert.equal((await fx.call('GET','/auto-preview',undefined,'staff')).statusCode,403);
 assert.equal((await fx.call('GET','/auto-preview',undefined,'owner','site-b')).statusCode,404);
 const r=await fx.call('GET','/auto-preview');
 assert.equal(r.statusCode,200);
 assert.match(r.headers['content-security-policy'],/sandbox/);
 assert.match(r.body,/UNVERIFIED DESIGN CONCEPT/);
 assert.match(r.body,/DESIGN PLANNING ONLY/);
 assert.match(r.body,/data-sbc-composition="performance-bay"/);
 assert.doesNotMatch(r.body,/Car audio installations|Luxury guarantees/i);
 assert.equal(fx.saves(),0,'new preview must never write or approve the customer record');
 assert.equal((await fx.call('GET','/auto-preview',undefined,'owner','site-approved')).statusCode,409);
 assert.equal((await fx.call('GET','/preview')).statusCode,409,'approved-only preview remains locked');
});
