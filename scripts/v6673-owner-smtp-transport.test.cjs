'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {SBCUnattendedNotifications}=require('../enterprise/sbc-unattended-notifications-v6504.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6673-mail-'));
const env={SBC_SMTP_HOST:'smtpout.secureserver.net',SBC_SMTP_USER:'info@sbcmia.com',SBC_SMTP_PASS:'SYNTHETIC_TEST_ONLY',SBC_SMTP_PORT:'465',SBC_SMTP_SECURE:'true',SBC_OWNER_EMAIL:'romeo013us@gmail.com'};
function fixture(send){const attempts=[];const notifier=new SBCUnattendedNotifications({env,getDb:()=>({users:[]}),rootDir:tmp,logger:{warn(){}},nodemailer:{createTransport(opts){attempts.push(opts);return {async sendMail(message){assert.equal(message.from,'info@sbcmia.com');assert.equal(message.to,'romeo013us@gmail.com');assert.equal(message.subject,'test');return send(opts,message)},close(){}}}}});return {notifier,attempts}}
(async()=>{
 try{
  const happy=fixture(async()=>({messageId:'synthetic-id',accepted:['romeo013us@gmail.com']}));
  const ok=await happy.notifier.sendEmail('test','body','<p>body</p>');
  assert.equal(ok.ok,true);assert.equal(happy.attempts.length,1);
  assert.equal(happy.attempts[0].port,465);assert.equal(happy.attempts[0].secure,true);
  assert.equal(happy.attempts[0].tls.minVersion,'TLSv1.2');
  const network=fixture(async opts=>{if(opts.port===465){const e=new Error('connection forbidden');e.code='EACCES';throw e}return {messageId:'accepted-over-587',accepted:['romeo013us@gmail.com']}});
  assert.equal((await network.notifier.sendEmail('test','body','')).ok,true);
  assert.deepEqual(network.attempts.map(x=>x.port),[465,587]);
  assert.equal(network.attempts[1].secure,false);assert.equal(network.attempts[1].requireTLS,true);
  assert.equal(network.notifier.status().lastResult.email.transportPort,587);
  const auth=fixture(async()=>{const e=new Error('bad auth');e.code='EAUTH';throw e});
  await assert.rejects(()=>auth.notifier.sendEmail('test','body',''),e=>e.code==='EAUTH');
  assert.deepEqual(auth.attempts.map(x=>x.port),[465]);
  assert.equal(auth.notifier.status().lastResult.email.code,'EAUTH');
  const rejected=fixture(async()=>({messageId:'unaccepted',accepted:[]}));
  await assert.rejects(()=>rejected.notifier.sendEmail('test','body',''),e=>e.code==='EENVELOPE');
  assert.equal(rejected.attempts.length,1);
  const changed={...env,SBC_SMTP_PORT:'587',SBC_SMTP_SECURE:'false'};
  const x=[];const direct=new SBCUnattendedNotifications({env:changed,rootDir:tmp,getDb:()=>({users:[]}),logger:{warn(){}},nodemailer:{createTransport(o){x.push(o);return {sendMail:async()=>({messageId:'587',accepted:['romeo013us@gmail.com']})}}}});
  assert.equal((await direct.sendEmail('test','body','')).ok,true);
  assert.deepEqual(x.map(o=>o.port),[587]);assert.equal(x[0].secure,false);assert.equal(x[0].requireTLS,true);
  const noTransport=new SBCUnattendedNotifications({env:{},rootDir:tmp,getDb:()=>({users:[]})});
  assert.equal((await noTransport.sendEmail('test','body','')).skipped,true);
  for(const t of [...happy.attempts,...network.attempts,...auth.attempts,...rejected.attempts,...x]){
   assert.equal(t.auth.user,'info@sbcmia.com');assert.equal(t.auth.pass,'SYNTHETIC_TEST_ONLY');assert.notEqual(t.port,25);
  }
  console.log('[SBC V6673] PASS: owner SMTP TLS, 465 to authenticated STARTTLS 587 on EACCES, auth fail-closed, unaccepted recipient fail-closed, no plaintext relay, no live mail');
 } finally {fs.rmSync(tmp,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
