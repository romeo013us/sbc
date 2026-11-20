'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const twilio=require('twilio');
const {runWithTenantContext}=require('../enterprise/tenant-context.cjs');
const {register}=require('../routes/sbc-call-command-live-v3.cjs');
const V3=require('../enterprise/sbc-call-command-live-v3.cjs');
const sid='AC'+'1'.repeat(32),keySid='SK'+'2'.repeat(32),appSid='AP'+'3'.repeat(32);
function goodZone(now=new Date()){
 for(const tz of ['America/New_York','America/Chicago','America/Los_Angeles','Pacific/Honolulu','Europe/London','Asia/Tokyo','Pacific/Auckland']){
  const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'2-digit',hourCycle:'h23'}).format(now));
  if(hour>=10&&hour<=17)return tz;
 }
 throw Error('No test timezone in permitted daytime window');
}
test('V3 account permission, one-use Twilio webhook, no client-number overrides and durable history',async()=>{
 const env=process.env,snapshot={};
 for(const name of ['SBC_CALL_COMMAND_V3_ENABLED','SBC_PUBLIC_URL','SBC_APP_URL','TWILIO_ACCOUNT_SID',
  'TWILIO_API_KEY_SID','TWILIO_API_KEY_SECRET','SBC_CALL_COMMAND_TWIML_APP_SID',
  'TWILIO_PHONE_NUMBER','TWILIO_AUTH_TOKEN'])snapshot[name]=env[name];
 Object.assign(env,{SBC_CALL_COMMAND_V3_ENABLED:'1',SBC_PUBLIC_URL:'https://sbc.test',
  SBC_APP_URL:'',TWILIO_ACCOUNT_SID:sid,TWILIO_API_KEY_SID:keySid,
  TWILIO_API_KEY_SECRET:['offline','synthetic','voice','secret'].join('-'),
  SBC_CALL_COMMAND_TWIML_APP_SID:appSid,TWILIO_PHONE_NUMBER:'+13055550199',
  TWILIO_AUTH_TOKEN:['synthetic','voice','webhook','test'].join('-')});
 let server;
 const customer={id:'cust-1',tenant_id:7,assigned_to:'m1',phone:'3055550147',status:'Lead',account_notes_json:null};
 const state={customers:[customer],events:[]};
 const users=[{id:'m1',role:'account_manager',active:true,tenantId:7}];
 const pool={async getConnection(){
  let snapshot=null;
  return {async beginTransaction(){snapshot=structuredClone(state)},
   async rollback(){if(snapshot){state.customers=snapshot.customers;state.events=snapshot.events;}},
   async commit(){snapshot=null},release(){},
   async query(sql,p){
    if(sql.startsWith('SELECT id,phone,status,assigned_to,account_notes_json,tenant_id FROM sbc_customers')){
     if(sql.includes('AND id<>?')){
      const digits=value=>String(value||'').replace(/\\D/g,'');
      return [[...state.customers.filter(x=>x.tenant_id===p[0]&&x.id!==p[1]&&
       [p[2],p[3]].includes(digits(x.phone)))],[]];
     }
     return [[...state.customers.filter(x=>x.tenant_id===p[0]&&x.id===p[1])],[]];
    }
    if(sql.startsWith('UPDATE sbc_customers SET account_notes_json=')){
     const row=state.customers.find(x=>x.tenant_id===p[2]&&x.id===p[3]);
     if(!row)return [{affectedRows:0},[]];row.account_notes_json=p[0];return [{affectedRows:1},[]];
    }
    if(sql.startsWith('INSERT INTO sbc_activities')){
     state.events.push({id:p[0],activity_type:p[1],message:p[2],meta_json:p[3],
      created_at:p[4],tenant_id:p[5]});return [{affectedRows:1},[]];
    }
    if(sql.startsWith('SELECT id,meta_json FROM sbc_activities')){
     return [state.events.filter(x=>x.tenant_id===p[0]&&x.activity_type===p[1]).map(x=>({id:x.id,meta_json:x.meta_json})),[]];
    }
    if(sql.startsWith('SELECT id,meta_json,tenant_id FROM sbc_activities WHERE id=')){
     return [state.events.filter(x=>x.id===p[0]&&x.activity_type===p[1]),[]];
    }
    if(sql.startsWith('SELECT id,meta_json,tenant_id FROM sbc_activities WHERE tenant_id=')){
     return [state.events.filter(x=>x.tenant_id===p[0]&&x.activity_type===p[1]),[]];
    }
    if(sql.startsWith('UPDATE sbc_activities SET meta_json=')){
     const row=state.events.find(x=>x.tenant_id===p[1]&&x.id===p[2]);
     if(!row)return [{affectedRows:0},[]];row.meta_json=p[0];return [{affectedRows:1},[]];
    }
    throw Error('Unexpected SQL: '+sql);
   }};
 }};
 const ctx={db:{users,customers:[]},mysqlPool:pool,recoveryRequired:()=>false};
 const app=express();app.use(express.urlencoded({extended:false}));app.use(express.json());
 app.use((req,res,next)=>{
  if(req.path.startsWith('/api/v6606/crm/call-command/'))return next();
  const who=req.get('x-person')||'manager';
  req.user=who==='owner'?{id:'owner',role:'owner',active:true,tenantId:7}:
   who==='outsider'?{id:'other',role:'account_manager',active:true,tenantId:7}:users[0];
  runWithTenantContext({tenantId:req.user.tenantId,actorId:req.user.id},()=>next());
 });
 const auth=(req,res,next)=>req.user?next():res.status(401).json({ok:false});
 register(app,{auth,getContext:()=>ctx});
 try{
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
  const origin='http://127.0.0.1:'+server.address().port;
  async function request(method,path,body,who='manager'){
   const r=await fetch(origin+path,{method,headers:{'Content-Type':'application/json','x-person':who},
    ...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};
  }
  const url='/api/v6606/crm/account-portfolios/cust-1';
  let ready=await request('GET',url+'/call-readiness');
  assert.equal(ready.status,200);assert.equal(ready.data.liveCallAvailable,false);
  const invalid=await request('POST',url+'/call-authorization',{evidence:'too short'},'owner');
  assert.equal(invalid.status,400);
  const approval={phoneVerified:true,dncChecked:true,callingAuthorized:true,
   consentOrLegalBasisVerified:true,policyReviewed:true,prospectTimeZone:goodZone(),
   evidence:'Owner reviewed company outreach permission and Do Not Call verification in the offline test fixture.'};
  assert.equal((await request('POST',url+'/call-authorization',approval)).status,403,'manager cannot attest');
  const saved=await request('POST',url+'/call-authorization',approval,'owner');
  assert.equal(saved.status,200);assert.equal(saved.data.durable,true);
  ready=await request('GET',url+'/call-readiness');
  assert.equal(ready.data.liveCallAvailable,true,JSON.stringify(ready.data));
  assert.equal((await request('GET',url+'/call-readiness',null,'outsider')).status,403);
  const requestId='a'.repeat(32);
  const prepared=await request('POST',url+'/call-start',{requestId});
  assert.equal(prepared.status,200,JSON.stringify(prepared.data));
  assert.equal(prepared.data.durable,true);assert.equal(prepared.data.manualOnly,true);
  const jwt=JSON.parse(Buffer.from(prepared.data.token.split('.')[1],'base64url').toString());
  assert.equal(jwt.grants.voice.outgoing.application_sid,appSid,'dedicated TwiML app only');
  assert.notEqual(jwt.grants.voice.incoming?.allow,true);
  const same=await request('POST',url+'/call-start',{requestId});
  assert.equal(same.status,200);assert.equal(same.data.attemptId,prepared.data.attemptId);
  assert.equal(same.data.duplicate,true);
  assert.equal((await request('POST',url+'/call-start',{requestId:'b'.repeat(32)})).status,409);
  const web='/api/v6606/crm/call-command/twiml';
  async function twilioPost(path,body,valid=true){
   const sig=twilio.getExpectedTwilioSignature(env.TWILIO_AUTH_TOKEN,'https://sbc.test'+path,body);
   const response=await fetch(origin+path,{method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':valid?sig:'invalid'},
    body:new URLSearchParams(body)});
   return {status:response.status,text:await response.text()};
  }
  const params={AttemptId:prepared.data.attemptId,From:'client:'+V3.identityFor(7,'m1'),
   AccountSid:sid,CallSid:'CA'+'4'.repeat(32),To:'+19998887777'};
  assert.equal((await twilioPost(web,params,false)).status,403);
  const connection=await twilioPost(web,params);
  assert.equal(connection.status,200,connection.text);
  assert(connection.text.includes('+13055550147'),'Dial must use authoritative CRM phone');
  assert(!connection.text.includes('+19998887777'),'browser-supplied To must be ignored');
  assert.equal((await twilioPost(web,params)).status,403,'attempt can only be spent once');
  const currentSession=state.events.find(e=>e.id===prepared.data.attemptId);
  const currentMeta=JSON.parse(currentSession.meta_json);
  currentMeta.expiresAt=new Date(Date.now()-5000).toISOString();
  currentSession.meta_json=JSON.stringify(currentMeta);
  assert.equal((await request('POST',url+'/call-start',{requestId:'c'.repeat(32)})).status,409,
   'an already-dialing live call must stay locked even when its preparation TTL expires');
  const cb='/api/v6606/crm/call-command/status?attempt='+prepared.data.attemptId;
  const completed=await twilioPost(cb,{AccountSid:sid,CallSid:'CA'+'5'.repeat(32),CallStatus:'completed'});
  assert.equal(completed.status,200,completed.text);
  const history=await request('GET',url+'/call-history');
  assert.equal(history.status,200);
  assert.equal(history.data.history[0].status,'COMPLETED');
  assert.equal(history.data.history[0].callSid,'CA'+'5'.repeat(32));
  env.SBC_CALL_COMMAND_V3_ENABLED='0';
  assert.equal((await twilioPost(cb,{AccountSid:sid,CallSid:'CA'+'5'.repeat(32),CallStatus:'completed'})).status,200,
   'signed provider completion remains recordable after an emergency disable');
  env.SBC_CALL_COMMAND_V3_ENABLED='1';
  assert.equal((await request('POST',url+'/call-revoke',{},'owner')).status,200);
  ready=await request('GET',url+'/call-readiness');
  assert.equal(ready.data.liveCallAvailable,false,'owner revocation blocks further calling');
  state.customers.push({id:'dnc-copy',tenant_id:7,phone:'(305) 555-0147',status:'DNC'});
  assert.equal((await request('POST',url+'/call-authorization',approval,'owner')).status,409,
   'another account with the same suppressed phone must block owner approval');
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve));
  for(const [k,v] of Object.entries(snapshot)){if(v===undefined)delete env[k];else env[k]=v}
 }
});
