'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('owner UI fails closed on missing staging schema and does not attempt mutation',()=>{
 const js=fs.readFileSync(path.join(root,'public/sbc-sales-command-v1.js'),'utf8');
 assert(js.includes("api('/api/owner/sales-command/readiness')"));
 assert(js.includes('setActionButtons(false)'));
 assert(js.includes('setActionButtons(true)'));
 assert(js.includes('REVIEW_AND_APPLY_STAGING_MIGRATION'));
 assert(!js.includes('CREATE TABLE'));
 const mirror=fs.readFileSync(path.join(root,'browser_public/sbc-sales-command-v1.js'),'utf8');
 assert.equal(js,mirror);
});
