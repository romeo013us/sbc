'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const smart=require('../public/sbc-smart-calling-v1.js');
const sales=require('../public/sbc-website-sales-script-v1.js');

const customer={id:'cust_test',businessName:'Coral Way Tires',contactName:'Alex',phone:'+13055550102'};
const evidence={customerId:'cust_test',stage:'READY_TO_CALL',verifiedResearch:true,googleBusinessVerified:true,
 websitePresence:'not_found',websiteId:'web1',websiteUrl:'/demo/coral-way',callAllowed:true};

test('only a server-approved, available preview unlocks the built-one script',()=>{
 const ready=smart.project(customer,evidence);
 assert.equal(ready.hasVerifiedDemo,true);
 assert.equal(ready.canOpenCall,true);
 assert.match(sales.build(ready.scriptOptions),/I built one/i);
 assert.match(sales.build(ready.scriptOptions),/10 minutes/i);
 assert.match(sales.build(ready.scriptOptions),/John/i);
 for(const partial of [null,{...evidence,websiteUrl:''},{...evidence,stage:'REVIEW_WEBSITE'},{...evidence,websiteId:null}]){
  const view=smart.project(customer,partial);
  assert.equal(view.hasVerifiedDemo,false);
  assert.doesNotMatch(sales.build(view.scriptOptions),/I built one/i);
 }
});
test('cannot claim a missing Google website from unverified CRM research',()=>{
 const unverified=smart.project(customer,{...evidence,verifiedResearch:false});
 assert.equal(unverified.scriptOptions.googleVerified,false);
 assert.equal(unverified.scriptOptions.websitePresence,'not_checked');
 const s=sales.build(unverified.scriptOptions);
 assert.doesNotMatch(s,/didn't see a website linked/i);
 assert.match(s,/do you (?:already )?have a website/i);
});
test('no dialing on suppressed, unready, or recovered accounts',()=>{
 assert.equal(smart.project({...customer,doNotCall:true},evidence).canOpenCall,false);
 assert.equal(smart.project(customer,{...evidence,callAllowed:false}).canOpenCall,false);
 assert.equal(smart.project(customer,evidence,{readOnly:true}).canOpenCall,false);
 assert.equal(smart.project(customer,evidence,{role:'lead_researcher'}).canOpenCall,false);
});
test('outcome submission requires detailed notes and a dated callback',()=>{
 const no=smart.outcomeData('NO_ANSWER','No answer at the business. Follow up next week.',null);
 assert.equal(no.outcome,'NO_ANSWER');
 assert.match(no.note,/No answer/);
 assert.equal(no.dueDate,undefined);
 const callback=smart.outcomeData('FOLLOW_UP_REQUESTED','Owner asked for a demo after the weekend.','2026-11-30');
 assert.equal(callback.dueDate,'2026-11-30');
 assert.throws(()=>smart.outcomeData('FOLLOW_UP_REQUESTED','Owner requested future callback.',null),/date/i);
 assert.throws(()=>smart.outcomeData('DO_NOT_CONTACT','no',null),/note/i);
 assert.throws(()=>smart.outcomeData('UNKNOWN','Some notes with adequate details',null),/outcome/i);
});
test('Account 360 and server-backed call scripts are wired on both web roots',()=>{
 for(const p of ['public','browser_public']){
  const root=path.join(__dirname,'..',p);
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const profile=fs.readFileSync(path.join(root,'sbc-lead-profile-v1.js'),'utf8');
  assert.match(index,/sbc-lead-profile-v1\.js/);
  assert.match(profile,/sbc-smart-calling-v1\.js/);
  assert.match(profile,/loadSmartCalling\(\)/);
  assert.equal(fs.readFileSync(path.join(root,'sbc-smart-calling-v1.js'),'utf8'),
   fs.readFileSync(path.join(__dirname,'../public/sbc-smart-calling-v1.js'),'utf8'));
 }
});

test('website demo appointment defaults are ten minutes and user-confirmed',()=>{
 const mod=require('../public/sbc-appointment-workflow-v1.js');
 const defaults=mod.websiteDemoDefaults();
 assert.equal(defaults.title,'10-minute SBC website preview');
 assert.equal(defaults.durationMinutes,10);
 assert.match(defaults.location,/Phone/);
 for(const p of ['public','browser_public']){
  const app=fs.readFileSync(path.join(__dirname,'..',p,'sbc-appointment-workflow-v1.js'),'utf8');
  assert.match(app,/sbcBookWebsiteDemo/);
 }
});
test('assigned account managers can see and record only their accounts in call desk',()=>{
 const {accessible,project}=require('../enterprise/sbc-website-call-desk.cjs');
 const actor={id:'am1',role:'account_manager',tenantId:1,active:true};
 const same={id:'c1',tenantId:1,assignedTo:'am1',businessName:'My Account'};
 assert.equal(accessible(same,actor,1),true);
 assert.equal(accessible({...same,assignedTo:'am2'},actor,1),false);
 assert.equal(accessible({...same,tenantId:2},actor,1),false);
 assert.equal(project({customers:[same],actor,tenantId:1}).rows.length,1);
});
