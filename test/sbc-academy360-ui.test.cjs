'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {JSDOM}=require(process.env.SBC_TEST_JSDOM_MODULE||'jsdom');
const T=require('../enterprise/training-system-v2.js'),A=require('../enterprise/sbc-am-academy-v1.cjs'),G=require('../enterprise/sbc-am-academy-gates-v1.cjs'),B=require('../enterprise/sbc-am-training-budget-v1.cjs'),R=require('../routes/sbc-am-academy-v1.cjs');
const root=path.join(__dirname,'..'),P='/api/sbc/academy-am/v1';
const note='Fictional salon: the owner needs clearer service information. Services are unverified. Ask Jonathan to review the scope and arrange a permission-based follow-up next Monday.';
function fixture(){
 const db={users:[{id:'am',name:'Fictional Trainee',role:'account_manager',tenantId:1,active:true},{id:'owner',name:'Fictional Owner',role:'owner',tenantId:1,active:true}],settings:{v9:{timeEntries:[]}}},routes=[];let actor=db.users[0],durable;
 const app={get:(p,a,f)=>routes.push({method:'GET',p,f}),post:(p,a,f)=>routes.push({method:'POST',p,f})};
 const save=async()=>{durable=JSON.parse(JSON.stringify(db));};
 R.register(app,{auth(){},getDb:()=>db,tenantForRead:()=>1,writer(){},isReadOnly:()=>false,save});
 const source=fs.readFileSync(path.join(root,'server.js'),'utf8'),start=source.indexOf("app.post('/api/training/progress'"),end=source.indexOf("app.post('/api/training/attempts'",start+1);
 new vm.Script(source.slice(start,end)).runInNewContext({app,auth(){},db,TRAINING_SYSTEM:T,SBC_AM_ACADEMY_360:A,SBC_AM_ACADEMY_GATES:G,SBC_AM_TRAINING_BUDGET:B,SBC_RUNTIME_READ_ONLY:false,MYSQL_RECOVERY_REQUIRED:false,MYSQL_RECOVERY_EVALUATED:true,SBC_V6649_REQUIRE_WRITER(){},saveData:save,audit(){},now:()=>new Date().toISOString()});
 async function fetch(url,opt={}){
  const u=new URL(url,'https://academy.test'),method=opt.method||'GET',body=opt.body?JSON.parse(opt.body):{};let code=200,data;
  if(u.pathname==='/api/training')data={ok:true,...T.getForUser(db,actor)};
  else if(u.pathname.startsWith('/api/training/courses/')){const s=T.ensureState(db),course=T.findCourse(s,A.COURSE_ID);data={ok:true,course,summary:T.courseSummary(s,actor.id,course)};}
  else if(u.pathname==='/api/v9/time/status')data={ok:true,open:db.settings.v9.timeEntries.find(e=>e.userId===actor.id&&!e.clockOut)||null};
  else if(u.pathname==='/api/v9/time/clock'){if(body.action==='in')db.settings.v9.timeEntries.push({id:'shift',userId:actor.id,mode:'training',clockIn:new Date().toISOString()});else db.settings.v9.timeEntries.find(e=>!e.clockOut).clockOut=new Date().toISOString();data={ok:true};}
  else {const route=routes.find(r=>r.method===method&&new RegExp('^'+r.p.replace(/:[^/]+/g,'([^/]+)')+'$').test(u.pathname));assert(route,'known API '+u.pathname);const match=u.pathname.match(new RegExp('^'+route.p.replace(/:[^/]+/g,'([^/]+)')+'$')),names=route.p.match(/:[^/]+/g)||[],params=Object.fromEntries(names.map((n,i)=>[n.slice(1),match[i+1]]));await route.f({user:actor,params,body,query:Object.fromEntries(u.searchParams)},{setHeader(){},status(n){code=n;return this},json(d){data=d;return this}});}
  return {ok:code<400,status:code,json:async()=>JSON.parse(JSON.stringify(data))};
 }
 return {db,fetch,owner:()=>actor=db.users[1],durable:()=>durable};
}
async function wait(fn,label){for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('UI timeout: '+label);}
async function ui(file,f){const dom=new JSDOM(fs.readFileSync(path.join(root,'public',file+'.html'),'utf8'),{url:'https://academy.test/'+file+'.html',runScripts:'outside-only'});dom.window.fetch=f.fetch;const errors=[];dom.window.addEventListener('error',e=>errors.push(e.message));dom.window.eval(fs.readFileSync(path.join(root,'public',file==='sbc-am-academy'?'sbc-am-academy-v1.js':'sbc-am-academy-owner-v2.js'),'utf8'));return {dom,d:dom.window.document,errors};}
function check(d,name,value){const el=d.querySelector('input[name="'+name+'"][value="'+value+'"]');assert(el,name+' option '+value);el.checked=true;}
function click(d,id){const e=d.getElementById(id);assert(e&&!e.disabled,'enabled '+id);e.click();}
function submit(dom,id){const form=dom.window.document.getElementById(id);form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));}
const plans={
 'am-01':[{truth:1,approval:2,next:0},[1,2,1]],'am-02':[{systems:0,scope:0,handoff:0},[0,0,1]],'am-03':[{systems:0,facts:2,next:0},[1,2,1]],'am-04':[{contact:1,facts:2,next:0},[1,2,0]],'am-05':[{discover:0,facts:2,next:0},[1,0,1]],'am-07':[{preview:2,truth:1,next:0},[1,0,2]],'am-06':[{scope:0,approval:2,renew:1},[0,1,2]],'am-08':[{objection:1,discover:0,approval:2},[0,1,2]],'am-10':[{payment:1,approval:2,handoff:0},[1,2,0]],'am-09':[{next:0,contact:1,facts:2},[1,0,2]],'am-11':[{handoff:0,renew:1,next:0},[2,0,1]],'am-12':[{discover:0,preview:2,scope:0,payment:1,contact:1,handoff:0,renew:1},[1,0,2]]};
test('learner interface completes all twelve Spanish labs and owner interface records review, extension, certification and history',async()=>{
 const f=fixture(),learner=await ui('sbc-am-academy',f),{dom,d}=learner;
 try{
  await wait(()=>d.querySelectorAll('#quizQuestions input').length===9,'initial lesson');assert.equal(d.querySelectorAll('#moduleNav button').length,3);assert.equal(d.getElementById('labSubmit').disabled,true);
  click(d,'clockInAcademy');await wait(()=>!d.getElementById('labSubmit').disabled,'official clock');click(d,'langEs');await wait(()=>d.documentElement.lang==='es'&&d.querySelector('#quizQuestions legend')?.textContent.includes('función'),'Spanish questions');
  for(const [id,[decisions,answers]] of Object.entries(plans)){
   await wait(()=>d.querySelector('input[name="quiz-'+id+'-q1"]'),'lesson '+id);
   click(d,'tabKnowledge');d.getElementById('proofSample').open=true;for(const [key,value] of Object.entries(decisions))check(d,'lab-'+key,value);d.getElementById('caseArtifact').value=note;
   if(['am-08','am-12'].includes(id)){for(let n=0;n<3;n++)d.querySelector('#dialogueChoices button').click();}
   submit(dom,'labForm');await wait(()=>d.getElementById('labFeedback').textContent.startsWith('APROBADO'),'sample '+id);await wait(()=>!d.getElementById('submitPractice').disabled,'sample saved');
   d.getElementById('practiceResponse').value=note;click(d,'submitPractice');await wait(()=>d.getElementById('practiceStatus').textContent.includes('guardada'),'practice '+id);await wait(()=>!d.getElementById('quizSubmit').disabled,'practice saved');
   click(d,'tabKnowledge');answers.forEach((n,i)=>check(d,'quiz-'+id+'-q'+(i+1),n));submit(dom,'quiz');await wait(()=>d.getElementById('quizFeedback').textContent.startsWith('APROBADO'),'knowledge '+id);await wait(()=>!d.getElementById('quizSubmit').disabled,'lesson persisted');
   if(id!=='am-12')click(d,'nextLesson');
  }
  assert.equal(d.getElementById('percent').textContent,'100%');assert.equal(G.hasClearance(T.ensureState(f.db),f.db,'am'),false);assert.deepEqual(learner.errors,[]);
 }finally{dom.window.close();}
 f.owner();const owner=await ui('sbc-am-academy-owner',f),od=owner.d;
 try{
  await wait(()=>od.querySelectorAll('#rubricFields select').length===7,'owner roster');assert.equal(od.getElementById('certifySubmit').disabled,true);
  for(const select of od.querySelectorAll('#rubricFields select'))select.value='4';od.getElementById('observationMethod').value='live_observed';od.getElementById('observedEnglish').checked=true;od.getElementById('observedSpanish').checked=true;od.getElementById('observationEvidence').value='Fictional observed session A with Jonathan';od.getElementById('reviewNotes').value='Observed discovery, demonstration, payment boundaries and account handoff in professional English and Spanish.';submit(owner.dom,'rubricForm');await wait(()=>!od.getElementById('certifySubmit').disabled,'rubric pass');
  assert(od.getElementById('reviewHistory').textContent.includes('100%'));assert(od.getElementById('assessmentHistory').textContent.includes('am-01'));
  od.getElementById('extensionMinutes').value='60';od.getElementById('extensionShifts').value='1';od.getElementById('extensionReason').value='One targeted supervised practice extension approved.';submit(owner.dom,'extensionForm');await wait(()=>od.getElementById('ownerStats').textContent.includes('/540'),'actual extension');
  od.getElementById('certificationReason').value='All practical knowledge and observed bilingual evidence meets the standard.';click(od,'certifySubmit');await wait(()=>G.hasClearance(T.ensureState(f.db),f.db,'am'),'certification');await wait(()=>od.getElementById('certificationHistory').textContent.includes('Certified'),'certificate history');
  assert.equal(G.hasClearance(T.ensureState(f.durable()),f.durable(),'am'),true,'clearance survives serialized restart');assert.deepEqual(owner.errors,[]);
 }finally{owner.dom.window.close();}
});
