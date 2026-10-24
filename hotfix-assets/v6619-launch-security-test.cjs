'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {acceptedOrigins,createSignedTwilioVoiceGuard}=require('../enterprise/v6619-signed-twilio-webhook');
const twilio=require('twilio');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
let checks=0;
function check(label,condition){assert.ok(condition,label);checks++}
function signature(token,url,params){
 const serialized=url+Object.keys(params).sort().map(key=>key+String(params[key])).join('');
 return crypto.createHmac('sha1',token).update(serialized,'utf8').digest('base64');
}
const token='test-auth-token-not-real',origins=['https://app.sbcmia.com','http://evil.example','https://app.sbcmia.com/path'];
const route='/api/voice/twiml',url='https://app.sbcmia.com'+route;
const body={To:'+13055550101',From:'client:agent1',CallSid:'CA00000000000000000000000000000001'};
const validSignature=signature(token,url,body);
check('Twilio SDK accepts independent signature',twilio.validateRequest(token,validSignature,url,body));
check('Origin allowlist strips paths and rejects HTTP',JSON.stringify(acceptedOrigins(origins))===JSON.stringify(['https://app.sbcmia.com']));
function exercise(overrides={}){
 let nextCalled=false,statusCode=200,response=null;
 const headers={'content-type':'application/x-www-form-urlencoded','x-twilio-signature':validSignature,...(overrides.headers||{})};
 const req={headers,originalUrl:overrides.path||route,body:overrides.body||body};
 const res={status(code){statusCode=code;return this},json(result){response=result;return this}};
 const guard=createSignedTwilioVoiceGuard({
  getToken:()=>overrides.token===undefined?token:overrides.token,
  getOrigins:()=>overrides.origins===undefined?origins:overrides.origins,
  validateRequest:twilio.validateRequest
 });
 guard(req,res,()=>{nextCalled=true});
 return {statusCode,response,nextCalled};
}
check('Valid real Twilio signature accepted',exercise().nextCalled);
check('Missing signature refused',exercise({headers:{'x-twilio-signature':''}}).statusCode===403);
check('Body tampering refused',exercise({body:{...body,To:'+19005550000'}}).statusCode===403);
check('Wrong callback URL refused',exercise({path:'/api/voice/twiml?bad=1'}).statusCode===403);
check('Off-route requests refused',exercise({path:'/api/admin'}).statusCode===403);
check('JSON callbacks refused',exercise({headers:{'content-type':'application/json'}}).statusCode===415);
check('Missing signing token blocks dial',exercise({token:''}).statusCode===503);
check('No trusted HTTPS origin blocks dial',exercise({origins:['http://localhost:3000']}).statusCode===503);
check('Malicious Host header cannot influence signature',exercise({headers:{host:'attacker.test'}}).nextCalled);
check('Authenticated callback has exactly one public route',server.includes("app.post('/api/voice/twiml',sbcSignedTwimlV6619,(req,res)=>{")&&!server.includes("app.post('/api/voice/twiml',(req,res)=>{"));
check('Signed callback has exact zero-trust allowance',server.includes("ZERO_TRUST_PUBLIC_API_ALLOWLIST=[/^\\/api\\/voice\\/twiml$/"));
check('Recovery and writer-lease safeguards still present',server.includes('MYSQL_RECOVERY_REQUIRED')&&server.includes('SBC_RUNTIME_WRITER_LEASE_REQUIRED'));
check('Owner diagnostic is behind ownerOnly and auth',server.includes("app.get('/api/owner/launch-gates',auth,ownerOnly,async(req,res)=>{"));
check('Readiness distinguishes observed write preconditions',server.includes('writePrerequisitesReported:Boolean('));
check('No automatic recovery unlock in launch patch',!server.includes('SBC_V6619_AUTO_RECOVERY_UNLOCK'));
console.log(JSON.stringify({status:'PASS_V6619_SIGNED_TWILIO_AND_OWNER_LAUNCH',checks,realTwilioSignatureLibrary:true,zeroTrustPublicExceptionSigned:true,liveProvidersTested:false,productionCertified:false}));
