'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const A=require('../enterprise/sbc-am-academy-v1.cjs');
const G=require('../enterprise/sbc-am-academy-gates-v1.cjs');
const B=require('../enterprise/sbc-am-training-budget-v1.cjs');
const T=require('../enterprise/training-system-v2.js');
const R=require('../routes/sbc-am-academy-v1.cjs');
const STAGE=require('./v66165-stage-am-academy.cjs');
const shift=(id,clockIn,clockOut=null)=>({id,userId:'am1',mode:'training',clockIn,clockOut,breaks:[]});
const getDb=()=>({users:[
 {id:'am1',role:'account_manager',active:true,tenantId:1,name:'New Account Manager'},
 {id:'owner1',role:'owner',active:true,tenantId:1,name:'Owner'},
 {id:'other',role:'account_manager',active:true,tenantId:2,name:'External Tenant'},
 {id:'lorna',role:'lead_researcher',active:true,tenantId:1,name:'Lorna'}
],settings:{v9:{timeEntries:[shift('day1','2026-11-23T14:00:00Z')]}}});
const first='2026-11-23T14:00:00Z';
test('experienced hire gets 12 substantial original AM lessons in eight skill stages with 36 server-private questions',()=>{
 assert.equal(A.COURSE.modules.length,12);
 assert.equal(new Set(A.COURSE.modules.map(m=>m.id)).size,12);
 assert(A.COURSE.estimatedMinutes>=480,'academy material is substantial, not a 30-minute checklist');
 assert.equal(Object.values(A.QUESTIONS).flat().length,36);
 assert.equal(G.STAGES.length,8);assert.equal(G.MODULES.length,12);
 for(const m of A.COURSE.modules){
  assert(m.lesson.learn.length>=5);
  assert(m.academyMedia.spanish.length>=4);
  assert(m.academyMedia.script.length>=70);
  assert(m.assessment.passingScore>=90);
  const publicQ=A.publicQuestions(m.id);
  assert.equal(publicQ.length,3);
  assert(publicQ.every(q=>!Object.hasOwn(q,'correct')&&!Object.hasOwn(q,'rationale')));
 }
 assert(A.COURSE.modules.some(m=>m.title.includes('Square')));
});
test('AM catalog auto-assignment is role-scoped; legacy Lorna/caller remains independent, and old activity survives',()=>{
 const db=getDb(),s=T.ensureState(db);
 const ids=T.getForUser(db,db.users[0]).assigned.map(x=>x.course.id);
 assert(ids.includes(A.COURSE_ID));
 assert(!T.getForUser(db,db.users[3]).assigned.some(x=>x.course.id===A.COURSE_ID));
 assert(!T.userCanSeeCourse({role:'caller',active:true},A.COURSE));
 const p=T.upsertProgress(s,{userId:'am1',courseId:A.COURSE_ID,moduleId:'am-01',status:'in_progress'});
 T.repairCourseCatalog(db);
 assert.equal(T.repairCourseCatalog(db).changed,false);
 assert.equal(T.ensureState(db).progress.find(x=>x.id===p.id).status,'in_progress');
});
test('8 training-clock hours in two shifts reaches mandatory owner review without changing payroll records',()=>{
 const db=getDb(),state={amTrainingWindows:[]},before=JSON.stringify(db.settings.v9.timeEntries);
 const start=B.start(state,db,'am1',first);assert.equal(start.created,true);
 assert.equal(B.start(state,db,'am1',first).created,false,'idempotent first shift');
 const early=B.asOf(state,db,'am1',Date.parse('2026-11-23T17:00:00Z'));
 assert.equal(early.trainingMinutes,180);assert.equal(early.ownerReviewRequired,false);
 assert.doesNotThrow(()=>B.permit(state,db,'am1',Date.parse('2026-11-23T17:00:00Z')));
 db.settings.v9.timeEntries[0].clockOut='2026-11-23T18:00:00Z';
 db.settings.v9.timeEntries.push(shift('day2','2026-11-24T14:00:00Z'));
 const after5=B.asOf(state,db,'am1',Date.parse('2026-11-24T15:00:00Z'));
 assert.equal(after5.trainingMinutes,300);assert.equal(after5.ownerReviewRequired,false);
 db.settings.v9.timeEntries[1].clockOut='2026-11-24T18:00:00Z';
 const final=B.asOf(state,db,'am1',Date.parse('2026-11-24T18:00:00Z'));
 assert.equal(final.trainingMinutes,480);
 assert.equal(final.closedShifts,2);
 assert.equal(final.minutesRemaining,0);
 assert.equal(final.ownerReviewRequired,true);
 assert.throws(()=>B.permit(state,db,'am1',Date.parse('2026-11-24T18:00:00Z')),/OWNER_REVIEW_REQUIRED/);
 assert.notEqual(JSON.stringify(db.settings.v9.timeEntries),before,'the fixture may simulate time clock events');
 assert.equal(state.amTrainingWindows.length,1);
 assert(!Object.hasOwn(state,'payroll')&&!Object.hasOwn(state,'payouts'),'budget never touches wages');
});
test('no unpaid training bypass: start requires an official training-mode clock-in',()=>{
 const db=getDb(),state={amTrainingWindows:[]};
 db.settings.v9.timeEntries=[];
 assert.throws(()=>B.start(state,db,'am1'),/CLOCK_IN_TRAINING_REQUIRED/);
 db.settings.v9.timeEntries.push({id:'wrong',userId:'am1',mode:'admin',clockIn:first,clockOut:null});
 assert.throws(()=>B.start(state,db,'am1'),/CLOCK_IN_TRAINING_REQUIRED/);
 assert.equal(state.amTrainingWindows.length,0);
});
test('an owner may explicitly approve one bounded additional paid-training shift; no silent extensions',()=>{
 const db=getDb(),s={amTrainingWindows:[]};
 B.start(s,db,'am1',first);
 db.settings.v9.timeEntries[0].clockOut='2026-11-23T18:00:00Z';
 db.settings.v9.timeEntries.push(shift('day2','2026-11-24T14:00:00Z','2026-11-24T18:00:00Z'));
 assert.equal(B.asOf(s,db,'am1',Date.parse('2026-11-24T18:00:00Z')).ownerReviewRequired,true);
 assert.throws(()=>B.extend(s,db,'am1',{ownerId:'owner1',reason:'too short',minutes:240,shifts:1}),/REASON_REQUIRED/);
 assert.throws(()=>B.extend(s,db,'am1',{ownerId:'owner1',reason:'Owner reviewed performance and authorizes one more shift.',minutes:600,shifts:1}),/LIMIT_INVALID/);
 B.extend(s,db,'am1',{ownerId:'owner1',reason:'One extra shift approved for observed skills remediation.',minutes:120,shifts:1});
 assert.throws(()=>B.extend(s,db,'am1',{ownerId:'owner1',reason:'Another additional shift is requested.',minutes:60,shifts:1}),/ALREADY_USED/);
 db.settings.v9.timeEntries.push(shift('day3','2026-11-25T14:00:00Z'));
 const next=B.asOf(s,db,'am1',Date.parse('2026-11-25T15:00:00Z'));
 assert.equal(next.ownerReviewRequired,false);
 assert.equal(next.trainingMinutes,540);
 assert.equal(next.minutesRemaining,60);
});
test('server assessment never trusts client-provided scores; 2/3 is below 90%',()=>{
 const questions=A.QUESTIONS['am-05'],right=questions.map(q=>q.correct);
 const pass=A.grade('am-05',right);assert.equal(pass.score,100);assert.equal(pass.passed,true);
 const notYet=A.grade('am-05',[right[0],(right[1]+1)%3,right[2]]);
 assert.equal(notYet.score,67);assert.equal(notYet.passed,false);
 assert.throws(()=>A.grade('am-05',['0',1,1]),/INVALID_ASSESSMENT/);
});
test('stage gate cannot be defeated by a perfect late-stage quiz',()=>{
 const db=getDb(),s=T.ensureState(db);
 assert(G.canEnter(s,'am1','am-01'));
 assert(!G.canEnter(s,'am1','am-07'));
 for(const id of G.STAGES[0]){
  T.upsertProgress(s,{userId:'am1',courseId:A.COURSE_ID,moduleId:id,status:'completed'});
  s.attempts.push({userId:'am1',courseId:A.COURSE_ID,moduleId:id,type:'sbc_am_objective',score:100,passed:true});
  s.attempts.push({userId:'am1',courseId:A.COURSE_ID,moduleId:id,type:'sbc_am_roleplay_for_owner_review',response:'This is a fictional training practice explanation meeting the eighty character threshold, not actual customer contact.'});
  s.attempts.push({userId:'am1',courseId:A.COURSE_ID,moduleId:id,type:'sbc_am_work_sample',passed:true,score:100,workSample:{version:'2026.11.22.2',critical:[]}});
 }
 assert(G.canEnter(s,'am1','am-04'));
 assert(!G.canEnter(s,'am1','am-07'));
 assert(!G.hasClearance(s,db,'am1'),'no automatic manager account clearance');
});
test('account manager may use Academy and time clock, not financial, payment or owner endpoints',()=>{
 const roleGate=require('../enterprise/sbc-account-manager-role-gate-v2.cjs');
 const user={id:'am1',role:'account_manager',active:true};
 for(const [verb,p] of [['GET','/api/sbc/academy-am/v1/quiz/am-01'],['POST','/api/sbc/academy-am/v1/quiz/am-01'],
  ['POST','/api/sbc/academy-am/v1/roleplay/am-01'],['POST','/api/sbc/academy-am/v1/window/start'],
  ['GET','/api/sbc/academy-am/v1/window']])assert(roleGate.allowAccountManager(user,verb,p),p);
 for(const p of ['/api/sbc/academy-am/v1/owner/override/am1','/api/payments/square/owner-mark-paid','/api/training/certification/am1'])
  assert(!roleGate.allowAccountManager(user,'POST',p),p);
 assert(G.isTrainingSafeRoute('GET','/api/training/courses/'+A.COURSE_ID));
 assert(!G.isTrainingSafeRoute('POST','/api/appointments'));
});
function harness({role='account_manager',tenant=1,readOnly=false,writerThrows=false,clock=true}={}){
 const db=getDb(),handlers={},actor=role==='owner'?db.users[1]:role==='lead_researcher'?db.users[3]:db.users[0],counts={save:0,writer:0};
 // Route integration tests need a recent training-mode shift; the budget unit
 // tests above intentionally use fixed timestamps with explicit asOf clocks.
 if(clock)db.settings.v9.timeEntries[0].clockIn=new Date(Date.now()-60_000).toISOString();
 else db.settings.v9.timeEntries=[];
 R.register({
  get(route,auth,fn){handlers['GET '+route]=fn},
  post(route,auth,fn){handlers['POST '+route]=fn}
 },{
  auth:(_req,_res,next)=>next?.(),getDb:()=>db,tenantForRead:()=>tenant,
  isReadOnly:()=>readOnly,writer:()=>{if(writerThrows)throw Object.assign(Error('WRITER_RECOVERY_HOLD'),{status:423});counts.writer++},
  save:async()=>{counts.save++}
 });
 const fetch=async(method,route,params={},body={})=>{
  const handler=handlers[method+' '+route];assert.equal(typeof handler,'function','registered '+route);
  let code=200,content=null;const res={setHeader(){},status(n){code=n;return this},json(data){content=data;return this}};
  await handler({user:{...actor},params,body},res);
  return {code,content};
 };
 return {db,fetch,counts};
}
test('owner-only time budget API, worker clock-in, and server-scored attempt persist without payment actions',async()=>{
 const h=harness(),start=await h.fetch('POST','/api/sbc/academy-am/v1/window/start');
 assert.equal(start.code,200,JSON.stringify(start.content));
 assert.equal(start.content.created,true);
 const qs=await h.fetch('GET','/api/sbc/academy-am/v1/quiz/:moduleId',{moduleId:'am-01'});
 assert.equal(qs.code,200);
 assert(!JSON.stringify(qs.content).includes('correct'));
 const bad=await h.fetch('POST','/api/sbc/academy-am/v1/quiz/:moduleId',{moduleId:'am-08'},{answers:[0,0,0]});
 assert.equal(bad.code,423,'no late stage while prerequisites incomplete');
 const scored=await h.fetch('POST','/api/sbc/academy-am/v1/quiz/:moduleId',{moduleId:'am-01'},{score:10000,passed:true,answers:A.QUESTIONS['am-01'].map(q=>q.correct)});
 assert.equal(scored.code,200,JSON.stringify(scored.content));
 assert.equal(scored.content.score,100);
 assert.equal(scored.content.certified,false);
 assert.equal(T.ensureState(h.db).attempts.filter(a=>a.type==='sbc_am_objective').length,1);
 assert.equal(h.counts.save,2,'start and quiz write, nothing else');
});
test('recovery hold, cross-tenant, and researcher attempts fail closed with no training score writes',async()=>{
 for(const options of [{tenant:2},{readOnly:true},{writerThrows:true},{role:'lead_researcher'}]){
  const h=harness(options);
  const r=await h.fetch('POST','/api/sbc/academy-am/v1/window/start');
  assert.notEqual(r.code,200,JSON.stringify(options));
  assert.equal(h.counts.save,0);
 }
});
test('isolated staging injects owner-certification and legacy bypass gates without mutating master server',()=>{
 const baseline=read('server.js'),patched=STAGE.patchServer(baseline);
 if(baseline.includes('// '+STAGE.MARK))assert.equal(patched,baseline,'already compiled release remains unchanged');
 else assert.notEqual(patched,baseline);
 assert.equal(STAGE.patchServer(patched),patched,'idempotent staging');
 assert.match(patched,/ACADEMY_QUIZ_AND_ROLEPLAY_REQUIRED/);
 assert.match(patched,/ACADEMY_SERVER_GRADED_ASSESSMENT_ONLY/);
 assert.match(patched,/ACADEMY_READINESS_INCOMPLETE/);
 assert.match(patched,/SBC_AM_TRAINING_BUDGET\.permit/);
 assert.match(patched,/ACCOUNT_MANAGER_ACADEMY_CERTIFICATION_REQUIRED/);
 new vm.Script(patched,{filename:'sbc-am-staged-server.js'});
 assert.throws(()=>STAGE.patchServer('generic router code'),/AM_ACADEMY_FULL_SERVER_REQUIRED/);
});
test('visual training studio has a real SVG/CSS visual story, browser narration, bilingual controls and truthful video status',()=>{
 for(const prefix of ['public/','browser_public/']){
  const html=read(prefix+'sbc-am-academy.html'),js=read(prefix+'sbc-am-academy-v1.js'),css=read(prefix+'sbc-am-academy-v1.css');
  assert(html.includes('ACADEMY 360'));
  assert(html.includes('8 paid working hours'));
  assert(html.includes('TRAINING')||html.includes('training'));
  assert(html.includes('No customer calls'));
  assert(js.includes('SpeechSynthesisUtterance')&&js.includes("es-ES"));
  assert(js.includes('/api/v9/time/clock')&&js.includes('/api/sbc/academy-am/v1')&&js.includes('/window'));
  assert(css.includes('screen-body')&&css.includes('prefers-reduced-motion'));
  new vm.Script(js,{filename:prefix+'sbc-am-academy-v1.js'});
 }
 assert.equal(read('public/sbc-am-academy.html'),read('browser_public/sbc-am-academy.html'));
 assert.equal(read('public/sbc-am-academy-v1.js'),read('browser_public/sbc-am-academy-v1.js'));
 assert.equal(read('public/sbc-am-academy-v1.css'),read('browser_public/sbc-am-academy-v1.css'));
});
