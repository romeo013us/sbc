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

test('shared manager workstation and owner profile form are mirrored and wired to scoped endpoints',()=>{
 const read=p=>fs.readFileSync(path.join(root,p),'utf8');
 for(const name of ['sbc-sales-command.html','sbc-sales-command-v1.js','sbc-account-manager-v1.html','sbc-manager-sales-progress-v1.js']){
  assert.equal(read('public/'+name),read('browser_public/'+name));
 }
 const owner=read('public/sbc-sales-command.html'),ownerJS=read('public/sbc-sales-command-v1.js');
 assert.match(owner,/<form id="workstationProfileForm">/);
 assert.match(owner,/<button type="submit" id="workstationSave" disabled>/);
 assert(owner.includes('id="workstationBilingual"'));
 assert(ownerJS.includes('expectedRevision:snapshot.revision'));
 assert(ownerJS.includes('OWNER_CONFIRMED_WORKSTATION_TIER'));
 assert(ownerJS.includes('profileSnapshot=null'));
 const employee=read('public/sbc-account-manager-v1.html'),employeeJS=read('public/sbc-manager-sales-progress-v1.js');
 assert(employee.includes('id="sbcMyWorkstationProfile"'));
 assert(employeeJS.includes("fetch('/api/sbc/sales/workstation/me'"));
 assert(!employeeJS.includes('/api/owner/sales-command/workstation'));
 assert(employeeJS.includes('Workstation tier not verified'));
 assert(employeeJS.includes('Signed compensation and calling permissions are separate.'));
 new (require('node:vm').Script)(ownerJS);new (require('node:vm').Script)(employeeJS);
});

test('paid trial enrollment requires explicit owner attestations and employee reads are self scoped',()=>{
 const read=p=>fs.readFileSync(path.join(root,p),'utf8');
 const html=read('public/sbc-sales-command.html'),js=read('public/sbc-sales-command-v1.js'),employee=read('public/sbc-manager-sales-progress-v1.js');
 assert(html.includes('id="trialEnrollForm"'));assert(html.includes('id="trialSigned"'));assert(html.includes('id="trialPay"'));assert(html.includes('id="trialFair"'));
 assert(js.includes("confirm:'OWNER_CONFIRMED_PAID_TRIAL'"));assert(js.includes('/api/owner/sales-command/workforce/enroll'));
 assert(employee.includes("fetch('/api/sbc/sales/workforce/trial/me'"));assert(!employee.includes('/api/owner/sales-command/workforce/enroll'));
 assert(read('public/sbc-account-manager-v1.html').includes('id="sbcMyTrialProgress"'));
 new (require('node:vm').Script)(js);new (require('node:vm').Script)(employee);
});

test('owner payroll and recognition previews are wired without payment or automatic awards',()=>{
 const read=p=>fs.readFileSync(path.join(root,p),'utf8');
 const html=read('public/sbc-sales-command.html'),js=read('public/sbc-sales-command-v1.js');
 for(const id of ['payScheduleForm','payScheduleReviewed','payScheduleFirst','payScheduleAgreement','recognitionForm','recognitionManager','recognitionWeek','recognitionLedger','recognitionQualityReviewed','recognitionQualityPassed'])assert(html.includes('id="'+id+'"'),id);
 assert(js.includes('/api/owner/sales-command/workforce/pay-schedule'));
 assert(js.includes('/api/owner/sales-command/workforce/recognition'));
 assert(js.includes('scheduleReviewed:'));
 assert(js.includes('qualityReviewed:'));
 assert(js.includes('ledgerComplete:'));
 assert(js.includes('No payment initiated'));
 assert(js.includes('No award granted'));
 assert.equal(html,read('browser_public/sbc-sales-command.html'));
 assert.equal(js,read('browser_public/sbc-sales-command-v1.js'));
 new (require('node:vm').Script)(js);
});

test('recorded employee awards use explicit owner approval and private self-only history',()=>{
 const read=p=>fs.readFileSync(path.join(root,p),'utf8');
 const owner=read('public/sbc-sales-command-v1.js'),employee=read('public/sbc-manager-sales-progress-v1.js');
 assert(owner.includes('OWNER_CONFIRMED_NONFINANCIAL_AWARD'));
 assert(owner.includes('/api/owner/sales-command/workforce/awards'));
 assert(employee.includes("fetch('/api/sbc/sales/workforce/awards/me'"));
 assert(!employee.includes('/api/owner/sales-command/workforce/awards'));
 assert(read('public/sbc-account-manager-v1.html').includes('id="sbcMyAwards"'));
 new (require('node:vm').Script)(owner);new (require('node:vm').Script)(employee);
});

test('earned senior review and Academy bridge are connected to owner and employee views',()=>{
 const read=p=>fs.readFileSync(path.join(root,p),'utf8'),html=read('public/sbc-sales-command.html'),js=read('public/sbc-sales-command-v1.js'),emp=read('public/sbc-manager-sales-progress-v1.js');
 assert(html.includes('id="promotionReview"'));assert(html.includes('id="promotionAgreement"'));
 assert(js.includes('/api/owner/sales-command/workforce/senior-review'));assert(js.includes('OWNER_APPROVED_EARNED_SENIOR'));
 assert(emp.includes("fetch('/api/sbc/sales/workforce/academy/me'"));assert(!emp.includes('/api/owner/sales-command/workforce/senior-review'));
 new (require('node:vm').Script)(js);new (require('node:vm').Script)(emp);
});

test('actual trial payroll preview uses owner-reviewed minutes and existing enrolled manager selector',()=>{
 const read=p=>fs.readFileSync(path.join(root,p),'utf8'),html=read('public/sbc-sales-command.html'),js=read('public/sbc-sales-command-v1.js');
 for(const id of ['trialPayrollForm','trialPayrollTraining','trialPayrollOther','trialPayrollHoursReviewed','trialPayrollRateReviewed'])assert(html.includes('id="'+id+'"'));
 assert(js.includes('/api/owner/sales-command/workforce/payroll-preview'));assert(js.includes('signedRateConfirmed:'));assert(js.includes('hoursReviewed:'));
 assert.equal(html,read('browser_public/sbc-sales-command.html'));assert.equal(js,read('browser_public/sbc-sales-command-v1.js'));new (require('node:vm').Script)(js);
});

test('base payroll approval and external payment recording require owner review and exact selected period',()=>{
 const read=p=>fs.readFileSync(path.join(root,p),'utf8'),html=read('public/sbc-sales-command.html'),js=read('public/sbc-sales-command-v1.js');
 for(const id of ['trialPayrollManager','basePayrollOtherReviewed','basePayrollLegacyChecked','basePayrollEvidence','basePayrollApprove','basePayrollRecords'])assert(html.includes('id="'+id+'"'));
 assert(js.includes('OWNER_APPROVED_STRAIGHT_TIME_BASE'));assert(js.includes('OWNER_RECORD_ALREADY_SENT_BASE_PAY'));assert(js.includes('PREVIEW_CHANGED'));assert(js.includes('No payment initiated.'));
 assert.equal(html,read('browser_public/sbc-sales-command.html'));assert.equal(js,read('browser_public/sbc-sales-command-v1.js'));new (require('node:vm').Script)(js);
});

test('new-hire economics uses V2 assumptions and defaults to two Standard managers',()=>{
 const read=p=>fs.readFileSync(path.join(root,p),'utf8');
 const html=read('public/sbc-sales-command.html'),js=read('public/sbc-sales-hiring-v1.js');
 assert.match(html,/id="forecastStandard"[^>]*value="2"/);
 assert.match(html,/id="forecastSenior"[^>]*value="0"/);
 assert(html.includes('9% / 12%'));assert(!html.includes('Legacy 10%/15% commission assumptions'));
 assert(js.includes('V2_PROPOSED_SIGNED_TERMS'));assert(!js.includes('Legacy commission assumptions only'));
 assert.equal(html,read('browser_public/sbc-sales-command.html'));assert.equal(js,read('browser_public/sbc-sales-hiring-v1.js'));
 new (require('node:vm').Script)(js);
});

test('workforce schema is checked even when commission schema is missing',async()=>{
 const js=fs.readFileSync(path.join(root,'public/sbc-sales-command-v1.js'),'utf8');
 const start=js.indexOf(' async function refresh(){'),end=js.indexOf(' const safeRun=',start);
 const block=js.slice(start,end);
 const state={month:{value:'2026-11'},workforceLaunchSchema:{},kpis:{replaceChildren(){}},managers:{replaceChildren(){}}};
 const calls=[];
 const refresh=new Function('$','api','setActionButtons','resetProfile','resetRecognition','notice','managers','candidates',block+';return refresh')(
  id=>state[id]||(state[id]={}),async path=>{calls.push(path);return path.endsWith('/workforce/readiness')?{schemaReady:false,writeReady:true,missingTables:['sbc_am_trial_member_v2']}:{ready:false,nextAction:'REVIEW_AND_APPLY_STAGING_MIGRATION',missingTables:['sbc_sales_credit_v1']};},()=>{},()=>{},()=>{},()=>{},[],[]);
 await assert.rejects(refresh(),/REVIEW_AND_APPLY_STAGING_MIGRATION/);
 assert(calls.includes('/api/owner/sales-command/workforce/readiness'));
 assert.match(state.workforceLaunchSchema.textContent,/sbc_am_trial_member_v2/);
});
