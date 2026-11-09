'use strict';
const assert=require('node:assert/strict');
const MAIL=require('../enterprise/sbc-consented-outreach-email.cjs');
const ROUTES=require('../routes/sbc-nextday-email-actions.cjs');
const NEXT=require('../routes/sbc-nextday-outbound-v1.cjs');
const env={SBC_MARKETING_EMAIL_ENABLED:'true',SENDGRID_API_KEY:'SG.mock.provider.token.for.tests.only',
 SBC_MARKETING_SENDER_VERIFIED:'true',SBC_SENDGRID_UNSUBSCRIBE_GROUP_ID:'24',
 SBC_MARKETING_POSTAL_ADDRESS:'13995 NW 7th Ave, North Miami, FL 33168',
 SBC_MARKETING_PRIVACY_URL:'https://sbcmia.com/privacy'};
const c={id:'lead1',tenantId:1,businessName:'SBC Test Demo Repair',phone:'3055550108',
 status:'Lead',leadTemperature:'Warm',verificationStatus:'Verified',industry:'Auto Repair',
 email:'opted@example.org',marketingEmailConsent:false,marketingEmailConsentSource:'',
 marketingEmailConsentAt:''};
function mock(){
 const db={customers:[c],tasks:[{id:'task1',customerId:c.id,customerName:c.businessName,
  tenantId:1,type:'SBC Next-Day Call',status:'Open',notes:'EMAIL NOT SENT. OWNER REVIEW REQUIRED.\nDRAFT EMAIL (NOT SENT):'}],appointments:[],users:[],callReports:[]};
 const routes=new Map();let mails=0,saveCount=0;
 const mail={envStatus:()=>({...MAIL.envStatus(env),ready:true}),
  hasConsent:MAIL.hasConsent,submit:async(person,draft)=>{mails++;assert.equal(person.id,c.id);
   assert.match(draft.subject,/SBC Test Demo Repair/);
   return {status:'PROVIDER_ACCEPTED_NOT_DELIVERED',providerMessageId:'mock-provider-id'};
  }};
 ROUTES.register({get(p,...f){routes.set('GET '+p,f)},post(p,...f){routes.set('POST '+p,f)}},{
  auth:(req,res,next)=>next(),ownerOnly:(req,res,next)=>next(),
  getDb:()=>db,saveData:async()=>{saveCount++},requireTenant:req=>req.tenantId,
  requireWriter:()=>{},makeId:()=> 'mocktask_'+Date.now(),now:()=>new Date().toISOString(),
  mail});
 const invoke=async(method,path,params={},body={})=>{
  const h=routes.get(method+' '+path);assert.ok(h,'route '+method+' '+path);
  const res={code:200,body:null,status(n){this.code=n;return this},
   json(x){this.body=x;return this},setHeader(){}};
  await h[h.length-1]({params,body,tenantId:1,user:{id:'owner',role:'owner'}},res);return res;
 };
 return {db,invoke,mails:()=>mails,saveCount:()=>saveCount};
}
(async()=>{
 assert.equal(MAIL.envStatus().ready,false,'outbound disabled unless intentionally configured');
 assert.equal(MAIL.envStatus(env).ready,true);
 assert.equal(MAIL.hasConsent(c),false);
 assert.throws(()=>MAIL.prepared(c,NEXT.intro(c),env),/EMAIL_OPT_IN_EVIDENCE_REQUIRED/);
 const m=mock();
 let x=await m.invoke('POST','/api/owner/nextday/send/:taskId',{taskId:'task1'},
  {confirm:'OWNER_APPROVES_CONSENTED_EMAIL'});
 assert.equal(x.code,422,'unconsented email denied');
 assert.equal(m.mails(),0,'no provider contact');
 x=await m.invoke('POST','/api/owner/nextday/consent/:customerId',{customerId:c.id},{
  source:'Public Google Maps scraped contact',method:'signup_form',
  obtainedAt:new Date().toISOString(),confirm:'OWNER_HAS_DIRECT_OPT_IN_PROOF'});
 assert.equal(x.code,422,'scraped source is not consent');
 x=await m.invoke('POST','/api/owner/nextday/consent/:customerId',{customerId:c.id},{
  source:'SBC website signup form submitted by the customer',method:'signup_form',
  obtainedAt:new Date().toISOString(),confirm:'OWNER_HAS_DIRECT_OPT_IN_PROOF'});
 assert.equal(x.body.ok,true);
 assert.equal(MAIL.hasConsent(c),true);
 const payload=MAIL.prepared(c,NEXT.intro(c),env);
 assert.match(payload.text,/13995 NW 7th Ave/);
 assert.match(payload.html,/asm_group_unsubscribe_raw_url/);
 assert.equal(payload.from.email,'info@sbcmia.com');
 let captured;
 const provider=await MAIL.submit(c,NEXT.intro(c),{env,transport:async(url,opts)=>{
  captured={url,opts};return {status:202,headers:{get:()=> 'test-msg-3'}};
 }});
 assert.equal(provider.status,'PROVIDER_ACCEPTED_NOT_DELIVERED');
 assert.match(captured.url,/^https:\/\/api\.sendgrid\.com\/v3\/mail\/send$/);
 const sent=JSON.parse(captured.opts.body);
 assert.equal(sent.asm.group_id,24);
 assert.equal(sent.personalizations[0].to[0].email,c.email);
 assert.equal(sent.tracking_settings.open_tracking.enable,false);
 assert.equal(sent.content.length,2);
 x=await m.invoke('POST','/api/owner/nextday/send/:taskId',{taskId:'task1'},
  {confirm:'OWNER_APPROVES_CONSENTED_EMAIL'});
 assert.equal(x.body.ok,true);
 assert.equal(m.mails(),1);
 assert.equal(x.body.delivered,false,'provider accept is not delivery');
 assert.equal(m.db.tasks[0].outboundEmailStatus,'PROVIDER_ACCEPTED_NOT_DELIVERED');
 x=await m.invoke('POST','/api/owner/nextday/send/:taskId',{taskId:'task1'},
  {confirm:'OWNER_APPROVES_CONSENTED_EMAIL'});
 assert.equal(x.code,409,'duplicates fail closed');
 assert.equal(m.mails(),1);
 x=await m.invoke('POST','/api/owner/nextday/reply/:taskId',{taskId:'task1'},
  {kind:'APPOINTMENT_REQUEST',notes:'Customer requested a discussion',confirm:'OWNER_VERIFIED_REAL_REPLY'});
 assert.equal(x.body.ok,true);
 assert.ok(m.db.tasks.some(t=>t.type==='SBC Appointment Request'));
 x=await m.invoke('POST','/api/owner/nextday/reply/:taskId',{taskId:'task1'},
  {kind:'UNSUBSCRIBE',notes:'Customer asked to stop',confirm:'OWNER_VERIFIED_REAL_REPLY'});
 assert.equal(x.body.ok,true);
 assert.equal(c.emailUnsubscribed,true);
 assert.equal(MAIL.hasConsent(c),false);
 assert.ok(m.saveCount()>3);
 console.log('PASS SBC consented email: evidence gate, provider no-send default, compliant footer, 202 not delivery, no duplicate, reply/appointment and opt-out');
})().catch(e=>{console.error(e);process.exitCode=1});
