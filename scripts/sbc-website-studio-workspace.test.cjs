'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {reviewBusinessConsistency}=require('../enterprise/website-studio/business-consistency.cjs');
const profile=(category,services,city='Miami',region='FL')=>({
 business:{name:'Test Business',category,city,region},
 services:services.map(name=>({name})),contact:{phone:'305-555-0110'}
});
test('Handyman and window tinting prompts REVIEW, never falsely states mismatch as fact or changes CRM',()=>{
 const input=profile('Handyman Services',['Window Tinting'],'','');
 const before=JSON.stringify(input);
 const result=reviewBusinessConsistency(input,{ownerApproved:false});
 assert.equal(result.status,'needs_review');
 assert(result.issues.some(x=>x.code==='POSSIBLE_CATEGORY_SERVICE_MISMATCH'));
 assert(result.issues.some(x=>x.code==='MISSING_CITY'));
 assert(result.issues.some(x=>x.code==='MISSING_REGION'));
 assert(result.issues.some(x=>x.code==='FACTS_NOT_OWNER_APPROVED'));
 assert(result.issues.every(x=>x.level==='review'));
 assert.equal(JSON.stringify(input),before,'validator cannot rewrite customer data');
});
test('Valid matched services and location should not be flagged as unrelated',()=>{
 const matched=reviewBusinessConsistency(profile('Auto Detailing',['Interior Detailing','Exterior Car Cleaning']),{ownerApproved:true});
 assert.equal(matched.status,'ready_for_private_review');
 assert.equal(matched.issues.length,0);
 const ambiguous=reviewBusinessConsistency(profile('Handyman Services',['General Repairs','Painting and Flooring']),{ownerApproved:true});
 assert(!ambiguous.issues.some(x=>x.code==='POSSIBLE_CATEGORY_SERVICE_MISMATCH'));
});
test('Unrecognized categories do not fabricate conclusions and verified mismatch is still surfaced',()=>{
 const unknown=reviewBusinessConsistency(profile('Other Local Business',['Custom Service']),{ownerApproved:true});
 assert(!unknown.issues.some(x=>x.code==='POSSIBLE_CATEGORY_SERVICE_MISMATCH'));
 const mismatched=reviewBusinessConsistency(profile('Handyman Services',['Auto Window Tinting']),{ownerApproved:true});
 assert(mismatched.issues.some(x=>x.code==='POSSIBLE_CATEGORY_SERVICE_MISMATCH'));
});
test('Editor is preview-first with an actual V4 smart URL, two-level controls and a separate Publish & QA drawer',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../public/sbc-website-production-v1.js'),'utf8');
 const mirror=fs.readFileSync(path.join(__dirname,'../browser_public/sbc-website-production-v1.js'),'utf8');
 assert.equal(ui,mirror);
 for(const id of ['sbcStudioWorkspace','sbcStudioCanvas','sbcStudioToolRail','sbcStudioModeSimple',
  'sbcStudioModePro','sbcFactoryPublishDrawer','sbcFactoryReviewBanner','sbcStudioConsistency',
  'sbcStudioProControls','sbcFactoryFrame'])assert(ui.includes(id),id);
 assert.match(ui,/sbc-studio-workspace[^\n]*grid-template-columns/);
 assert.match(ui,/\.sbc-studio-workspace/);
 assert.match(ui,/function syncStudioPreviewAddress/);
 assert.match(ui,/new URL\(frame\.src/);
 assert.match(ui,/sbcStudioReviewPanel/);
 assert.match(ui,/data-factory-device="tablet"/);
 assert.match(ui,/SBC_STUDIO_GRID_RESIZE/);
 assert.doesNotMatch(ui,/SBC_AI_REQUEST_FOR_LAYOUT/);
});
test('Consistency check is read-only in owner route and private compiler protects unverified preview claims',()=>{
 const server=fs.readFileSync(path.join(__dirname,'../enterprise/website-studio/studio-owner-routes.cjs'),'utf8');
 assert.match(server,/reviewBusinessConsistency/);
 assert.match(server,/businessReview/);
 assert.match(server,/SBC_STUDIO_CONSISTENCY_NOTICE/);
 assert.match(server,/mode==='auto-preview'/);
 assert.match(server,/auth,ownerOnly/);
 assert.doesNotMatch(server,/AUTO_APPROVE_CONSISTENCY/);
});
