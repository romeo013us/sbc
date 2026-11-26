'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require('node:path').join(__dirname,'../public/sbc-website-call-desk-v1.js'),'utf8');
test('existing call desk loads selected evidence on demand, escapes notes, keeps approved script',async()=>{
 const calls=[],html=[];const row={customerId:'lead-1',businessName:'Fixture',stage:'READY_TO_CALL',websitePresence:'found',script:'Approved owner script',callAllowed:true,phone:'+13055550123'};
 const dossier={contactReview:'required',websiteEvidence:{status:'CAPTURE_REVIEW_REQUIRED'},talkingPoints:{proofPoints:[{findingEn:'<img src=x onerror=alert(1)>',findingEs:'Texto',source:{checkedAt:'2026-11-26T16:00:00.000Z'}}]}};
 const context={state:{me:{role:'owner'}},document:{readyState:'loading',addEventListener(){},getElementById(){return null},querySelectorAll(){return []}},window:{},setInterval(){return 1},clearInterval(){},openModal(_t,s){html.push(s)},api:async url=>{calls.push(url);return {ok:true,rows:[url.includes('customerId=')?{...row,salesDossier:dossier}:row]}}};vm.runInNewContext(src,context);await context.window.SBC_WEBSITE_CALL_DESK.open();assert.equal(calls.length,2);assert.match(calls[1],/customerId=lead-1/);assert.match(html.at(-1),/Website evidence/);assert.match(html.at(-1),/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(html.at(-1),/<img src=x/);assert.match(html.at(-1),/Approved owner script/);
});
