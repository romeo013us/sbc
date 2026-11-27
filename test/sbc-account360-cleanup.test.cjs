'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sales=require('../public/sbc-website-sales-script-v1.js');
test('only an approved preview permits the owner-built website claim',()=>{
 for(const approved of [undefined,false]){const text=sales.build({businessName:'Example',approved});assert.doesNotMatch(text,/I BUILT YOU ONE|show you what I put together/i);assert.match(text,/prepare.*concept/i);}
 assert.match(sales.build({approved:true}),/WELL, THE THING IS, I BUILT YOU ONE!/);
});
test('Account 360 has one primary calling path, collapsed coaching and a deliberate call outcome',()=>{
 const profile=read('public/sbc-lead-profile-v1.js'),smart=read('public/sbc-smart-calling-v1.js');
 const bar=profile.split("'<div class=\"sbc-profile-actions\">'")[1].split("'<div id=\"sbcProfileActionSlot\">")[0];
 assert.doesNotMatch(bar,/btn\('call',/);assert.match(bar,/btn\('smartcall',/);
 assert.match(smart,/details class="sbc-sc-coaching"/);assert.match(smart,/option value=""[^>]*>Choose outcome/);
 assert.match(profile,/sbc-profile-history/);assert.match(profile,/sbc-profile-contact-summary/);
 for(const f of ['sbc-lead-profile-v1.js','sbc-smart-calling-v1.js','sbc-website-sales-script-v1.js','index.html'])assert.equal(read('public/'+f),read('browser_public/'+f));
});
