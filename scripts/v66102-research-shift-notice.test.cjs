'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const ENGINE=require('../public/sbc-role-shift-plan.js');
const NOTICE=require('../enterprise/v66102-research-notice.cjs');
const PATCH=require('./v66102-stage-research-notice.cjs');
const base=ENGINE.template('lead_researcher');
assert.equal(ENGINE.totalMinutes('lead_researcher'),240);
assert.equal(base.filter(t=>/^research/.test(t.id)).reduce((n,t)=>n+t.minutes,0),180);
assert.equal(ENGINE.totalMinutes('caller'),240);
assert.equal(ENGINE.totalMinutes('caller',{minutes:360}),360);
assert.equal(ENGINE.schedule('sales',null,null,{minutes:360}).items.reduce((a,t)=>a+t.minutes,0),360);
assert.equal(ENGINE.schedule('sales',null,null,{minutes:240}).items.reduce((a,t)=>a+t.minutes,0),240);
const html=read('public/sales-caller.html'),js=read('public/sales-caller.js');
assert.equal(html,read('browser_public/sales-caller.html'));
assert.equal(js,read('browser_public/sales-caller.js'));
assert(html.includes('sales-shift-length')&&html.includes('value="360"'));
assert(js.includes("sbc-sales-shift-minutes-v1:"));
const research=read('public/lead-research.js');
assert(research.includes('Dismiss resolved notice')&&research.includes('researchNoticeResolved===true'));
assert(research.includes("result.deleted!==false")&&research.includes('resolve-notice'));
const lead={id:'lead-1',tenantId:1,researcherId:'lorna1',status:'Lead',businessName:'Sunny Barber Shop',
 phone:'3055550144',email:'',website:'',verificationStatus:'Needs Correction',source:'Lead Research',
 leadIntelligence:{researchSource:'https://maps.google.com/?business=sunny',autoVerificationStatus:'NEEDS_HUMAN_REVIEW'},
 leadAssist:{status:'NEEDS_HUMAN_REVIEW',checkedAt:'2026-11-06T15:00:00.000Z'}};
assert(NOTICE.eligible(lead).ok);
assert.equal(NOTICE.resolved(lead),false);
const marker=NOTICE.markResolved(lead,'lorna1','2026-11-06T16:00:00.000Z');
lead.leadIntelligence.researchNotice=marker;
assert(NOTICE.resolved(lead));
assert.equal(marker.resolvedBy,'lorna1');
const changed={...lead,phone:'3055550145'};
assert.equal(NOTICE.resolved(changed),false,'new lead corrections must reopen');
const newReview={...lead,leadAssist:{status:'NEEDS_HUMAN_REVIEW',checkedAt:'2026-11-06T17:00:00.000Z'}};
assert.equal(NOTICE.resolved(newReview),false,'new automated failure must reopen');
assert.equal(NOTICE.eligible({...lead,businessName:'� corrupt'}).ok,false);
assert.equal(NOTICE.eligible({...lead,leadIntelligence:{researchSource:''},verificationSource:''}).ok,false);
assert.equal(NOTICE.eligible({...lead,phone:'',email:'',website:''}).ok,false);
const raw=read('server.js'),stage=PATCH.patchServer(raw);
assert.equal(PATCH.patchServer(stage),stage,'server patch idempotent');
assert(stage.includes(PATCH.MARK));
const start=stage.indexOf("const SBC_V66102_RESEARCH_NOTICE=require(");
const end=stage.indexOf("app.get('/api/v9/lead-verification',auth",start);
assert(start>0&&end>start);
let route=null,sql=[],savedIntel=null,audits=[];
const current={...lead,leadIntelligence:{researchSource:'https://maps.google.com/?business=sunny',autoVerificationStatus:'NEEDS_HUMAN_REVIEW'}};
const pool={async query(statement,args){
 sql.push(statement);
 if(statement.startsWith('UPDATE sbc_customers')){savedIntel=JSON.parse(args[0]);return [{affectedRows:1}];}
 if(statement.startsWith('SELECT lead_intelligence_json'))return [[{lead_intelligence_json:JSON.stringify(savedIntel)}]];
 throw Error('Unapproved SQL query');
}};
vm.runInNewContext(stage.slice(start,end),{
 require:()=>NOTICE,app:{post(_route,_auth,fn){route=fn}},auth(){},
 sbcLornaRole:u=>u.role==='lead_researcher',requireRequestTenant:()=>1,
 db:{customers:[current]},mysqlPool:pool,now:()=> '2026-11-06T16:00:00.000Z',
 sqlDateTime:v=>v.replace('T',' ').slice(0,19),audit:(_actor,event,_msg,meta)=>audits.push({event,meta}),console
});
assert.equal(typeof route,'function');
function run(user,id){
 let code=200,body={},headers={};
 const res={status(n){code=n;return this},json(v){body=v;return this},setHeader(k,v){headers[k]=v;return this}};
 return Promise.resolve(route({user,params:{id}},res)).then(()=>({code,body,headers}));
}
(async()=>{
 const researcher={id:'lorna1',role:'lead_researcher'};
 const denied=await run({id:'other',role:'lead_researcher'},'lead-1');
 assert.equal(denied.code,403);assert.equal(sql.length,0);
 const success=await run(researcher,'lead-1');
 assert.equal(success.code,200);assert.equal(success.body.resolved,true);
 assert.equal(success.body.deleted,false);assert.equal(success.body.retainedCustomer,true);
 assert.equal(sql.length,2);assert.equal(audits.length,1);
 assert.equal(current.id,'lead-1');assert(NOTICE.resolved(current));
 const again=await run(researcher,'lead-1');
 assert.equal(again.body.alreadyResolved,true);assert.equal(sql.length,2,'idempotent acknowledgment');
 if(process.argv.includes('--staged'))assert.equal(stage,raw);
 console.log('PASS V66.102: Lorna 180/240 focused research, flexible 4/6-hour sales shifts, tenant/role-isolated persistent notice acknowledgments without lead deletion');
})().catch(err=>{console.error(err);process.exitCode=1});
