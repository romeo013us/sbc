'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6619_LAUNCH_GATE_SIGNED_VOICE';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' count='+n);return s.replace(a,b)}
function apply(root){
 const filename=path.join(root,'server.js');let s=fs.readFileSync(filename,'utf8');
 if(s.includes(MARKER))throw Error(MARKER+': already applied');
 const allow="const ZERO_TRUST_PUBLIC_API_ALLOWLIST=[";
 s=once(s,allow,allow+"/^\\/api\\/voice\\/twiml$/, ", 'allow signed voice callback through edge');
 const route="app.post('/api/voice/twiml',(req,res)=>{";
 const guard=[
  '// '+MARKER+': authenticate Twilio before returning any chargeable Dial.',
  "const {acceptedOrigins:createSbcTwilioOriginsV6619,createSignedTwilioVoiceGuard:createSbcSignedVoiceGuardV6619}=require('./enterprise/v6619-signed-twilio-webhook');",
  "const sbcTwilioWebhookTokenV6619=()=>secretValue('SBC_TWILIO_AUTH_TOKEN','TWILIO_AUTH_TOKEN')||secretValue('TWILIO_AUTH_TOKEN','SBC_TWILIO_AUTH_TOKEN');",
  'const sbcTwilioWebhookOriginsV6619=()=>[process.env.SBC_PUBLIC_URL,process.env.SBC_APP_URL];',
  "const sbcSignedTwimlV6619=createSbcSignedVoiceGuardV6619({getToken:sbcTwilioWebhookTokenV6619,getOrigins:sbcTwilioWebhookOriginsV6619,validateRequest:require('twilio').validateRequest});",
  "app.post('/api/voice/twiml',sbcSignedTwimlV6619,(req,res)=>{"
 ].join('\n');
 s=once(s,route,guard,'unsigned outbound dial endpoint');
 const status="  res.json({configured,mode:configured?'browser-softphone':'not-connected',provider:'Twilio Voice',businessNumber:";
 const statusNew="  res.json({webhookSignatureReady:Boolean(sbcTwilioWebhookTokenV6619()&&createSbcTwilioOriginsV6619(sbcTwilioWebhookOriginsV6619()).length),configured,mode:configured?'browser-softphone':'not-connected',provider:'Twilio Voice',businessNumber:";
 s=once(s,status,statusNew,'voice status signature readiness flag');
 const endpoint="app.get('/api/owner/recovery/status',auth,ownerOnly,async(req,res)=>{";
 const readOnly=[
 '// '+MARKER+': owner-only, zero-mutation launch-readiness observation.',
 "app.get('/api/owner/launch-gates',auth,ownerOnly,async(req,res)=>{",
 " res.setHeader('Cache-Control','no-store');",
 " const out={ok:true,version:BUILD_VERSION,checkedAt:now(),productionCertified:false,",
 " environment:{role:SBC_RUNTIME_READ_ONLY?'readonly':'writer',storage:storageMode},",
 " checks:{mysqlReachable:false,writerLeaseSessionVerified:false,recoveryEvaluated:Boolean(MYSQL_RECOVERY_EVALUATED),recoveryClear:!MYSQL_RECOVERY_REQUIRED,",
 " historicalCustomerFloorSatisfied:false,twilioCallbackSignatureConfigured:Boolean(sbcTwilioWebhookTokenV6619()&&createSbcTwilioOriginsV6619(sbcTwilioWebhookOriginsV6619()).length)},",
 " records:{customers:null,verifiedHistoricalFloor:VERIFIED_PRE_CORRUPTION_CRM_COUNT},",
 " outstandingManualVerification:['authenticated CRM create/edit/readback','real Twilio call and correct CRM logging','Square test payment/webhook reconciliation','backup restore and rollback drill']};",
 " const bounded=async(promise)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('READ_ONLY_GATE_TIMEOUT')),3000)})])}finally{clearTimeout(timer)}};",
 " try{if(mysqlPool){await bounded(mysqlPool.query('SELECT 1'));out.checks.mysqlReachable=true;",
 " const [[c]]=await bounded(mysqlPool.query('SELECT COUNT(*) AS count FROM sbc_customers'));",
 " out.records.customers=Number(c?.count||0);",
 " out.checks.historicalCustomerFloorSatisfied=out.records.customers>=VERIFIED_PRE_CORRUPTION_CRM_COUNT;}}",
 " catch(e){out.errors={mysql:String(e?.code||e?.message||'unavailable').slice(0,80)}}",
 " try{if(!SBC_RUNTIME_READ_ONLY&&sbcWriterLeaseReady&&sbcWriterLeaseConn&&Number.isFinite(sbcWriterLeaseConnectionId)){",
 " const [[lease]]=await bounded(sbcWriterLeaseConn.query('SELECT CONNECTION_ID() AS sessionId,IS_USED_LOCK(?) AS owner',[SBC_RUNTIME_WRITER_LOCK_NAME]));",
 " out.checks.writerLeaseSessionVerified=Number(lease?.sessionId)===sbcWriterLeaseConnectionId&&Number(lease?.owner)===sbcWriterLeaseConnectionId;}}",
 " catch(e){out.errors={...(out.errors||{}),lease:String(e?.code||e?.message||'unavailable').slice(0,80)}}",
 " out.coreWritePrerequisitesVerified=!SBC_RUNTIME_READ_ONLY&&out.checks.mysqlReachable&&out.checks.writerLeaseSessionVerified&&out.checks.recoveryEvaluated&&out.checks.recoveryClear&&out.checks.historicalCustomerFloorSatisfied;",
 " out.message=out.coreWritePrerequisitesVerified?'Core write prerequisites observed; CRM save, payments, and calling are NOT independently verified.':'Core write prerequisites not met; do not unlock recovery or run write tests.';",
 " res.json(out);",
 "});",
 ].join('\n')+'\n';
 const voicePreflight=[
  '// SBC_V6664_VOICE_OWNER_PREFLIGHT: read-only and owner-authenticated; no Twilio calls or tokens generated.',
  "const SBC_V6664_VOICE_PREFLIGHT=require('./enterprise/v6664-voice-preflight.cjs');",
  "app.get('/api/owner/voice-preflight',auth,ownerOnly,(req,res)=>{",
  " res.setHeader('Cache-Control','no-store');",
  " res.setHeader('Referrer-Policy','no-referrer');",
  " try{return res.json(SBC_V6664_VOICE_PREFLIGHT.inspect({env:process.env,signatureTokenPresent:Boolean(sbcTwilioWebhookTokenV6619())}));}",
  " catch(_){return res.status(503).json({ok:false,code:'VOICE_PREFLIGHT_UNAVAILABLE'});}",
  '});'
 ].join('\n')+'\n';
 s=once(s,endpoint,voicePreflight+readOnly+endpoint,'owner voice preflight and launch gates');
 const readyAnchor="recoveryRequired:Boolean(MYSQL_RECOVERY_REQUIRED),writeProtection:Boolean(MYSQL_RECOVERY_REQUIRED)";
 s=once(s,readyAnchor,readyAnchor+",writePrerequisitesReported:Boolean(!SBC_RUNTIME_READ_ONLY&&sbcWriterLeaseReady&&MYSQL_RECOVERY_EVALUATED&&!MYSQL_RECOVERY_REQUIRED&&mysqlOk)",'clear write vs read-only status');
 if(!s.includes(MARKER)||!s.includes("app.post('/api/voice/twiml',sbcSignedTwimlV6619"))throw Error(MARKER+': patch verification failed');
 fs.writeFileSync(filename,s);
 const source=path.join(__dirname,'v6619-signed-twilio-voice-webhook.js');
 const target=path.join(root,'enterprise','v6619-signed-twilio-webhook.js');
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);
 const voiceSource=path.join(__dirname,'../enterprise/v6664-voice-preflight.cjs');
 if(!fs.existsSync(voiceSource))throw Error(MARKER+': V66.64 voice preflight helper missing');
 fs.copyFileSync(voiceSource,path.join(root,'enterprise','v6664-voice-preflight.cjs'));
 const test=path.join(__dirname,'v6619-launch-security-test.cjs');
 if(!fs.existsSync(test))throw Error(MARKER+': regression test missing');
 fs.mkdirSync(path.join(root,'scripts'),{recursive:true});fs.copyFileSync(test,path.join(root,'scripts','v6619-launch-security-test.cjs'));
 return {marker:MARKER,changed:true,twilioSignatureRequired:true,zeroTrustSignedCallbackOnly:true,ownerReadOnlyLaunchGate:true,recoveryAndWriterProtectionsPreserved:true};
}
module.exports={apply,MARKER};
