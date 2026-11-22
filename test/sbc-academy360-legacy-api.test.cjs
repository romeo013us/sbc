'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const T=require('../enterprise/training-system-v2.js'),A=require('../enterprise/sbc-am-academy-v1.cjs'),G=require('../enterprise/sbc-am-academy-gates-v1.cjs'),B=require('../enterprise/sbc-am-training-budget-v1.cjs');
const source=require('../scripts/v66166-stage-academy-practice.cjs').patchServer(fs.readFileSync(path.join(__dirname,'../server.js'),'utf8'));
function handler(route,next,db){let fn;const start=source.indexOf("app.post('"+route+"'"),end=source.indexOf("app.post('"+next+"'",start+1);assert(start>0&&end>start);const context={app:{post:(p,auth,f)=>{fn=f;}},auth(){},db,TRAINING_SYSTEM:T,SBC_AM_ACADEMY_360:A,SBC_AM_ACADEMY_GATES:G,SBC_AM_TRAINING_BUDGET:B,SBC_RUNTIME_READ_ONLY:false,MYSQL_RECOVERY_REQUIRED:false,MYSQL_RECOVERY_EVALUATED:true,SBC_V6649_REQUIRE_WRITER(){},trainingAdmin:r=>['owner','manager'].includes(r),trainingOwner:r=>r==='owner',saveData:async()=>{},audit(){},now:()=>new Date().toISOString()};new vm.Script(source.slice(start,end)).runInNewContext(context);return fn;}
async function request(fn,user,body={},params={}){let status=200,data;await fn({user,body,params},{setHeader(){},status(n){status=n;return this},json(d){data=d;return this}});return {status,data};}
const response='Fictional evidence of a verified website need and an owner-reviewed next step. The customer has requested a demonstration next Monday and has not paid.';
function fixture(){const db={users:[{id:'am',role:'account_manager',active:true,tenantId:1},{id:'owner',role:'owner',active:true,tenantId:1}],settings:{v9:{timeEntries:[{id:'c',userId:'am',mode:'training',clockIn:new Date(Date.now()-60000).toISOString()}]}}};const s=T.ensureState(db);B.start(s,db,'am');s.attempts.push({id:'quiz',userId:'am',courseId:A.COURSE_ID,moduleId:'am-01',type:'sbc_am_objective',score:100,passed:true},{id:'practice',userId:'am',courseId:A.COURSE_ID,moduleId:'am-01',type:'sbc_am_roleplay_for_owner_review',response});return {db,s};}
test('the actual generic progress endpoint cannot complete a lesson without its structured work sample',async()=>{
 const {db,s}=fixture(),fn=handler('/api/training/progress','/api/training/attempts',db),body={courseId:A.COURSE_ID,moduleId:'am-01',status:'completed',evidence:response};
 let r=await request(fn,db.users[0],body);assert.equal(r.status,422);assert.equal(T.progressFor(s,'am',A.COURSE_ID,'am-01'),undefined);
 s.attempts.push({id:'lab',userId:'am',courseId:A.COURSE_ID,moduleId:'am-01',type:'sbc_am_work_sample',score:100,passed:true,workSample:{version:'2026.11.22.2',critical:[]}});
 r=await request(fn,db.users[0],body);assert.equal(r.status,200);assert.equal(r.data.progress.status,'completed');
});
test('the actual generic review and certification endpoints cannot bypass the dedicated owner rubric',async()=>{
 const {db,s}=fixture();const review=handler('/api/training/review/:attemptId','/api/training/certification/:userId',db),r=await request(review,db.users[1],{score:100,passed:true},{attemptId:'practice'});assert.equal(r.status,403);assert.equal(s.attempts.find(a=>a.id==='practice').passed,undefined);
 const start=source.indexOf("app.post('/api/training/certification/:userId'"),end=source.indexOf('\n});',start)+4;let fn;new vm.Script(source.slice(start,end)).runInNewContext({app:{post:(p,a,f)=>fn=f},auth(){},db,trainingOwner:r=>r==='owner'});
 const cert=await request(fn,db.users[1],{status:'Certified',courseId:A.COURSE_ID},{userId:'am'});assert.equal(cert.status,403);assert.equal(s.certifications.length,0);
});
test('mounted legacy middleware retains its shared lock after response finish until helper persistence resolves',async()=>{
 const {EventEmitter}=require('node:events'),{db}=fixture();let middleware,release,saveEntered,legacyReturned=false,academyRan=false;
 const entered=new Promise(r=>saveEntered=r),start=source.indexOf('// SBC_V66166_TRAINING_SERIALIZATION'),end=source.indexOf("app.get('/api/training'",start);
 new vm.Script(source.slice(start,end)).runInNewContext({app:{use:(path,fn)=>{assert.equal(path,'/api/training');middleware=fn;}},TRAINING_SYSTEM:T,db});
 const res=new EventEmitter();res.headersSent=false;res.status=()=>res;res.json=()=>res;
 middleware({},res,()=>{T.createCourse(db,async()=>{saveEntered();await new Promise(r=>release=r)},{id:'owner'},{title:'Fictional researcher improvement'});legacyReturned=true;res.headersSent=true;res.emit('finish');});
 await entered;assert.equal(legacyReturned,true);
 const academy=T.withWriteLock(db,async()=>{academyRan=true;});await new Promise(r=>setImmediate(r));assert.equal(academyRan,false,'response finish is not durable completion');release();await academy;assert.equal(academyRan,true);
});
