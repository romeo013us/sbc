'use strict';
/* Deterministic owner employee audit and UI parity checks, no provider/DB I/O. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const C=require('../enterprise/v66128-owner-while-away.cjs');
const stage=require('./v66128-stage-while-away.cjs');
const iso=v=>new Date(v).toISOString();
const NOW=Date.parse('2026-11-09T02:00:00.000Z');
const privateTestValue=['synthetic','private','payload','marker'].join('-');
const users=[
 {id:'lorna',tenantId:1,name:'Lorna',role:'lead_researcher'},
 {id:'test1',tenantId:1,name:'Test1',role:'caller'},
 {id:'foreign',tenantId:2,name:'Other employee',role:'caller'},
 {id:'owner',tenantId:1,name:'Owner',role:'owner'}
];
const e=(id,user,type,when,meta={})=>({id,user_id:user,event_type:type,created_at:when,meta_json:JSON.stringify(meta)});
const events=[
 e('a1','lorna','workforce_lead_created',iso(NOW-600000),{customerId:'lead-a',researchComplete:true}),
 e('a1','lorna','workforce_lead_created',iso(NOW-600000),{customerId:'lead-a',researchComplete:true}),
 e('a2','lorna','workforce_lead_created',iso(NOW-500000),{customerId:'lead-b',researchComplete:false}),
 e('a3','lorna','workforce_lead_created',iso(NOW-400000),{customerId:'deleted-lead',researchComplete:true}),
 e('a4','lorna','training_progress_v2',iso(NOW-300000),{password:privateTestValue}),
 e('a5','test1','login',iso(NOW-200000),{}),
 e('a6','test1','v9_call_report',iso(NOW-120000),{customerId:'lead-a'}),
 e('a7','test1','voice_call',iso(NOW-110000),{phone:'+13055559999'}),
 e('a8','foreign','workforce_lead_created',iso(NOW-60000),{customerId:'foreign-lead',researchComplete:true}),
 e('a9','owner','login',iso(NOW-50000),{}),
 e('a10','lorna','lead_updated',iso(NOW-90000),{customerId:'foreign-lead'}),
 e('a11','lorna','login',iso(NOW-7*86400000),{})
];
const rows=[
 {id:'lead-a',tenant_id:1,business_name:'SBC Northside Barbers'},
 {id:'lead-b',tenant_id:1,business_name:'Renée Studio'},
 {id:'foreign-lead',tenant_id:2,business_name:'Wrong tenant'}
];
const shifts=[{userId:'lorna',clockIn:iso(NOW-4*3600000),clockOut:iso(NOW-3*3600000),mode:'admin'},
 {userId:'test1',clockIn:iso(NOW-5*3600000),clockOut:null,mode:'calling'},
 {userId:'foreign',clockIn:iso(NOW-100000),clockOut:null,mode:'calling'}];
function summary(eventsIn=events,rowsIn=rows){
 return C.summarize({tenantId:1,users,events:eventsIn,crmRows:rowsIn,shiftEntries:shifts,now:NOW,hours:24});
}
const r=summary();
assert.equal(r.ok,true);
assert.equal(r.readOnly,true);
assert.equal(r.modelCreditsUsed,0);
assert.equal(r.totals.leadsSaved,2);
assert.equal(r.totals.researchComplete,1);
assert.equal(r.totals.callReports,1);
assert.equal(r.totals.signIns,1);
assert.equal(r.totals.trainingEvents,1);
assert(r.unverifiableEvents>=2,'unmatched and cross-tenant CRM links must be excluded from outcome totals');
assert(!JSON.stringify(r).includes(privateTestValue));
assert(!JSON.stringify(r).includes('+13055559999'));
assert(!JSON.stringify(r).includes('Other employee'));
assert(!r.employees.some(u=>u.id==='owner'||u.id==='foreign'));
assert.equal(r.employees.find(u=>u.id==='lorna').lastShift.recordedMinutes,60);
assert.equal(r.employees.find(u=>u.id==='test1').lastShift.status,'OPEN_OR_MISSING_CLOCK_OUT');
assert.equal(r.employees.find(u=>u.id==='test1').signIns,1);
assert.equal(r.employees.find(u=>u.id==='lorna').unverifiedLeadEvents,1);
assert.equal(summary().totals.leadsSaved,2,'read-only repeat must be stable');
assert.deepEqual(rows,[
 {id:'lead-a',tenant_id:1,business_name:'SBC Northside Barbers'},
 {id:'lead-b',tenant_id:1,business_name:'Renée Studio'},
 {id:'foreign-lead',tenant_id:2,business_name:'Wrong tenant'}
]);
assert.throws(()=>C.summarize({tenantId:0,users,events:[],crmRows:[]}),/TENANT_REQUIRED/);
assert.throws(()=>C.summarize({tenantId:1,users,events:[],crmRows:[],hours:100}),/WINDOW_INVALID/);
assert.throws(()=>C.summarize({tenantId:1,users,events:null,crmRows:[]}),/AUTHORITATIVE_RECORDS_REQUIRED/);
assert.equal(C.classify('training_progress_v2')[0],'Training');

const src=fs.readFileSync(path.join(ROOT,'server.js'),'utf8'),patched=stage.patchServer(src);
assert.equal(stage.patchServer(patched),patched,'stage must be idempotent');
assert(patched.includes(stage.MARK));
assert(patched.includes("app.get('/api/owner/while-away',auth,ownerOnly"));
assert(patched.includes('MYSQL_RECOVERY_REQUIRED')&&patched.includes('mysqlPool.query'));
const start=patched.indexOf("const SBC_V66128_CATCHUP=require(");
const end=patched.indexOf(' // SBC_V66112_OFFICEBOX_COMMITTED_OWNER_RECONCILIATION',start);
assert(start>0&&end>start);
const registry=new Map(),queries=[];
let dbUp=true;
const db={users},ctx={
 app:{get:(name,auth,owner,fn)=>{assert.equal(auth,'AUTH');assert.equal(owner,'OWNER');registry.set(name,fn)}},
 auth:'AUTH',ownerOnly:'OWNER',require:()=>C,requireRequestTenant:req=>req.tenantId,
 db,now:()=>iso(NOW),Date,Number,Set,String,JSON,
 MYSQL_RECOVERY_REQUIRED:false,MYSQL_RECOVERY_EVALUATED:true,
 v9data:()=>({timeEntries:shifts}),
 sqlDateTime:x=>new Date(x).toISOString().slice(0,19).replace('T',' '),
 console:{warn:()=>{}},
 mysqlPool:{query:async(sql,args)=>{queries.push({sql,args});if(!dbUp)throw Error('MYSQL_OFFLINE');
    assert(/^SELECT /i.test(sql),'owner recap must only issue SELECT');
    if(sql.includes('sbc_audit_log'))return [events];
    if(sql.includes('sbc_customers'))return [rows];
    throw Error('UNEXPECTED_QUERY');
   }}
};
vm.runInNewContext(patched.slice(start,end),ctx,{timeout:2000});
const handler=registry.get('/api/owner/while-away');
assert.equal(typeof handler,'function');
function reply(){return {code:200,payload:null,headers:{},
 status(n){this.code=n;return this},setHeader(k,v){this.headers[k]=v;return this},
 json(x){this.payload=x;return this}}}
(async()=>{
 let res=reply();await handler({tenantId:1,query:{hours:'24'}},res);
 assert.equal(res.code,200);assert.equal(res.payload.readOnly,true);
 assert.equal(res.payload.totals.leadsSaved,2);
 assert(queries.every(q=>q.sql.startsWith('SELECT ')));
 assert.equal(res.headers['Cache-Control'],'no-store');
 res=reply();await handler({tenantId:1,query:{hours:'3'}},res);
 assert.equal(res.code,400);
 dbUp=false;res=reply();await handler({tenantId:1,query:{hours:'24'}},res);
 assert.equal(res.code,503,'SQL outage must not claim 0 activity');
 const srcUi=fs.readFileSync(path.join(ROOT,'public/v66-128-owner-while-away.js'),'utf8');
 assert.equal(srcUi,fs.readFileSync(path.join(ROOT,'browser_public/v66-128-owner-while-away.js'),'utf8'));
 assert(srcUi.includes('textContent')&&srcUi.includes('credentials:'));
 assert(srcUi.includes("document.getElementById('modalBody')"));
 assert(!srcUi.includes('OPENAI_API_KEY')&&!srcUi.includes('askSbcAI('));
 for(const folder of ['public','browser_public']){
  const app=fs.readFileSync(path.join(ROOT,folder,'app.js'),'utf8');
  const html=fs.readFileSync(path.join(ROOT,folder,'index.html'),'utf8');
  assert(app.includes('sbcOpenWhileAway(24)'),'owner dashboard trigger absent');
  assert(html.includes('/v66-128-owner-while-away.js?v=66.0.128'),'owner UI script not referenced');
 }
 const browser=fs.readFileSync(path.join(ROOT,'browser_public/app.js'),'utf8');
 assert.equal(fs.readFileSync(path.join(ROOT,'public/app.js'),'utf8'),browser);
 if(process.argv.includes('--staged'))assert.equal(src,patched,'staged server lacks owner route');
 console.log('[SBC V66.128 OWNER CATCH-UP] PASS read-only SQL, audit-bound Lorna leads, time clock, training, calls, XSS-safe UI parity, no AI or charge');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
