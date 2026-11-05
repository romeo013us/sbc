'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const stage=require('./stage-lead-research-quality-goals-v3.cjs');
const before=read('server.js'),after=stage.patchSource(before);
assert.equal(stage.patchSource(after),after,'research goal staging must be idempotent');
new vm.Script(after,{filename:'server.js'});
assert.match(after,/SBC_RESEARCH_QUALITY_GOAL_V3/);
const i=after.indexOf("app.get('/api/workforce/research-progress',auth,async(req,res)=>{");
const j=after.indexOf("app.get('/api/v9/lead-verification',auth,(req,res)=>{",i);
assert.ok(i>0&&j>i);
const source=after.slice(i,j);
const update=after.slice(after.indexOf("app.post('/api/v9/lead-verification/:id'"),after.indexOf("app.post('/api/v9/assign'"));
assert.match(update,/priorVerificationStatus=String\(c\.verificationStatus/);
assert.match(update,/String\(b\.verificationStatus\|\|''\)==='Verified'/);
assert.match(update,/!business\|\|!contact\|\|!evidence/);
assert.match(update,/res\.status\(422\)/);
assert.ok(update.indexOf('if(!business||!contact||!evidence)')<update.indexOf("for(const k of ['businessName'"),'verification evidence check must happen before any mutation');
assert.match(update,/researchVerified:Boolean\(researcher&&c\.verificationStatus==='Verified'/);
assert.match(update,/!\\['Verified','Sales Ready'\\]\.includes\(priorVerificationStatus\)/);
assert.match(source,/event_type IN \('workforce_lead_created','lead_verification_update'\)/);
assert.match(source,/qualified\.has\(customerId\)/);
assert.match(source,/qualified\.set\(customerId/);
assert.match(source,/verifiedTodayCount:current\.length/);
assert.match(source,/source:'qualified-crm-audit'/);
assert.match(source,/newVerifiedToday,existingVerifiedToday/);
assert.match(source,/submittedLeadIds:saved\.map/);
const today=new Date().toISOString();
const customers=[
 {id:'new1',tenantId:1,businessName:'A Verified Shop',verificationStatus:'Verified'},
 {id:'old1',tenantId:1,businessName:'B Previously Queued',verificationStatus:'Verified'},
 {id:'raw1',tenantId:1,businessName:'C Unverified Import',verificationStatus:'Needs Verification'},
 {id:'foreign',tenantId:2,businessName:'Other Tenant',verificationStatus:'Verified'}
];
let seq=0;
const audit=(type,customerId,meta={})=>({id:'a'+(++seq),event_type:type,meta_json:JSON.stringify({customerId,...meta}),created_at:today});
const rows=[
 audit('workforce_lead_created','new1'),
 audit('workforce_lead_created','raw1'),
 audit('lead_verification_update','new1',{researchVerified:true,verificationStatus:'Verified'}),
 audit('lead_verification_update','old1',{researchVerified:true,verificationStatus:'Verified'}),
 audit('lead_verification_update','old1',{researchVerified:true,verificationStatus:'Verified'}), // no double count
 audit('lead_verification_update','raw1',{researchVerified:false,verificationStatus:'Needs Verification'}),
 audit('lead_verification_update','foreign',{researchVerified:true,verificationStatus:'Verified'})
];
let handler=null;
const context={
 app:{get(p,auth,fn){assert.equal(p,'/api/workforce/research-progress');handler=fn;}},
 auth:()=>{},db:{customers,auditLog:[]},
 mysqlPool:{async query(sql,args){assert.match(sql,/FROM sbc_audit_log/);assert.deepEqual(Array.from(args),['lorna1']);return [rows];}},
 MYSQL_RECOVERY_REQUIRED:false,
 sbcLornaRole:user=>user.role==='lead_researcher',
 requireRequestTenant:req=>req.tenantId,
 isSbcSyntheticTestRecord:()=>false,
 console
};
vm.runInNewContext(source,context,{filename:'research-progress-route.js'});
assert.equal(typeof handler,'function');
function response(){let code=200,value=null;return {setHeader(){},status(n){code=n;return this;},json(v){value=v;return this;},get code(){return code;},get value(){return value;}};}
(async()=>{
 const denied=response();
 await handler({user:{id:'someone',role:'caller'},tenantId:1},denied);
 assert.equal(denied.code,403,'only researcher role may view metrics');
 const res=response();
 await handler({user:{id:'lorna1',role:'lead_researcher'},tenantId:1},res);
 assert.equal(res.code,200);
 assert.equal(res.value.ok,true,JSON.stringify(res.value));
 assert.equal(res.value.todayCount,2,'one new verified + one existing verified');
 assert.equal(res.value.newVerifiedToday,1);
 assert.equal(res.value.existingVerifiedToday,1);
 assert.equal(res.value.verifiedTodayCount,2);
 assert.equal(res.value.rawSavedTodayCount,2,'raw import saved count remains distinct from qualified goal');
 assert.equal(res.value.allTimeCount,2,'same lead not counted twice');
 assert.equal(res.value.rawSavedAllTimeCount,2);
 assert.deepEqual(Array.from(res.value.submittedLeadIds).sort(),['new1','raw1']);
 assert.equal(res.value.goalMin,16);
 assert.equal(res.value.goalMax,20);
 assert.equal(res.value.source,'qualified-crm-audit');
 const html=read('public/lead-research.html'),js=read('public/lead-research.js');
 assert.match(html,/of 16 verified leads/);
 assert.match(html,/id="goal-existing"/);
 assert.match(js,/existingVerifiedToday/);
 assert.match(js,/newVerifiedToday/);
 assert.match(js,/flexible mix, not a second quota/);
 assert.match(js,/Training does not count against/);
 assert.match(js,/Promise\.allSettled\(\[loadLeads\(\),loadProgress\(\)\]\)/);
 console.log('[SBC FAIR RESEARCH GOAL] PASS: 2 unique verifications counted from 7 events, 2 raw saved separate, duplicates/other tenant excluded; min 16 stretch 20; training and cleanup not extra quotas.');
})().catch(e=>{console.error(e);process.exitCode=1;});
