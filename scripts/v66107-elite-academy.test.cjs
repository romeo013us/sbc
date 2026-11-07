'use strict';
/* SBC V66.107 — detached fixtures only. No production records, calls, charges, access changes. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const elite=require('../enterprise/v66107-academy-2026.cjs');
const training=require('../enterprise/training-system-v2.js');
const reader=require('../public/sbc-research-lesson-reader.js');
const root=path.resolve(__dirname,'..'),read=x=>fs.readFileSync(path.join(root,x),'utf8');
assert.deepEqual(elite.validate(),{ok:true,errors:[],courseCount:3,lessonCount:18,hoursPerEmployee:12});
const users=[
 {id:'caller-fixture',name:'Caller Fixture',username:'test1',role:'caller',active:true},
 {id:'research-fixture',name:'Research Fixture',username:'lorna',role:'lead_researcher',active:true}
];
const db={users,settings:{}};
let state=training.ensureState(db);
assert.equal(state.migration.elite2026Applied,true);
assert.equal(state.migration.elite2026PendingSave,true);
for(const id of elite.BUILT_INS_TO_ARCHIVE){
 assert.equal(state.courses.find(c=>c.id===id)?.status,'archived','legacy built-in should be archived: '+id);
}
const earlier=state.courses.find(c=>c.id==='role-caller-v1');
assert(earlier.modules.length===6,'historical module records unchanged');
const snapshot={
 oldProgress:{id:'legacy-progress-id',userId:'caller-fixture',courseId:earlier.id,moduleId:'sales-01',status:'completed',evidence:'historical evidence'},
 oldAttempt:{id:'legacy-attempt-id',userId:'caller-fixture',courseId:earlier.id,moduleId:'sales-01',status:'passed',answers:['an old check']},
 oldCert:{id:'legacy-cert-id',userId:'caller-fixture',status:'Certified',courseId:earlier.id,certifiedBy:'owner-1'},
 oldAssignment:{id:'legacy-assignment-id',userId:'caller-fixture',courseId:earlier.id,status:'completed'}
};
state.progress.push({...snapshot.oldProgress});state.attempts.push({...snapshot.oldAttempt});
state.certifications.push({...snapshot.oldCert});state.assignments.push({...snapshot.oldAssignment});
const oldArrayLengths={progress:state.progress.length,attempts:state.attempts.length,certifications:state.certifications.length};
const repaired=training.repairCourseCatalog(db);
assert.equal(repaired.changed,true,'initial catalog migration must be marked persistable');
assert.equal(repaired.state.migration.elite2026PendingSave,undefined,'boot repair should clear migration save marker');
assert.equal(training.repairCourseCatalog(db).changed,false,'second boot repair must be idempotent');
for(const u of users){
 const result=training.getForUser(db,u);
 const expectedRole=u.role==='caller'?'sbc-caller-mastery-202611':'sbc-research-mastery-202611';
 const actualIds=result.assigned.map(x=>x.course.id);
 assert.deepEqual(new Set(actualIds),new Set(['sbc-fantastic4-foundations-202611',expectedRole]),u.role+' two current courses only');
 assert.equal(result.assigned.length,2,u.role+' should have two relevant assigned courses');
 const min=result.assigned.reduce((total,c)=>total+c.course.modules.reduce((v,m)=>v+m.minutes,0),0);
 assert.equal(min,720,u.role+' is exactly 12 hours');
 const moduleIds=result.assigned.flatMap(x=>x.course.modules.map(m=>m.id));
 assert.equal(new Set(moduleIds).size,12,'12 unique modules per role');
 assert(!result.available.some(x=>x.id==='core-foundations-v2'),'no outdated course in available');
 for(const course of result.assigned)for(const m of course.course.modules){
  const lesson=reader.normalize(m);
  assert.equal(lesson.hasReadableContent,true,'readable lesson '+m.id);
  assert(lesson.learn.length>=5&&lesson.practicePrompt.length>=50,'high-value teaching and practice '+m.id);
  assert(lesson.knowledgePrompt.length>20&&lesson.passingRule.length>30&&lesson.questions.length===2,'knowledge and assessment '+m.id);
  assert.equal(m.assessment.passingScore,85,'owner-reviewed standard');
 }
}
const after=training.ensureState(db);
const caller=training.getForUser(db,users[0]);
assert(caller.progress.some(p=>p.id===snapshot.oldProgress.id));
assert(caller.attempts.some(a=>a.id===snapshot.oldAttempt.id));
assert(caller.certifications.some(c=>c.id===snapshot.oldCert.id));
assert(after.assignments.some(a=>a.id===snapshot.oldAssignment.id&&a.status==='completed'),'old assignments preserved for audit');
for(const k of Object.keys(oldArrayLengths))assert.equal(after[k].length,oldArrayLengths[k],'old events never dropped');
assert.equal(training.repairCourseCatalog(db).changed,false,'no repeated publish/rebuild');
const current=new Set(after.courses.filter(c=>c.status==='published').map(c=>c.id));
for(const id of elite.CURRENT_IDS)assert(current.has(id));
const code=read('enterprise/training-system-v2.js');
assert(code.includes('SBC_V66107_ELITE_ACADEMY.install'),'durable catalog migration wired');
assert(code.includes("c&&userCanSeeCourse(user,c)"),'archived material must not appear in employee assigned courses');
assert(code.includes("SBC_V66107_ELITE_ACADEMY.COURSES"),'Lorna recovery must not republish stale catalog');
assert(!code.includes('SBC_V66107_UNLOCK_OWNER')&&!code.includes('autoCertify'),'no permissions or certification bypass');
const voice=read('public/sbc-workforce-academy-v6697.js');
assert(voice.includes('speechSynthesis')&&voice.includes('🎧 Listen to this lesson'),'existing lesson voice preserved');
const research=read('public/lead-research.js'),sales=read('public/sales-caller.js');
assert(research.includes('trainingParagraph')&&sales.includes('SBCResearchLessonReader'),'lesson reader still accessible');
assert(sales.includes('window.SBCSalesPlaybook'),'sales script upgrade stays in place');
assert(read('public/sbc-workforce-academy-v6697.js').includes('utterance')||voice.includes('SpeechSynthesisUtterance'));
console.log('[SBC V66.107] PASS 12h=2x6h/3x4h; 18 practical modules; Lorna/test1 assigned current courses; old progress/attempts/certifications retained; idempotent boot; audio and workstations unchanged');
