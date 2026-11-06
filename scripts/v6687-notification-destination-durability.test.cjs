'use strict';
// SBC V66.87 owner notification destination durability.
// Synthetic, local-only: NO real SMTP, Twilio, CRM, Square or network calls.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {SBCUnattendedNotifications}=require('../enterprise/sbc-unattended-notifications-v6504.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6687-notifications-'));
const durable=path.join(root,'shared','data');
const runtimeA=path.join(root,'runtime-a'),runtimeB=path.join(root,'runtime-b');
fs.mkdirSync(durable,{recursive:true});
for(const dir of [runtimeA,runtimeB]){
 fs.mkdirSync(dir,{recursive:true});
 fs.symlinkSync(durable,path.join(dir,'data'),'dir');
}
const env={
 SBC_SMTP_HOST:'smtp.example.test',SBC_SMTP_USER:'test@example.test',SBC_SMTP_PASS:'fictional-test-password',
 SBC_SMTP_PORT:'465',TWILIO_ACCOUNT_SID:'ACtest',TWILIO_AUTH_TOKEN:'fictional-test-token',
 TWILIO_PHONE_NUMBER:'+15555550123'
};
const mk=(runtime,settings=env)=>new SBCUnattendedNotifications({rootDir:runtime,env:settings,getDb:()=>({users:[]}),getRecoveryRequired:()=>false,logger:{warn(){},info(){}}});
try{
 const original=mk(runtimeA);
 let s=original.status();
 assert.equal(s.destinationStorage.emailSaved,false);
 assert.equal(s.destinationStorage.phoneSaved,false);
 assert.equal(s.channels.email.configured,false);
 assert.equal(s.channels.sms.configured,false);
 const email='owner@example.test',phone='+15555550199';
 const saved=original.updateDestinations({email,phone});
 assert.equal(saved.ok,true);
 assert.equal(saved.emailConfigured,true);
 assert.equal(saved.phoneConfigured,true);
 const file=path.join(durable,'sbc-notification-destinations.json');
 assert.ok(fs.existsSync(file),'destination data must be in release-independent persistent directory');
 assert.equal(fs.statSync(file).mode & 0o777,0o600,'saved destination permissions');
 assert.deepEqual(fs.readdirSync(durable).filter(n=>n.endsWith('.tmp')),[],'no uncommitted temp file remains');
 s=mk(runtimeB).status();
 assert.equal(s.destinationStorage.emailSaved,true,'new app instance retains email');
 assert.equal(s.destinationStorage.phoneSaved,true,'new app instance retains phone');
 assert.equal(s.channels.email.configured,true);
 assert.equal(s.channels.sms.configured,true);
 assert.ok(s.destinationStatus.email.includes('***'));
 assert.ok(s.destinationStatus.phone.includes('••••'));
 assert.ok(!JSON.stringify(s).includes(email),'status must not disclose raw recipient email');
 assert.ok(!JSON.stringify(s).includes(phone),'status must not disclose raw recipient mobile');
 const changed=mk(runtimeB);
 changed.updateDestinations({email:'new-owner@example.test',phone:''});
 assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).phone,phone,'blank second input must preserve existing phone');
 assert.equal(mk(runtimeA).status().destinationStorage.emailSaved,true);
 assert.throws(()=>changed.updateDestinations({email:'invalid address'}),/INVALID_OWNER_EMAIL/);
 assert.throws(()=>changed.updateDestinations({phone:'305-555-0199'}),/INVALID_OWNER_PHONE_E164/);
 assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).email,'new-owner@example.test','invalid input must not corrupt saved contacts');
 // A saved destination and a functioning transport are independent.
 const noProvider=mk(runtimeB,{});
 assert.equal(noProvider.status().destinationStorage.emailSaved,true);
 assert.equal(noProvider.status().channels.email.recipientConfigured,true);
 assert.equal(noProvider.status().channels.email.transportConfigured,false);
 assert.equal(noProvider.status().channels.email.configured,false);
 assert.equal(noProvider.status().channels.sms.recipientConfigured,true);
 assert.equal(noProvider.status().channels.sms.transportConfigured,false);
 const ui=fs.readFileSync(path.join(__dirname,'../public/sbc-unattended-notifications-v6504.js'),'utf8');
 const mirror=fs.readFileSync(path.join(__dirname,'../browser_public/sbc-unattended-notifications-v6504.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 const htmlMirror=fs.readFileSync(path.join(__dirname,'../browser_public/index.html'),'utf8');
 assert.equal(ui,mirror,'browser assets must be mirrored');
 assert.equal(html,htmlMirror,'browser HTML must be mirrored');
 new vm.Script(ui);
 assert.match(html,/sbc-unattended-notifications-v6504\.js\?v=66\.0\.87-durable-destinations/);
 assert.match(ui,/storage\.emailSaved/);
 assert.match(ui,/storage\.phoneSaved/);
 assert.match(ui,/Saved on server:/);
 assert.match(ui,/Leave blank to keep existing email/);
 assert.match(ui,/Leave blank to keep existing mobile/);
 assert.match(ui,/no need to enter them again after closing the browser/);
 assert.match(ui,/draftDestinations=\{email:el\.querySelector/,'preserve unsaved in-progress edits across refreshes');
 assert.match(ui,/draftDestinations=null;const confirmed=await loadStatus\(true\)/,'discard drafts after verified save and refresh');
 assert.match(ui,/Recipient .*?SMTP .*?not configured/,'show transport separately from saved contacts');
 assert.match(ui,/Recipient .*?Twilio .*?not configured/,'show transport separately from saved contacts');
 assert.doesNotMatch(ui,/localStorage\.setItem|sessionStorage\.setItem/,'contacts must not leak to browser storage');
 assert.doesNotMatch(ui,/api\/payments\/square|sendTest\('both'\)/,'no money or notification side effects');
 console.log('[SBC V66.87] PASS: persistent symlink survives new runtime, masked contacts, atomic readback, partial update, validation, provider readiness distinction, UI mirror/cache, no network');
}finally{fs.rmSync(root,{recursive:true,force:true});}
