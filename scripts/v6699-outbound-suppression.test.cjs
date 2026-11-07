'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const AUTH=require('../enterprise/v6699-outbound-authorization.cjs');
const STAGE=require('./v6699-stage-outbound-suppression.cjs');
const src=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const caller={id:'sales1',role:'caller',active:true,tenantId:1};
const owner={id:'owner1',role:'owner',active:true,tenantId:1};
const other={id:'sales2',role:'caller',active:true,tenantId:2};
const leads=[
 {id:'a',tenantId:1,assignedTo:'sales1',phone:'3055550101',status:'Lead'},
 {id:'b',tenantId:1,assignedTo:'sales2',phone:'3055550102',status:'Lead'},
 {id:'c',tenantId:2,assignedTo:'sales1',phone:'3055550103',status:'Lead'},
 {id:'d',tenantId:1,assignedTo:'sales1',phone:'3055550104',status:'Do Not Call'}
];
const base={users:[owner,caller,other],customers:leads,canLiveCall:()=>true};
let cases=0;
function check(from,to,expected,override={}){
 const actual=AUTH.authorize({...base,from,to,...override});
 assert.equal(actual.code,expected);cases++;
}
check('client:owner1','3055550199','AUTHORIZED');
check('client:sales1','3055550101','AUTHORIZED');
check('client:sales1','3055550102','VOICE_LEAD_NOT_ASSIGNED');
check('client:sales1','3055550103','VOICE_LEAD_NOT_ASSIGNED');
check('client:sales1','3055550119','VOICE_LEAD_NOT_ASSIGNED');
check('client:sales1','3055550104','VOICE_DNC_BLOCKED');
check('client:owner1','3055550104','VOICE_DNC_BLOCKED');
check('client:missing','3055550101','VOICE_USER_NOT_ACTIVE');
check('', '3055550101','VOICE_IDENTITY_REQUIRED');
check('not-client','3055550101','VOICE_IDENTITY_REQUIRED');
check('client:sales1','123','INVALID_DESTINATION');
check('client:sales1','3055550101','VOICE_CERTIFICATION_REQUIRED',{canLiveCall:()=>false});
check('client:sales1','3055550101','VOICE_USER_NOT_ACTIVE',{users:[{...caller,active:false}]});
check('client:sales1','3055550101','VOICE_ACCOUNT_EXPIRED',{users:[{...caller,expiresAt:'2020-01-01T00:00:00Z'}]});
check('client:sales1','3055550101','VOICE_TENANT_REQUIRED',{users:[{...caller,tenantId:0}]});
check('client:owner1','+442071234567','AUTHORIZED');
assert.equal(AUTH.normPhone('(305) 555-0101'),'+13055550101');
const patched=STAGE.patchServer(src);
assert(patched.includes(STAGE.MARK));
assert.equal(STAGE.patchServer(patched),patched);
assert(patched.includes("c.doNotContact=true;c.salesSuppressed=true;c.status='Do Not Call'"));
assert(patched.includes("if(u.role==='caller')return String(c.assignedTo||'')===String(u.id)"));
const a=patched.indexOf("const SBC_V6699_OUTBOUND_AUTH=require("),b=patched.indexOf('// SBC_V6614_VOICE_CALL_LOG_INTEGRITY',a);
assert(a>0&&b>a);
let handler;
vm.runInNewContext(patched.slice(a,b),{
 require:()=>AUTH,app:{post(_p,_g,fn){handler=fn}},sbcSignedTwimlV6619(){},
 db:{users:base.users,customers:leads},v9CanLiveCall:()=>true,
 normalizeDialNumber:AUTH.normPhone,secretValue:()=>'+13055550999',
 xmlEsc:s=>s,console
});
function twiml(to,from){
 let status=200,body='';
 const response={status(n){status=n;return this},type(){return this},send(t){body=String(t);return this}};
 handler({body:{To:to,From:from}},response);
 return {status,body};
}
assert.equal(twiml('3055550101','client:sales1').status,200);
assert.equal(twiml('3055550104','client:sales1').status,403);
assert.equal(twiml('3055550102','client:sales1').status,403);
assert.equal(twiml('3055550199','client:owner1').status,200);
const p=patched.indexOf("app.post('/api/v9/call-report',auth,async(req,res)=>{");
const q=patched.indexOf("app.post('/api/v9/call-report/:id/approve'",p);
assert(p>0&&q>p);
let callReport,saves=0;
const lead={id:'a',assignedTo:'sales1',tenantId:1,status:'Lead',phone:'3055550101'};
vm.runInNewContext(patched.slice(p,q),{
 app:{post(_p,_auth,fn){callReport=fn}},auth(){},
 v9CustomerFor:()=>lead,requireRequestTenant:()=>1,
 db:{customers:[lead],callReports:[]},id:()=> 'report-1',
 now:()=>new Date().toISOString(),audit(){},async saveData(){saves++},
 console
});
(async()=>{
 let status=200;
 const response={status(n){status=n;return this},json(){return this}};
 await callReport({user:caller,body:{customerId:'a',outcome:'Do Not Call'}},response);
 assert.equal(status,201);assert.equal(lead.doNotContact,true);assert.equal(lead.salesSuppressed,true);
 assert.equal(lead.status,'Do Not Call');assert(saves>=1);
 assert.equal(AUTH.authorize({...base,customers:[lead],from:'client:sales1',to:'3055550101'}).code,'VOICE_DNC_BLOCKED');
 if(process.argv.includes('--staged'))assert.equal(patched,src);
 console.log('PASS V66.99 '+cases+' outbound cases; signed route, assigned scope, DNC persistence');
})().catch(e=>{console.error(e);process.exitCode=1});
