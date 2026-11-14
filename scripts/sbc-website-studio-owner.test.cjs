'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {register}=require('../enterprise/website-studio/studio-owner-routes.cjs');
const {verifiedProfile}=require('../enterprise/website-studio/contracts.cjs');
function fixture(){
 const app={routes:new Map(),get(path,...handlers){this.routes.set('GET '+path,handlers)},patch(path,...handlers){this.routes.set('PATCH '+path,handlers)},post(path,...handlers){this.routes.set('POST '+path,handlers)}};
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
  const pathname=String(suffix||'').split('?')[0],query=Object.fromEntries(new URLSearchParams(String(suffix||'').split('?')[1]||''));
  const handlers=app.routes.get(method+' '+pattern+pathname);assert(handlers,method+' route '+suffix);
  const req={params:{id},body,query,user:people[who]||null};
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

test('Business Basic auto-preview serves four private pages with working internal navigation',async()=>{
 const fx=fixture();
 fx.store().websiteDemos[0].offerTier='essentials';
 for(const page of ['home','services','about','contact']){
  const response=await fx.call('GET','/auto-preview'+(page==='home'?'':'?page='+page));
  assert.equal(response.statusCode,200,page);
  assert.match(response.headers['content-security-policy'],/sandbox/);
  assert.match(response.body,/noindex,nofollow,noarchive/);
  assert.match(response.body,/studio\/auto-preview\?page=services/);
 }
 assert.equal((await fx.call('GET','/auto-preview?page=pricing')).statusCode,404);
 assert.equal(fx.saves(),0,'inspecting multi-page concepts cannot mutate CRM');
});

test('owner Visual Studio revisions are durable, private, tenant-scoped, and reject stale revisions',async()=>{
 const fx=fixture(),route='/visual';
 assert.equal((await fx.call('GET',route,undefined,'none')).statusCode,401);
 assert.equal((await fx.call('GET',route,undefined,'staff')).statusCode,403);
 assert.equal((await fx.call('GET',route,undefined,'owner','site-b')).statusCode,404);
 const before=await fx.call('GET',route);assert.equal(before.body.version,0);
 const payload={expectedVersion:0,visual:{headline:'A sharper look',subheadline:'Preview of a customized website',density:'airy',photoUrl:'',photoAlt:'',rightsConfirmed:false}};
 assert.equal((await fx.call('PATCH',route,payload,'staff')).statusCode,403);
 assert.equal((await fx.call('PATCH',route,payload,'owner','site-b')).statusCode,404);
 assert.equal((await fx.call('PATCH',route,{...payload,visual:{...payload.visual,photoUrl:'https://evil.example/stuff.jpg',photoAlt:'Bad',rightsConfirmed:true}})).statusCode,400);
 fx.setWriter(false);assert.equal((await fx.call('PATCH',route,payload)).statusCode,423);fx.setWriter(true);
 const saved=await fx.call('PATCH',route,payload);assert.equal(saved.statusCode,200);
 assert.equal(saved.body.version,1);assert.equal(saved.body.durable,true);
 assert.equal((await fx.call('GET',route)).body.visual.headline,'A sharper look');
 const preview=await fx.call('GET','/auto-preview');assert.match(preview.body,/A sharper look/);
 assert.equal((await fx.call('PATCH',route,payload)).statusCode,409);
 assert.equal((await fx.call('PATCH',route,{...payload,expectedVersion:1},'owner','site-approved')).statusCode,409);
 assert.equal(fx.saves(),1);
});
test('simultaneous Visual Studio updates save only one version without losing first editor state',async()=>{
 const fx=fixture(),payload={expectedVersion:0,visual:{headline:'First look',density:'dense'}};
 const results=await Promise.all([fx.call('PATCH','/visual',payload),fx.call('PATCH','/visual',{...payload,visual:{headline:'Second look'}})]);
 assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,409]);
 assert.equal(fx.saves(),1);
});


test('owner can edit headline and subtitle inside isolated private Preview without enabling visitor submissions',async()=>{
 const fx=fixture();
 const response=await fx.call('GET','/auto-preview');
 assert.equal(response.statusCode,200);
 assert.match(response.body,/SBC_STUDIO_V3_INLINE_TEXT/);
 assert.match(response.body,/data-sbc-inline-field/);
 assert.match(response.body,/contenteditable/);
 assert.match(response.body,/parent\.postMessage/);
 assert.match(response.headers['content-security-policy'],/sandbox allow-scripts/);
 assert.equal(fx.saves(),0);
 assert.equal((await fx.call('GET','/auto-preview',undefined,'staff')).statusCode,403);
 assert.equal((await fx.call('GET','/auto-preview',undefined,'none')).statusCode,401);
 assert.doesNotMatch(response.body,/name="creditCard"|document\.cookie|localStorage\.getItem/);
});
test('V3 parent accepts inline edits only from its active owner Preview frame and bounded text fields',()=>{
 const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../public/sbc-website-production-v1.js'),'utf8');
 assert.match(source,/SBC_STUDIO_V3_INLINE_TEXT/);
 assert.match(source,/event\.source\s*!==\s*frame\.contentWindow/);
 assert.match(source,/currentRole\(\)\s*!==\s*'owner'/);
 assert.match(source,/rememberStudioDraft\(\)/);
});


test('private media suggestion endpoint is owner-only, tenant-isolated and does not mutate client records',async()=>{
 const fx=fixture();
 const ok=await fx.call('GET','/media-suggestions');
 assert.equal(ok.statusCode,200);
 assert.equal(ok.body.ok,true);
 assert.equal(ok.body.requiresOwnerRightsReview,true);
 assert(ok.body.nichesCovered>=50);
 assert(Array.isArray(ok.body.candidates)&&ok.body.candidates.length>0);
 assert.equal(fx.saves(),0);
 assert.equal((await fx.call('GET','/media-suggestions',undefined,'staff')).statusCode,403);
 assert.equal((await fx.call('GET','/media-suggestions',undefined,'none')).statusCode,401);
 assert.equal((await fx.call('GET','/media-suggestions',undefined,'owner','site-b')).statusCode,404);
});


test('saved private design revisions can be read and restored by the owner without affecting business facts',async()=>{
 const fx=fixture(),a={expectedVersion:0,visual:{headline:'First art direction',vibe:'minimal'}};
 const one=await fx.call('PATCH','/visual',a);assert.equal(one.statusCode,200);
 const two=await fx.call('PATCH','/visual',{expectedVersion:1,visual:{headline:'Second art direction',vibe:'cinematic'}});
 assert.equal(two.statusCode,200);
 const history=await fx.call('GET','/visual/history');
 assert.equal(history.statusCode,200);
 assert.deepEqual(history.body.revisions.map(r=>r.version),[0,1]);
 assert.equal(history.body.revisions[1].visual.headline,'First art direction');
 assert.equal((await fx.call('GET','/visual/history',undefined,'staff')).statusCode,403);
 assert.equal((await fx.call('GET','/visual/history',undefined,'owner','site-b')).statusCode,404);
 const restored=await fx.call('POST','/visual/restore',{expectedVersion:2,restoreVersion:1});
 assert.equal(restored.statusCode,200);
 assert.equal(restored.body.version,3);
 assert.equal(restored.body.visual.headline,'First art direction');
 assert.equal(fx.store().websiteDemos[0].websiteStudioVisualAudit.action,'OWNER_STUDIO_VISUAL_RESTORE');
 assert.equal(fx.store().websiteDemos[0].websiteStudioVisualAudit.restoredFromVersion,1);
 assert.equal(fx.store().websiteDemos[0].customer.businessName,'CJ Window Tinters');
 assert.equal(fx.store().websiteDemos[0].status,'Draft');
 const newer=await fx.call('GET','/visual/history');
 assert.deepEqual(newer.body.revisions.map(r=>r.version),[0,1,2]);
 assert.equal(newer.body.revisions[2].visual.headline,'Second art direction');
 assert.equal(fx.saves(),3);
});
test('revision restore rejects cross-tenant, stale, unpublished, archived and unauthorized attempts',async()=>{
 const fx=fixture();
 await fx.call('PATCH','/visual',{expectedVersion:0,visual:{headline:'Save one'}});
 assert.equal((await fx.call('POST','/visual/restore',{expectedVersion:1,restoreVersion:0},'staff')).statusCode,403);
 assert.equal((await fx.call('POST','/visual/restore',{expectedVersion:1,restoreVersion:0},'owner','site-b')).statusCode,404);
 assert.equal((await fx.call('POST','/visual/restore',{expectedVersion:0,restoreVersion:0})).statusCode,409);
 assert.equal((await fx.call('POST','/visual/restore',{expectedVersion:1,restoreVersion:999})).statusCode,404);
 fx.setWriter(false);
 assert.equal((await fx.call('POST','/visual/restore',{expectedVersion:1,restoreVersion:0})).statusCode,423);
 fx.setWriter(true);
 assert.equal((await fx.call('POST','/visual/restore',{expectedVersion:1,restoreVersion:0},'owner','site-approved')).statusCode,409);
 assert.equal(fx.saves(),1);
});
test('visual revisions include 20 max saved snapshots and owner UI offers explicit restore, not silent rollback',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const ui=fs.readFileSync(path.join(__dirname,'../public/sbc-website-production-v1.js'),'utf8');
 assert.match(ui,/sbcStudioSavedRevisions/);
 assert.match(ui,/sbcStudioRestoreRevision/);
 assert.match(ui,/\/visual\/history/);
 assert.match(ui,/\/visual\/restore/);
 assert.equal(ui,fs.readFileSync(path.join(__dirname,'../browser_public/sbc-website-production-v1.js'),'utf8'));
});


test('V4 brand and actual-work photo edits remain owner-only, versioned, tenant-isolated and private',async()=>{
 const fx=fixture();
 const before='https://res.cloudinary.com/sbc-client-demo/image/upload/v11223344/before.jpg';
 const after='https://res.cloudinary.com/sbc-client-demo/image/upload/v11223344/after.jpg';
 const visual={
  brandKit:{primary:'#163047',accent:'#99440D',ownerConfirmed:true},
  beforeAfter:{title:'Actual client detailing project',beforeUrl:before,afterUrl:after,
   beforeAlt:'Before detailing',afterAlt:'After detailing',rightsConfirmed:true,actualWorkConfirmed:true}
 };
 assert.equal((await fx.call('PATCH','/visual',{expectedVersion:0,visual},'staff')).statusCode,403);
 assert.equal((await fx.call('PATCH','/visual',{expectedVersion:0,visual},'owner','site-b')).statusCode,404);
 const saved=await fx.call('PATCH','/visual',{expectedVersion:0,visual});
 assert.equal(saved.statusCode,200,JSON.stringify(saved.body));
 assert.equal(saved.body.visual.brandKit.enabled,true);
 assert.equal(saved.body.visual.beforeAfter.enabled,true);
 assert.equal(fx.saves(),1);
 const preview=await fx.call('GET','/auto-preview');
 assert.equal(preview.statusCode,200);
 assert.match(preview.body,/data-sbc-v4-comparison/);
 assert.match(preview.body,/sbc-v4-range/);
 assert.match(preview.body,/actual customer project/i);
 assert.match(preview.headers['content-security-policy'],/https:\/\/res\.cloudinary\.com/);
 const history=await fx.call('GET','/visual/history');
 assert.equal(history.statusCode,200);
 assert.deepEqual(history.body.revisions.map(x=>x.version),[0]);
 const undo=await fx.call('POST','/visual/restore',{expectedVersion:1,restoreVersion:0});
 assert.equal(undo.statusCode,200);
 const reverted=await fx.call('GET','/auto-preview');
 assert.doesNotMatch(reverted.body,/data-sbc-v4-comparison/);
 assert.equal(fx.saves(),2);
 assert.equal((await fx.call('PATCH','/visual',{expectedVersion:2,visual},'owner','site-approved')).statusCode,409);
});


test('V4 freeform GET preview is owner-only, read-only and rejects hostile layout objects',async()=>{
 const fx=fixture();
 const node={id:'service-1',grid:{colSpan:8,rowSpan:2},breakpoints:{tablet:{colSpan:6},mobile:{colSpan:12}}};
 const grid={enabled:true,nodes:[node]},query='/auto-preview?freeformGrid='+encodeURIComponent(JSON.stringify(grid));
 assert.equal((await fx.call('GET',query,undefined,'staff')).statusCode,403);
 assert.equal((await fx.call('GET',query,undefined,'owner','site-b')).statusCode,404);
 const beforeSaves=fx.saves();
 assert.equal((await fx.call('GET',query)).statusCode,409,'unverified draft may not display invented services');
 const approved=await fx.call('PATCH','/approved-profile',{expectedVersion:0,ownerConfirmed:true,profile});
 assert.equal(approved.statusCode,200);
 const preview=await fx.call('GET',query);
 assert.equal(preview.statusCode,200);
 assert.match(preview.body,/data-sbc-grid-node="service-1"/);
 assert.match(preview.body,/grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
 assert.match(preview.headers['content-security-policy'],/sandbox allow-scripts/);
 assert.equal(fx.saves(),beforeSaves+1);
 const injected={enabled:true,nodes:[{id:'contact',grid:{colSpan:8}}]};
 assert.equal((await fx.call('GET','/auto-preview?freeformGrid='+encodeURIComponent(JSON.stringify(injected)))).statusCode,400);
 assert.equal((await fx.call('GET','/auto-preview?freeformGrid=not-json')).statusCode,400);
 assert.equal(fx.saves(),beforeSaves+1);
});
test('owner versioned Studio save/restore keeps freeform grid draft distinct from facts and Published',async()=>{
 const fx=fixture();
 const approve=await fx.call('PATCH','/approved-profile',{expectedVersion:0,ownerConfirmed:true,profile});
 assert.equal(approve.statusCode,200);
 const spec={enabled:true,nodes:[{id:'service-1',grid:{colSpan:8}}]};
 const saved=await fx.call('PATCH','/visual',{expectedVersion:0,visual:{freeformGrid:spec}});
 assert.equal(saved.statusCode,200);
 assert.equal(saved.body.visual.freeformGrid.nodes[0].grid.colSpan,8);
 const preview=await fx.call('GET','/auto-preview');
 assert.equal(preview.statusCode,200);
 assert.match(preview.body,/data-sbc-grid-node="service-1"/);
 assert.equal(fx.store().websiteDemos[0].status,'Draft');
 assert.equal(fx.store().websiteDemos[0].customer.businessName,'CJ Window Tinters');
 const restore=await fx.call('POST','/visual/restore',{expectedVersion:1,restoreVersion:0});
 assert.equal(restore.statusCode,200);
 const returned=await fx.call('GET','/visual');
 assert.deepEqual(returned.body.visual.freeformGrid,{enabled:false,nodes:[]});
 assert.equal(fx.saves(),3);
});


test('unverified prospect drafts cannot persist a verified-service freeform layout',async()=>{
 const fx=fixture();
 const spec={enabled:true,nodes:[{id:'service-1',grid:{colSpan:8}}]};
 const denied=await fx.call('PATCH','/visual',{expectedVersion:0,visual:{freeformGrid:spec}});
 assert.equal(denied.statusCode,409);
 assert.equal(denied.body.code,'STUDIO_GRID_APPROVED_SERVICES_REQUIRED');
 assert.equal(fx.saves(),0);
});


test('grid inspector only offers existing owner-approved service cards and rejects missing indexes',async()=>{
 const fx=fixture();
 const first=await fx.call('GET','/visual');
 assert.equal(first.body.maxEditableServices,0);
 await fx.call('PATCH','/approved-profile',{expectedVersion:0,ownerConfirmed:true,profile});
 const ready=await fx.call('GET','/visual');
 assert.equal(ready.body.maxEditableServices,2);
 const attempted={enabled:true,nodes:[{id:'service-6',grid:{colSpan:6}}]};
 const response=await fx.call('GET','/auto-preview?freeformGrid='+encodeURIComponent(JSON.stringify(attempted)));
 assert.equal(response.statusCode,400);
 assert.equal(response.body.code,'STUDIO_GRID_UNKNOWN_SERVICE');
 assert.equal(fx.saves(),1);
});


test('legacy malformed approved profile does not break owner visual inspector read-only load',async()=>{
 const fx=fixture(),site=fx.store().websiteDemos[0];
 site.websiteStudioProfileVersion=1;
 site.websiteStudioApprovedProfile={business:{name:'Other Tenant'},services:[{name:'Incorrect'}]};
 const read=await fx.call('GET','/visual');
 assert.equal(read.statusCode,200);
 assert.equal(read.body.maxEditableServices,0);
 assert.equal(fx.saves(),0);
});


test('Studio owner review reports possible category/service mismatch and blank location without changing CRM',async()=>{
 const fx=fixture();
 const site=fx.store().websiteDemos[0];
 site.industry='Handyman Services';
 site.customer.city='';
 site.customer.region='';
 site.customer.websiteVerifiedDetails={verified:true,services:['Window Tinting']};
 const before=structuredClone(fx.store());
 const result=await fx.call('GET');
 assert.equal(result.statusCode,200);
 assert.equal(result.body.businessReview.status,'needs_review');
 assert(result.body.businessReview.issues.some(x=>x.code==='MISSING_CITY'));
 assert(result.body.businessReview.issues.some(x=>x.code==='MISSING_REGION'));
 assert(result.body.businessReview.issues.some(x=>x.code==='POSSIBLE_CATEGORY_SERVICE_MISMATCH'));
 assert.equal(result.body.approvedProfile,null);
 const draft=await fx.call('GET','/auto-preview');
 assert.equal(draft.statusCode,200);
 assert.match(draft.body,/SBC_STUDIO_CONSISTENCY_NOTICE/);
 assert.match(draft.body,/PRIVATE DRAFT/);
 assert.deepEqual(fx.store(),before,'read-only review cannot auto-approve or change records');
 assert.equal(fx.saves(),0);
 assert.equal((await fx.call('GET',undefined,undefined,'staff')).statusCode,403);
 assert.equal((await fx.call('GET',undefined,undefined,'owner','site-b')).statusCode,404);
});
