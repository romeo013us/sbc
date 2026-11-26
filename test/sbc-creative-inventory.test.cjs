'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {projectInventory}=require('../enterprise/creative-intelligence/marketing-inventory.cjs');
const {parseSocialArgs}=require('../enterprise/creative-intelligence/social-jpeg.cjs');
const plan=[{slug:'first'},{slug:'second'}],logo='a'.repeat(64),now=Date.parse('2026-11-26T18:00:00.000Z');
const row={slug:'first',format:'square',sha256:'b'.repeat(64),sourceAssetId:'c'.repeat(64),logoSha256:logo,reviewVersion:1,currentReviewVersion:1,reviewState:'approved',finalApprovedSha256:'b'.repeat(64),verifiedAt:'2026-11-26T17:55:00.000Z'};
const project=(rows=[],usedSourceIds=[])=>projectInventory({campaigns:plan,assets:rows,usedSourceIds,logoSha256:logo,now});
test('CLI accepts only explicit supported formats and a valid job identifier',()=>{
 assert.deepEqual(parseSocialArgs(['job-1']),{jobId:'job-1',format:'square'});
 assert.deepEqual(parseSocialArgs(['job-1','--format','portrait']),{jobId:'job-1',format:'portrait'});
 for(const a of [[],['../x'],['job','portrait'],['job','--format','bogus'],['job','--format','square','extra']])assert.throws(()=>parseSocialArgs(a),/INVALID_SOCIAL_ARGS/);
});
test('planning is not rendered inventory; ready candidate requires matching review and fresh readback',()=>{
 const empty=project();assert.equal(empty.planned,6);assert.equal(empty.states.missing,6);assert.equal(empty.states.media_verified,0);
 const r=project([row]);assert.equal(r.states.media_verified,1);assert.equal(r.states.missing,5);assert.equal(r.publicationReady,false);
 assert.equal(r.rows.find(x=>x.slug==='first'&&x.format==='square').state,'media_verified');
});
test('stale review, logo, approval or readback cannot be counted as verified inventory',()=>{
 for(const [patch,state] of [[{logoSha256:'d'.repeat(64)},'logo_mismatch'],[{currentReviewVersion:2},'review_required'],[{reviewState:'rejected'},'review_required'],[{finalApprovedSha256:null},'final_review_required'],[{verifiedAt:null},'readback_required'],[{verifiedAt:'2026-11-25T17:55:00.000Z'},'readback_required'],[{verifiedAt:'2026-11-26T19:55:00.000Z'},'readback_required']])assert.equal(project([{...row,...patch}]).rows[0].state,state);
});
test('used sources and conflicting inventory cannot create new publishable supply',()=>{
 assert.equal(project([row],[row.sourceAssetId]).rows[0].state,'previously_used');
 assert.throws(()=>project([row,row]),/INVENTORY_CONFLICT/);
 assert.throws(()=>project([row,{...row,slug:'second',format:'portrait'}]),/INVENTORY_CONFLICT/);
 assert.throws(()=>project([row,{...row,slug:'second',format:'portrait',sha256:'d'.repeat(64)}]),/INVENTORY_CONFLICT/);
 assert.equal(project([row,{...row,format:'portrait',sha256:'d'.repeat(64),finalApprovedSha256:'d'.repeat(64)}]).states.media_verified,2);
 assert.throws(()=>project([{...row,slug:'unknown'}]),/INVALID_INVENTORY_ASSET/);
});
