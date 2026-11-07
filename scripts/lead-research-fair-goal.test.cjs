'use strict';
/* Regression proof: lead researcher submits research; Lead Assist verifies automatically.
 * The daily goal is intake work, not a fabricated "Verified" status.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const stage=require('./stage-lead-research-quality-goals-v3.cjs');
const before=read('server.js'),after=stage.patchSource(before);
assert.equal(stage.patchSource(after),after,'staged repair must be idempotent');
new vm.Script(after,{filename:'server.js'});
assert.match(after,/SBC_RESEARCH_AUTO_HANDOFF_V4/);
assert.match(after,/leadAssistQueue:Array\.isArray\(extra\.leadAssistQueue\)/,'queued work must survive MySQL reload');
assert.match(after,/leadAssistQueue:\(db\.leadAssistQueue\|\|\[\]\)\.slice\(0,5000\)/,'queue must persist in existing workspace snapshot');
assert.match(after,/c\.leadIntelligence\.autoVerificationStatus=c\.leadAssist\.status/,'machine outcome must persist with canonical customer');
assert.match(after,/c\.leadIntelligence\.verificationStatus=c\.verificationStatus/,'sales-verification decision must survive MySQL restart');
assert.match(after,/verificationStatus:\(\(\)=>\{try\{return safeJsonParse\(r\.lead_intelligence_json/,'relational hydration must restore verification decisions');
assert.match(after,/c\.leadIntelligence\.autoVerificationStatus=job\.status/,'failed jobs must persist failure state');
assert.match(after,/x\.status==='PROCESSING'&&Date\.now\(\)-Date\.parse/,'abandoned processing must be safely retried');
assert.match(after,/recover_research_auto_check/,'queued CRM leads must be rehydrated automatically after a restart');

const i=after.indexOf("app.get('/api/workforce/research-progress',auth,async(req,res)=>{");
const j=after.indexOf("app.get('/api/v9/lead-verification',auth,(req,res)=>{",i);
assert.ok(i>=0&&j>i,'secure research progress endpoint must exist');
const source=after.slice(i,j);
const start=after.indexOf("app.post('/api/workforce/leads',auth,async(req,res)=>{");
const end=after.indexOf('// V55.19 — persistent Lorna/lead-research workspace drafts and structured lead editing.',start);
const create=after.slice(start,end);
assert.match(create,/const researchComplete=Boolean\(business&&contactComplete&&researchSource\)/);
assert.match(create,/revenuePhoneShape\(phone\)\|\|revenueEmailShape\(email\)\|\|revenueWebsiteShape\(b\.website\)/);
assert.match(create,/c\.leadIntelligence\.researchStatus=researchComplete\?'RESEARCH_SUBMITTED':'NEEDS_RESEARCH'/);
assert.match(create,/researchComplete:researchComplete,researchSource:researchSource/);
assert.match(create,/enqueueLeadAssist\(c\.id,'lead_submission','high'\)/);
assert.match(create,/leadAssist:\{status:'QUEUED'/);
assert.doesNotMatch(create,/c\.verificationStatus='Verified'|b\.verifiedResearch/,'researchers cannot self-promote new leads to Verified');
const get=after.slice(after.indexOf("app.get('/api/v9/lead-verification',auth,"),after.indexOf("app.post('/api/v9/lead-verification/:id',auth,"));
assert.match(get,/leadAssistStatus:c\.leadAssist\?\.status/,'employee sees real machine verification state');
assert.match(get,/researchStatus:c\.leadIntelligence\?\.researchStatus/);
const review=after.slice(after.indexOf("app.post('/api/v9/lead-verification/:id',auth,"),after.indexOf("app.post('/api/v9/assign',auth,"));
assert.match(review,/\['Needs Verification','Owner Review'\]\.includes\(String\(req\.body\.verificationStatus\)\)/,'researcher cannot mark Verified');
assert.match(review,/enqueueLeadAssist\(c\.id,'researcher_corrected_exception','high'\)/,'manual exception corrections must trigger auto recheck');
assert.match(review,/if\(!researcher&&c\.verificationStatus==='Verified'/,'owner sales rules retained');
assert.match(source,/event_type='workforce_lead_created'/);
assert.match(source,/meta\?\.researchComplete===true/);
assert.match(source,/source:'research-intake-audit'/);
assert.match(source,/autoVerifiedTodayCount:autoVerifiedToday/);
assert.match(source,/needsReviewTodayCount:needsReviewToday/);
assert.match(source,/pendingAutoTodayCount:pendingToday/);
assert.match(source,/Number\(c\.tenantId\)===Number\(tenantId\)/);
assert.doesNotMatch(source,/db\.orders|db\.quotes|db\.users|credentials|payroll/i);
const now=new Date().toISOString();
const customers=[
 {id:'qualityA',tenantId:1,businessName:'North Barber',leadAssist:{status:'AUTO_VERIFIED'}},
 {id:'qualityB',tenantId:1,businessName:'West Boutique',leadAssist:{status:'NEEDS_HUMAN_REVIEW'}},
 {id:'pendingA',tenantId:1,businessName:'New Café',leadAssist:{status:'QUEUED'}},
 {id:'rawA',tenantId:1,businessName:'Unresearched List',leadAssist:{status:'QUEUED'}},
 {id:'foreign',tenantId:2,businessName:'Foreign Lead',leadAssist:{status:'AUTO_VERIFIED'}}
];
let seq=0;
const audit=(customerId,researchComplete,createdAt=now)=>({id:'event'+(++seq),meta_json:JSON.stringify({customerId,researchComplete}),created_at:createdAt});
const rows=[
 audit('qualityA',true),audit('qualityB',true),audit('pendingA',true),
 audit('rawA',false),audit('foreign',true),audit('qualityA',true)
];
let handler;
const context={
 require:spec=>{if(spec==='./enterprise/v66102-research-notice.cjs')return require('../enterprise/v66102-research-notice.cjs');throw Error('UNEXPECTED_VM_MODULE:'+spec);},
 app:{get(p,auth,fn){assert.equal(p,'/api/workforce/research-progress');handler=fn;},post(p){assert.equal(p,'/api/v9/lead-verification/:id/resolve-notice','Only the V66.102 notice route may be registered in this scoped VM fixture');}},
 auth:()=>{},db:{customers,auditLog:[]},
 mysqlPool:{async query(sql,args){assert.match(sql,/sbc_audit_log/);assert.deepEqual(Array.from(args),['lorna']);return [rows];}},
 MYSQL_RECOVERY_REQUIRED:false,
 sbcLornaRole:user=>user.role==='lead_researcher',
 requireRequestTenant:req=>req.tenantId,
 isSbcSyntheticTestRecord:()=>false,console
};
vm.runInNewContext(source,context,{filename:'research-intake-route.js'});
function response(){let status=200,value;return {setHeader(){},status(n){status=n;return this;},json(v){value=v;return this;},get statusCode(){return status;},get value(){return value;}};}
(async()=>{
 const denied=response();await handler({user:{id:'admin',role:'owner'},tenantId:1},denied);
 assert.equal(denied.statusCode,403,'research metrics stay researcher-only');
 const res=response();await handler({user:{id:'lorna',role:'lead_researcher'},tenantId:1},res);
 assert.equal(res.statusCode,200,JSON.stringify(res.value));
 assert.equal(res.value.todayCount,3,'three complete researched submissions; no double count');
 assert.equal(res.value.autoVerifiedTodayCount,1,'one independently auto-verified');
 assert.equal(res.value.needsReviewTodayCount,1,'one machine exception');
 assert.equal(res.value.pendingAutoTodayCount,1,'one machine check queued');
 assert.equal(res.value.rawSavedTodayCount,4,'raw uploads tracked but not credited as completed research');
 assert.equal(res.value.allTimeCount,3);
 assert.deepEqual(Array.from(res.value.submittedLeadIds).sort(),['pendingA','qualityA','qualityB','rawA']);
 assert.equal(res.value.source,'research-intake-audit');
 assert.equal(res.value.goalMin,16);assert.equal(res.value.goalMax,20);
 const html=read('public/lead-research.html'),ui=read('public/lead-research.js');
 new vm.Script(ui,{filename:'lead-research.js'});
 assert.match(html,/of 16 research-complete leads/);
 assert.ok(!html.includes('name="verifiedResearch"'),'remove blind self-verification checkbox');
 assert.match(html,/name="verificationSource"/);
 assert.match(html,/SBC Lead Assist automatically performs verification after saving/);
 assert.match(ui,/result\.source!=='research-intake-audit'/,'fail closed on stale server metrics');
 assert.match(ui,/autoVerifiedTodayCount/);
 assert.match(ui,/submittedIds\.has\(String\(c\.id\)\)/);
 assert.match(ui,/SBC Lead Assist will perform verification automatically/);
 assert.match(ui,/Only correct your own records/);
 assert.ok(!ui.includes("data.verifiedResearch"),'no self-verified claims');
 assert.ok(!ui.includes("data.verificationStatus=String(fd.get('verificationStatus')"),'no blind manual mark verified');
 assert.match(ui,/Finish with 16 complete, unique submissions/);
 assert.match(ui,/Complete a short Academy lesson|Finish a short Academy lesson/);
 console.log('[SBC RESEARCH AUTO HANDOFF] PASS: tenant isolation, 3 unique complete intakes, 1 auto verified, 1 exception, 1 queued, raw excluded, no employee self-verification, existing Academy retained.');
})().catch(e=>{console.error(e);process.exitCode=1;});
