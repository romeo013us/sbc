'use strict';
const fs=require('fs');const path=require('path');const assert=require('assert');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const ui=fs.readFileSync(path.join(root,'public/sbc-unattended-notifications-v6504.js'),'utf8');
const master=fs.readFileSync(path.join(root,'public/sbc-master-control-theme-v56-25-3.js'),'utf8');
const service=fs.readFileSync(path.join(root,'enterprise/sbc-unattended-notifications-v6504.cjs'),'utf8');
const checks={
  owner_notifications_nav:html.includes('data-view="notifications"')&&app.includes('notifications:()=>'),
  form_keeps_session_draft:ui.includes('draftDestinations={email,phone}')&&!ui.includes("document.querySelector('#sunOwnerEmail').value='';"),
  saved_destinations_masked:service.includes('destinationStatus: { email: c.email ? maskEmail(c.email)')&&service.includes('function maskPhone(value)'),
  read_only_recovery_check:ui.includes("api('/api/owner/recovery/status')")&&ui.includes('No data changed.'),
  recovery_lock_explicit:master.includes("recovery?'RECOVERY LOCK'")&&master.includes('authoritativeRecoveryRequired'),
  master_switch_fails_closed:master.includes("setMasterUI(false,true)")&&master.includes('Automation stays OFF'),
  release_identity_v6508:require(path.join(root,'config/release-identity.js')).RELEASE_VERSION==='65.1.26'
};
for(const [k,v] of Object.entries(checks)){console.log(`${v?'PASS':'FAIL'} ${k}`);assert(v,`check failed: ${k}`)}
console.log(`V65.1.26 inherited notification UI test: ${Object.keys(checks).length}/${Object.keys(checks).length} passed`);
