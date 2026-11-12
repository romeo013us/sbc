'use strict';
// Owner SMS diagnostic regression. Entirely synthetic: no Twilio/network/customer contact.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {SBCUnattendedNotifications}=require('../enterprise/sbc-unattended-notifications-v6504.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-sms-truth-'));
const env={TWILIO_ACCOUNT_SID:'ACsynthetic',TWILIO_AUTH_TOKEN:'do-not-print-secret',TWILIO_PHONE_NUMBER:'+15555550123',SBC_OWNER_PHONE:'+15555550124'};
function make(create){
 const sent=[];
 const instance=new SBCUnattendedNotifications({env,rootDir:dir,getDb:()=>({users:[]}),getRecoveryRequired:()=>false,logger:{warn(){}},twilioFactory:()=>({messages:{async create(req){sent.push(req);return create(req)}}})});
 return {instance,sent};
}
(async()=>{
 try{
  // Queued means accepted for processing, never phone delivered.
  const queued=make(async()=>({sid:'SMqueue01',status:'queued'}));
  const accepted=await queued.instance.sendSms('SBC SMS owner test');
  assert.equal(accepted.ok,true);
  assert.equal(accepted.providerAccepted,true);
  assert.equal(accepted.deliveryConfirmed,false);
  assert.equal(accepted.status,'queued');
  assert.equal(queued.instance.status().lastResult.sms.deliveryConfirmed,false);
  assert.equal(queued.sent.length,1);

  // The raw Twilio response can already report failure: do not claim success.
  const blocked=make(async()=>({sid:'SMblocked01',status:'failed',errorCode:30034}));
  const denied=await blocked.instance.sendSms('SBC SMS owner test');
  assert.equal(denied.ok,false);
  assert.equal(denied.reason,'TWILIO_30034');
  assert.equal(denied.errorCode,30034);
  assert.equal(blocked.instance.status().lastResult.sms.ok,false);
  assert.equal(blocked.instance.status().lastResult.sms.errorCode,30034);

  // SDK rejects with A2P code: preserve a safe code, never leak error text or credentials.
  const thrown=make(async()=>{const e=new Error('Sensitive request to +15555550124 with token do-not-print-secret');e.code=30034;throw e;});
  const failed=await thrown.instance.sendSms('SBC SMS owner test');
  assert.equal(failed.ok,false);
  assert.equal(failed.reason,'TWILIO_30034');
  assert.equal(failed.errorCode,30034);
  assert(!JSON.stringify(failed).includes('do-not-print-secret'));
  assert(!JSON.stringify(thrown.instance.status()).includes('do-not-print-secret'));
  assert(!JSON.stringify(failed).includes('+15555550124'));

  const rejected=make(async()=>({sid:'SMundelivered01',status:'undelivered',errorCode:30007}));
  assert.equal((await rejected.instance.sendSms('SBC SMS owner test')).ok,false);
  const delivered=make(async()=>({sid:'SMdelivered01',status:'delivered'}));
  assert.equal((await delivered.instance.sendSms('SBC SMS owner test')).deliveryConfirmed,true);

  const ui=fs.readFileSync(path.join(__dirname,'../public/sbc-unattended-notifications-v6504.js'),'utf8');
  assert.equal(ui,fs.readFileSync(path.join(__dirname,'../browser_public/sbc-unattended-notifications-v6504.js'),'utf8'));
  assert.match(ui,/deliveryConfirmed/,'UI must distinguish provider acceptance and actual delivery');
  assert.match(ui,/SMS test result/,'UI should preserve an actionable SMS outcome after status refresh');
  console.log('PASS owner SMS Twilio outcome truth, A2P reason, redaction, UI outcome and mirror; no real SMS');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
