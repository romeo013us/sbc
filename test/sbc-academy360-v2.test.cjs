'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../routes/sbc-am-academy-v1.cjs'),T=require('../enterprise/training-system-v2.js');
const A=require('../enterprise/sbc-am-academy-v1.cjs'),G=require('../enterprise/sbc-am-academy-gates-v1.cjs');
const PREFIX='/api/sbc/academy-am/v1';
function harness({role='account_manager',tenant=1,readonly=false,saveFail=false,onSave}={}){
 const db={users:[{id:'am',role:'account_manager',tenantId:1,active:true,name:'Fictional Trainee'},{id:'owner',role:'owner',tenantId:1,active:true},{id:'foreign',role:'account_manager',tenantId:2,active:true}],settings:{v9:{timeEntries:[{id:'clock',userId:'am',mode:'training',clockIn:new Date(Date.now()-60000).toISOString()}]}}};
 const routes={},counts={save:0};T.ensureState(db);let actorRole=role;
 R.register({get:(p,a,h)=>routes['GET '+p]=h,post:(p,a,h)=>routes['POST '+p]=h},{auth(){},getDb:()=>db,tenantForRead:()=>tenant,isReadOnly:()=>readonly,writer(){},save:async()=>{counts.save++;if(onSave)await onSave();if(saveFail)throw Error('PERSISTENCE_UNAVAILABLE')}});
 async function request(method,path,{params={},body={},query={}}={}){
  assert.equal(typeof routes[method+' '+PREFIX+path],'function','public route '+path);
  let status=200,data;const res={setHeader(){},status(v){status=v;return this},json(v){data=v;return this}};
  await routes[method+' '+PREFIX+path]({user:db.users.find(u=>u.role===actorRole),params,body,query},res);return {status,data};
 }
 return {db,counts,request,setRole:r=>actorRole=r};
}
const note='Fictional salon: the owner requested a clearer services page. Services remain unverified. Request approved scope, respect contact preferences, and ask Jonathan to review the brief on Monday.';
test('work sample grades decisions on the server, flags critical claims and persists only training evidence',async()=>{
 const h=harness();await h.request('POST','/window/start');
 const lab=await h.request('GET','/lab/:moduleId',{params:{moduleId:'am-01'},query:{lang:'es'}});
 assert.equal(lab.status,200);assert.match(lab.data.lab.title,/SBC/);assert(!JSON.stringify(lab.data).includes('correct'));
 const r=await h.request('POST','/lab/:moduleId',{params:{moduleId:'am-01'},body:{lang:'es',decisions:{truth:0,approval:2,next:0},artifact:note,passed:true,score:100}});
 assert.equal(r.status,200);assert.equal(r.data.passed,false);assert.deepEqual(r.data.critical,['truth']);
 assert.equal(T.ensureState(h.db).attempts.at(-1).type,'sbc_am_work_sample');
 assert(!h.db.customers&&!h.db.orders&&!h.db.payments);
});
module.exports={harness,note};
test('work samples cannot be accessed by a foreign tenant, researcher, owner impersonation or recovery writer',async()=>{
 for(const options of [{tenant:2},{readonly:true},{role:'lead_researcher'}]){const h=harness(options),r=await h.request('POST','/window/start');assert.notEqual(r.status,200);assert.equal(h.counts.save,0);}
 const h=harness();assert.equal((await h.request('GET','/owner/roster')).status,403);
 h.setRole('owner');assert.equal((await h.request('POST','/lab/:moduleId',{params:{moduleId:'am-01'},body:{}})).status,403);
 assert.equal((await harness({readonly:true}).request('GET','/window')).data.readOnly,true,'Preview advertises its read-only status to the learner');
 const list=await h.request('GET','/owner/roster');assert.equal(list.data.learners.length,1);assert.equal(list.data.learners[0].id,'am');
 assert.equal((await h.request('GET','/owner/readiness/:userId',{params:{userId:'foreign'}})).status,404);
});
test('a failed durable save rolls back the attempted training grant and returns an explicit failure',async()=>{
 const h=harness({saveFail:true}),before=JSON.stringify(h.db.settings.trainingCenterV2);
 const r=await h.request('POST','/window/start');assert.equal(r.status,503);assert.equal(r.data.error,'ACADEMY_SAVE_NOT_CONFIRMED');assert.equal(JSON.stringify(h.db.settings.trainingCenterV2),before);
});
test('stage progress requires a passed structured sample, and a later critical failure replaces the earlier pass',()=>{
 const h=harness(),s=T.ensureState(h.db);
 for(const id of ['am-01','am-02','am-03']){
  T.upsertProgress(s,{userId:'am',courseId:A.COURSE_ID,moduleId:id,status:'completed'});
  s.attempts.push({userId:'am',courseId:A.COURSE_ID,moduleId:id,type:'sbc_am_objective',passed:true,score:100});
  s.attempts.push({userId:'am',courseId:A.COURSE_ID,moduleId:id,type:'sbc_am_roleplay_for_owner_review',response:note});
 }
 assert.equal(G.canEnter(s,'am','am-04'),false);
 for(const id of ['am-01','am-02','am-03'])s.attempts.push({userId:'am',courseId:A.COURSE_ID,moduleId:id,type:'sbc_am_work_sample',passed:true,score:100,workSample:{version:'2026.11.22.2',critical:[]}});
 assert.equal(G.canEnter(s,'am','am-04'),true);
 s.attempts.push({userId:'am',courseId:A.COURSE_ID,moduleId:'am-01',type:'sbc_am_work_sample',passed:false,score:67,workSample:{version:'2026.11.22.2',critical:['truth']}});
 assert.equal(G.canEnter(s,'am','am-04'),false);
});
function readyFixture(h){const s=T.ensureState(h.db);for(const id of G.MODULES){T.upsertProgress(s,{userId:'am',courseId:A.COURSE_ID,moduleId:id,status:'completed'});s.attempts.push({id:'quiz-'+id,userId:'am',courseId:A.COURSE_ID,moduleId:id,type:'sbc_am_objective',passed:true,score:100},{id:'sample-'+id,userId:'am',courseId:A.COURSE_ID,moduleId:id,type:'sbc_am_work_sample',passed:true,score:100,workSample:{version:'2026.11.22.2',critical:[]}},{id:'practice-'+id,userId:'am',courseId:A.COURSE_ID,moduleId:id,type:'sbc_am_roleplay_for_owner_review',response:note});}return s;}
const review={ratings:{discovery:4,accuracy:4,demo:4,objections:4,controls:4,handoff:4,bilingual:4},critical:{truthfulness:false,contactPermission:false,paymentAuthority:false,privacy:false},languages:['en','es'],method:'live_observed',notes:'Observed fictional discovery, demo, handoff and safe payment handling in both languages.',evidence:'Observed training session with Jonathan, fictional case A.'};
test('owner rubric requires bilingual observation and critical checks even with a perfect numeric score',async()=>{
 const h=harness({role:'owner'});readyFixture(h);
 let r=await h.request('POST','/owner/review/:attemptId',{params:{attemptId:'practice-am-12'},body:{...review,languages:['en']}});assert.equal(r.status,422);
 r=await h.request('POST','/owner/review/:attemptId',{params:{attemptId:'practice-am-12'},body:{...review,critical:{...review.critical,privacy:true}}});assert.equal(r.status,200);assert.equal(r.data.review.score,100);assert.equal(r.data.review.passed,false);assert.equal(r.data.readiness.ready,false);
 assert.equal((await h.request('POST','/owner/certification/:userId',{params:{userId:'am'},body:{status:'Certified',reason:'Observed passing trainee and approved clearance.'}})).status,409);
});
test('owner certification follows the latest capstone; revocation, expiration and a new capstone withdraw clearance',async()=>{
 const h=harness({role:'owner'});readyFixture(h);
 let r=await h.request('POST','/owner/review/:attemptId',{params:{attemptId:'practice-am-12'},body:review});assert.equal(r.data.readiness.ready,true);
 r=await h.request('POST','/owner/certification/:userId',{params:{userId:'am'},body:{status:'Certified',reason:'Passing bilingual capstone and all practical evidence reviewed.'}});assert.equal(r.data.clearance,true);
 await h.request('POST','/owner/review/:attemptId',{params:{attemptId:'practice-am-12'},body:review});assert.equal(G.hasClearance(T.ensureState(h.db),h.db,'am'),false,'a new review requires a fresh certification decision');
 await h.request('POST','/owner/certification/:userId',{params:{userId:'am'},body:{status:'Certified',reason:'Approved the latest revised bilingual observation rubric.'}});
 const s=T.ensureState(h.db),cert=s.certifications.at(-1);cert.expiresAt='2000-01-01T00:00:00Z';assert.equal(G.hasClearance(s,h.db,'am'),false);cert.expiresAt='';
 s.attempts.push({...s.attempts.find(a=>a.id==='practice-am-12'),id:'new-capstone',academyRubric:undefined,passed:null});assert.equal(G.hasClearance(s,h.db,'am'),false);
 assert.equal((await h.request('POST','/owner/review/:attemptId',{params:{attemptId:'practice-am-12'},body:review})).status,409);
 r=await h.request('POST','/owner/certification/:userId',{params:{userId:'am'},body:{status:'Revoked',reason:'Owner requires supervised remediation before clearance.'}});assert.equal(r.data.clearance,false);
});
test('a pending Academy save queues legacy training changes and preserves both employee histories',async()=>{
 let release,entered,block=false;const pending=new Promise(r=>entered=r),h=harness({onSave:async()=>{if(block){entered();await new Promise(r=>release=r);}}});block=true;
 const first=h.request('POST','/window/start');await pending;
 let legacyRan=false;const legacy=T.withWriteLock(h.db,async()=>{legacyRan=true;T.recordEvent(T.ensureState(h.db),{type:'legacy_research_practice',userId:'researcher'});});
 await new Promise(r=>setImmediate(r));assert.equal(legacyRan,false);release();await first;await legacy;
 assert.equal(T.ensureState(h.db).amTrainingWindows.length,1);assert(T.ensureState(h.db).events.some(e=>e.type==='legacy_research_practice'));
});
test('owner extension reports actual minutes and shifts without editing clock records',async()=>{
 const h=harness();await h.request('POST','/window/start');const clock=JSON.stringify(h.db.settings.v9);h.setRole('owner');
 const r=await h.request('POST','/owner/override/:userId',{params:{userId:'am'},body:{minutes:60,shifts:1,reason:'Approved targeted bilingual discovery remediation.'}});
 assert.equal(r.status,200);assert.equal(r.data.budget.approvedMinutes,540);assert.equal(r.data.budget.approvedShifts,3);assert.equal(JSON.stringify(h.db.settings.v9),clock);
 assert.equal((await h.request('POST','/owner/override/:userId',{params:{userId:'am'},body:{minutes:60,shifts:1,reason:'Another full shift requested after the exception.'}})).status,409);
});
test('live clearance stays blocked while a certification save is pending, then opens only after durable success',async()=>{
 let release,entered,block=false;const pending=new Promise(r=>entered=r),h=harness({role:'owner',onSave:async()=>{if(block){entered();await new Promise(r=>release=r);}}});readyFixture(h);
 await h.request('POST','/owner/review/:attemptId',{params:{attemptId:'practice-am-12'},body:review});block=true;
 const saving=h.request('POST','/owner/certification/:userId',{params:{userId:'am'},body:{status:'Certified',reason:'Observed all current bilingual and practical requirements.'}});
 await pending;assert.equal(G.hasClearance(T.ensureState(h.db),h.db,'am'),false,'no in-flight live access grant');release();const r=await saving;assert.equal(r.data.clearance,true);assert.equal(G.hasClearance(T.ensureState(h.db),h.db,'am'),true);
});
test('English and Spanish assessments retain the same server grading and complete lesson coverage',()=>{
 for(const m of A.COURSE.modules){const es=A.publicQuestions(m.id,'es'),en=A.publicQuestions(m.id,'en');assert.equal(es.length,en.length);assert(es.every(q=>q.prompt&&!Object.hasOwn(q,'correct')));assert.equal(m.translations.es.learn.length,6);assert(A.grade(m.id,A.QUESTIONS[m.id].map(q=>q.correct),'es').passed);}
 assert.equal(A.COURSE.coreMinutes+A.COURSE.reviewAndFlexMinutes,480);
 assert.equal(A.COURSE.modules.reduce((n,m)=>n+m.minutes,0),400);
 assert.equal(A.publicQuestions('am-05','es')[1].choices[0],'Después de escuchar y confirmar la necesidad');
});
test('branching objection outcomes are graded from the actual path and critical violations override the score',()=>{
 const D=require('../enterprise/sbc-am-dialogue-v2.cjs');assert.equal(D.grade([0,0,0]).passed,true);assert.equal(D.grade([2,0]).passed,false);assert.deepEqual(D.grade([2,0]).critical,['truthfulness']);assert.throws(()=>D.grade([0,0]),/INCOMPLETE/);assert.throws(()=>D.grade([0,0,0,0]),/INCOMPLETE/);
});
