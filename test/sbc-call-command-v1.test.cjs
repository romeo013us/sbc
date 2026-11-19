'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const command=require('../public/sbc-call-command-v1.js');
const now=new Date('2026-11-19T16:00:00Z');
test('E164 validation and default-deny preflight',()=>{
 assert.equal(command.cleanPhone('(305) 555-0198'),'+13055550198');
 assert.equal(command.cleanPhone('911'),'');
 const lead={phone:'3055550198',status:'Lead'};
 assert.equal(command.callEligibility(lead,now).allowed,false);
 assert.match(command.callEligibility(lead,now).reason,/verif/i);
});
test('suppressions override all calling flags',()=>{
 const a={id:'x',phone:'3055550198',status:'DNC',phoneVerified:true,dncChecked:true,callingAuthorized:true,prospectTimeZone:'America/New_York'};
 assert.equal(command.callEligibility(a,now).allowed,false);
});
test('local calling window, timezone and verified permissions',()=>{
 const a={id:'x',phone:'3055550198',phoneVerified:true,dncChecked:true,callingAuthorized:true,prospectTimeZone:'America/New_York'};
 assert.equal(command.callEligibility(a,now).allowed,true);
 assert.equal(command.callEligibility(a,new Date('2026-11-19T03:00:00Z')).allowed,false);
 assert.equal(command.callEligibility({...a,prospectTimeZone:''},now).allowed,false);
});
test('follow-ups first, suppressed and invalid accounts excluded',()=>{
 const a=[{id:'z',phone:'3055550123',businessName:'Zebra'},{id:'d',phone:'3055550144',status:'DNC'},{id:'b',phone:'3055550155',followUp:'2026-11-14'},{id:'f',phone:'bad'},{id:'a',phone:'3055550166',followUp:'2026-11-17'}];
 assert.deepEqual(command.reviewQueue(a,now).map(x=>x.id),['b','a','z']);
 assert.equal(command.nextAccountId(a,'b',now),'a');
});
test('unverified CRM data is escaped in account cockpit',()=>{
 const html=command.render({id:'x',businessName:'<img src=x>',phone:'3055550198'},[{id:'x',phone:'3055550198'}],'en',now);
 assert(!html.includes('<img'));assert(html.includes('&lt;img'));assert(html.includes('Permission not yet verified'));
});
test('Save & Next only advances once after matching durable confirmation',()=>{
 const coordinator=command.createSaveCoordinator();
 coordinator.arm('a');assert.equal(coordinator.confirm('b'),false);
 assert.equal(coordinator.confirm('a'),true);assert.equal(coordinator.confirm('a'),false);
 coordinator.arm('c');coordinator.clear();assert.equal(coordinator.confirm('c'),false);
});
test('mirrors and actual Account Manager integration are installed',()=>{
 for(const name of ['sbc-call-command-v1.js','sbc-call-command-v1.css','sbc-account-manager-v1.js','sbc-account-manager-v1.html'])
  assert.equal(read('public/'+name),read('browser_public/'+name),name+' must be mirrored');
 const html=read('public/sbc-account-manager-v1.html'),js=read('public/sbc-account-manager-v1.js');
 assert(html.includes('/sbc-call-command-v1.js?v=1'));
 assert(html.includes('/sbc-call-command-v1.css?v=1'));
 assert(js.includes('SBCCallCommand.open'));
 assert(js.includes('SBCCallCommand.saved'));
 assert(js.includes('SBCCallCommand.failed'));
 assert(js.includes('SBCCallCommand.clear'));
 assert(js.includes("['owner','account_manager'].includes(state.role)"));
});
