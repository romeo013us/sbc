'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('public/lead-research.html'),ui=read('public/lead-research.js'),check=read('public/sbc-lorna-checklist.js'),core=require('../public/lead-research-import-core.js');
assert.equal(html,read('browser_public/lead-research.html'),'mirrored Lorna HTML stays in sync');
assert.equal(check,read('browser_public/sbc-lorna-checklist.js'),'mirrored Lorna checklist stays in sync');
assert.match(html,/URGENT[^<]*RESEARCH/i,'Lorna sees urgent in-workstation assignment');
for(const field of ['address','streetAddressVerification','streetAddressEvidenceUrl','googleBusinessUrl','googleListingAddress','googleAddressVerification','googleAddressEvidenceUrl','nextFollowupNote']){
 assert.match(html,new RegExp('name="'+field+'"'),'research form needs '+field);
 assert.match(check,new RegExp(field),'checklist must read and preserve '+field);
}
assert.match(check,/Full research checklist|Research coverage/i);
assert.match(check,/Google-listed street address/i);
assert.match(check,/Street address source/i);
assert.match(ui,/googleListingAddress/,'CSV import must preserve Google-listed street address');
assert.match(html,/id="sbc-urgent-lead-details"/,'urgent task must show the authorized CRM account data');
assert.match(ui,/function renderUrgentCase/,'Lorna sees the full urgent account profile when assigned to her');
assert.match(ui,/renderUrgentCase\(own\)/,'urgent account must respect the researcher-owned submission filter');
assert.match(ui,/googleBusinessUrl|researchBrief/,'Google profile URL must come from authorized CRM data');

assert.match(ui,/streetAddressVerification/,'CSV import must not erase street evidence status');
assert.match(ui,/researchBrief:importBrief/,'full structured research in CRM brief');
for(const key of ['googleBusinessUrl','googleListingAddress','streetAddressEvidenceUrl','googleAddressEvidenceUrl','streetAddressVerification','googleAddressVerification','nextFollowupNote']){
 assert(core.ORDER.includes(key),'CSV schema must include '+key);
}
const csv='Business Name,Decision Maker,Primary Phone,Street Address,Google Business Profile,Google Listing Address,Street Address Evidence URL,Google Address Evidence URL,Google Address Verification,Research Source\n"Miranda Maintenance & Repair Corp","Alexeis Alonso Miranda","1 305-922-0061","8430 SW 8th St Apt 302, Miami, FL 33144","https://maps.app.goo.gl/rtTGRPAxt9mBt6ft9","8430 SW 8th St Apt 302, Miami, FL 33144","","","not_checked","Lead Research - Bulk Import"';
const preview=core.preview(csv,{format:'csv'});assert.equal(preview.records.length,1);
const lead=preview.records[0].record;
assert.equal(lead.googleBusinessUrl,'https://maps.app.goo.gl/rtTGRPAxt9mBt6ft9');
assert.match(lead.address,/8430 SW 8th St/);
assert.match(lead.googleListingAddress,/8430 SW 8th St/);
assert.equal(lead.googleAddressVerification,'not_checked');
assert.equal(lead.contactName,'Alexeis Alonso Miranda');
assert.equal(lead.verificationSource,'Lead Research - Bulk Import');
for(const file of ['public/lead-research.js','public/sbc-lorna-checklist.js'])new vm.Script(read(file),{filename:file});
// A Google Maps *search* link must never masquerade as a verified Google
// Business Profile. A real supplied profile shortlink should be extractable
// without automatically claiming independent verification.
const browser={window:{},document:{readyState:'loading',addEventListener(){},getElementById(){return null;}},URL,setTimeout(){}};
vm.runInNewContext(check,browser,{filename:'sbc-lorna-checklist.js'});
function fakeForm(){
 const fields=new Map();
 return {elements:{namedItem(name){if(!fields.has(name))fields.set(name,{value:'',maxLength:1200});return fields.get(name);}}};
}
const sourceSearch='Business name: Miranda Maintenance & Repair Corp\\nAddress research https://www.google.com/maps/search/?api=1&query=Miranda';
const onlySearch=fakeForm();
browser.window.SBCResearchBriefV1.parseBrief(sourceSearch,onlySearch);
assert.equal(onlySearch.elements.namedItem('googleBusinessUrl').value,'','Google Maps SEARCH is not a verified business profile');
const profileForm=fakeForm();
browser.window.SBCResearchBriefV1.parseBrief(sourceSearch+'\\nGoogle Business Profile https://maps.app.goo.gl/rtTGRPAxt9mBt6ft9',profileForm);
assert.equal(profileForm.elements.namedItem('googleBusinessUrl').value,'https://maps.app.goo.gl/rtTGRPAxt9mBt6ft9');
assert.equal(browser.window.SBCResearchBriefV1.collect(profileForm).googleBusinessPresence,'not_checked','link alone never verifies Google listing');

console.log('PASS urgent Lorna workbook fields, per-source evidence, research-checklist persistence and CSV mapping');
