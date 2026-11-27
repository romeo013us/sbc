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
