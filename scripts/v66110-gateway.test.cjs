'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const gateway=require('../enterprise/sbc-hosting-email-gateway.cjs');
const expected='http://127.0.0.1:2525/api/email/send';
(async()=>{
 let calls=0;
 const good=await gateway.sendEmail({to:'owner@example.org',subject:'SBC test',text:'fixture'},{
   fetch:async(url,options)=>{
     calls++;
     assert.equal(url,expected);
     assert.equal(options.method,'POST');
     assert.ok(options.signal);
     const body=JSON.parse(options.body);
     assert.equal(body.from,undefined);
     assert.deepEqual(body.to,['owner@example.org']);
     assert.equal(body.subject,'SBC test');
     assert.equal(body.text,'fixture');
     return {ok:true,status:200,json:async()=>({success:true,messageId:'synthetic-gateway-id'})};
   }
 });
 assert.equal(good.messageId,'synthetic-gateway-id');
 assert.equal(calls,1);
 await assert.rejects(()=>gateway.sendEmail({to:'not-email',subject:'t',text:'x'},{
   fetch:()=>{throw Error('MUST_NOT_FETCH')}
 }),{code:'EMAIL_RECIPIENT_INVALID'});
 await assert.rejects(()=>gateway.sendEmail({to:'owner@example.org',subject:'t',text:'x'},{
   fetch:async()=>({ok:false,status:503,json:async()=>({success:false,error:'internal fail'})})
 }),{code:'EMAIL_GATEWAY_DELIVERY_FAILED'});
 await assert.rejects(()=>gateway.sendEmail({to:'owner@example.org',subject:'t',text:'x'},{
   fetch:async()=>{throw Error('connection refused')}
 }),{code:'EMAIL_GATEWAY_UNREACHABLE'});
 await assert.rejects(()=>gateway.sendEmail({to:'owner@example.org',subject:'t'},{
   fetch:()=>{throw Error('MUST_NOT_FETCH')}
 }),{code:'EMAIL_BODY_REQUIRED'});
 if(process.argv.includes('--staged')){
   const root=path.resolve(__dirname,'..');
   const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
   const auto=fs.readFileSync(path.join(root,'enterprise/v56150-revenue-autopilot.js'),'utf8');
   const notif=fs.readFileSync(path.join(root,'enterprise/sbc-unattended-notifications-v6504.cjs'),'utf8');
   assert.match(server,/SBC_V66110_DDL_FREE_DROPZONE_ONLY_LAUNCH/);
   assert.match(server,/kind:'platform-gateway'/);
   assert.match(notif,/SBC_V66110_PLATFORM_GATEWAY_OWNER_NOTIFICATIONS/);
   assert.match(auto,/if\(!dropzoneOnly\)runOnce\(\)/);
 }
 console.log('[SBC V66.110] PASS: gateway scoped to loopback, sender omitted, failures fail closed'+(process.argv.includes('--staged')?', staged modes verified':''));
})().catch(e=>{console.error(e);process.exitCode=1});
