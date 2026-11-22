'use strict';
const TRAINING=require('../enterprise/training-system-v2.js');
const ACADEMY=require('../enterprise/sbc-am-academy-v1.cjs');
const GATES=require('../enterprise/sbc-am-academy-gates-v1.cjs');
const BUDGET=require('../enterprise/sbc-am-training-budget-v1.cjs');
const PRACTICE=require('../enterprise/sbc-am-practice-v2.cjs');
const DIALOGUE=require('../enterprise/sbc-am-dialogue-v2.cjs');
const PREFIX='/api/sbc/academy-am/v1';
const clone=v=>JSON.parse(JSON.stringify(v));
function fail(code,status=422){throw Object.assign(Error(code),{status});}
function error(res,e){const code=String(e?.message||'ACADEMY_ERROR').slice(0,120);return res.status(e?.status||(/RECOVERY|WRITER|READ_ONLY/.test(code)?423:400)).json({ok:false,error:code});}
function register(app,{auth,getDb,tenantForRead,writer,isReadOnly,save}={}){
 if(!app||[auth,getDb,tenantForRead,writer,isReadOnly,save].some(f=>typeof f!=='function'))throw Error('ACADEMY_ROUTE_DEPENDENCIES_REQUIRED');
 // Serialize writes; detached training state prevents a failed save granting access.
 function context(req,write=false){
  const user=req.user,db=getDb(),tenant=Number(tenantForRead(req));
  if(!user||user.active===false||!['owner','account_manager'].includes(user.role))fail('ACADEMY_ROLE_DENIED',403);
  if(!Number.isSafeInteger(tenant)||tenant<1)fail('TENANT_CONTEXT_REQUIRED',403);
  if(user.tenantId!=null&&Number(user.tenantId)!==tenant)fail('ACADEMY_TENANT_DENIED',403);
  if(!db||!Array.isArray(db.users))fail('ACADEMY_DB_UNAVAILABLE',503);
  if(!db.users.some(u=>String(u.id)===String(user.id)&&u.active!==false&&u.role===user.role&&Number(u.tenantId??tenant)===tenant))fail('ACADEMY_SESSION_NOT_FOUND',403);
  if(write){if(isReadOnly())fail('ACADEMY_RECOVERY_READ_ONLY',423);writer();}
  const work={...db,settings:{...db.settings,trainingCenterV2:db.settings?.trainingCenterV2?clone(db.settings.trainingCenterV2):undefined}};
  const s=TRAINING.ensureState(work),course=TRAINING.findCourse(s,ACADEMY.COURSE_ID);
  if(!course||!TRAINING.userCanSeeCourse(user,course))fail('ACADEMY_COURSE_UNAVAILABLE',403);
  return {s,course,user,db,work,tenant};
 }
 function target(ctx,id){const u=ctx.db.users.find(u=>String(u.id)===String(id)&&Number(u.tenantId??ctx.tenant)===ctx.tenant&&u.role==='account_manager');if(!u)fail('ACADEMY_EMPLOYEE_NOT_FOUND',404);ctx.subjectId=u.id;return u;}
 function owner(ctx){if(ctx.user.role!=='owner')fail('ACADEMY_OWNER_ONLY',403);}
 function learner(ctx,id){
  if(ctx.user.role!=='account_manager')fail('ACADEMY_ACCOUNT_MANAGER_ONLY',403);
  if(!TRAINING.findModule(ctx.s,ACADEMY.COURSE_ID,id))fail('ACADEMY_LESSON_UNKNOWN',404);
  if(!GATES.canEnter(ctx.s,ctx.user.id,id))fail('ACADEMY_PREVIOUS_STAGE_REQUIRED',423);
  BUDGET.permit(ctx.s,ctx.db,ctx.user.id);
 }
 function attempt(ctx,id,payload){return new TRAINING.TrainingSessionController(ctx.work,()=>{}).submitAttempt(ctx.user.id,ACADEMY.COURSE_ID,id,payload);}
 async function persist(ctx){
  const previous=ctx.db.settings?.trainingCenterV2;
  const subject=ctx.subjectId||ctx.user.id;GATES.beginPendingWrite(ctx.db,subject);
  ctx.db.settings=ctx.db.settings||{};ctx.s.updatedAt=new Date().toISOString();ctx.db.settings.trainingCenterV2=ctx.s;
  try{await save()}catch(e){if(ctx.db.settings.trainingCenterV2===ctx.s)ctx.db.settings.trainingCenterV2=previous;throw Object.assign(Error('ACADEMY_SAVE_NOT_CONFIRMED'),{status:503});}
  finally{GATES.endPendingWrite(ctx.db,subject);}
 }
 function get(path,fn){app.get(PREFIX+path,auth,async(req,res)=>{try{res.setHeader('Cache-Control','no-store');return res.json({ok:true,...await fn(context(req),req)});}catch(e){return error(res,e)}});}
 function post(path,fn){app.post(PREFIX+path,auth,async(req,res)=>{
  const run=TRAINING.withWriteLock(getDb(),async()=>{const ctx=context(req,true),result=await fn(ctx,req);await persist(ctx);return result;});
  try{res.setHeader('Cache-Control','no-store');return res.json({ok:true,...await run});}catch(e){return error(res,e)}
 });}
 const budget=(ctx,id=ctx.user.id)=>BUDGET.asOf(ctx.s,ctx.db,id);
 get('/window',ctx=>({...budget(ctx),readOnly:isReadOnly(),payrollAuthority:'SBC official employee time clock',wagesNotCapped:true}));
 post('/window/start',ctx=>{if(ctx.user.role!=='account_manager')fail('ACADEMY_ACCOUNT_MANAGER_ONLY',403);const r=BUDGET.start(ctx.s,ctx.db,ctx.user.id);if(r.created)TRAINING.recordEvent(ctx.s,{type:'am_training_shift_started',userId:ctx.user.id,courseId:ACADEMY.COURSE_ID,actorId:ctx.user.id});return {...budget(ctx),created:r.created};});
 get('/owner/readiness/:userId',(ctx,req)=>{owner(ctx);const u=target(ctx,req.params.userId);return {userId:String(u.id),readiness:GATES.readiness(ctx.s,ctx.db,u.id),budget:budget(ctx,u.id)};});
 get('/owner/roster',(ctx,req)=>{
  owner(ctx);
  const users=ctx.db.users.filter(u=>u.role==='account_manager'&&Number(u.tenantId??ctx.tenant)===ctx.tenant);
  return {readOnly:isReadOnly(),rubric:PRACTICE.rubric(req.query?.lang),learners:users.map(u=>({id:String(u.id),name:u.name||u.username||String(u.id),active:u.active!==false,
   readiness:GATES.readiness(ctx.s,ctx.db,u.id),clearance:GATES.hasClearance(ctx.s,ctx.db,u.id),budget:budget(ctx,u.id),
   attempts:ctx.s.attempts.filter(a=>String(a.userId)===String(u.id)&&a.courseId===ACADEMY.COURSE_ID).slice(-150).reverse(),
   latestSamples:GATES.MODULES.map(id=>GATES.latestAttempt(ctx.s,u.id,id,'sbc_am_work_sample')).filter(Boolean),
   capstone:GATES.latestAttempt(ctx.s,u.id,'am-12','sbc_am_roleplay_for_owner_review'),
   certifications:ctx.s.certifications.filter(c=>String(c.userId)===String(u.id)&&c.courseId===ACADEMY.COURSE_ID),
   reviews:ctx.s.reviews.filter(r=>String(r.userId)===String(u.id)).slice(-20).reverse()}))};
 });
 post('/owner/override/:userId',(ctx,req)=>{
  owner(ctx);const u=target(ctx,req.params.userId);
  BUDGET.extend(ctx.s,ctx.db,u.id,{ownerId:ctx.user.id,reason:req.body?.reason,minutes:req.body?.minutes,shifts:req.body?.shifts});
  TRAINING.recordEvent(ctx.s,{type:'am_training_owner_extension',userId:u.id,actorId:ctx.user.id,minutes:req.body.minutes,shifts:req.body.shifts});
  return {ownerAuthorized:true,budget:budget(ctx,u.id)};
 });
 get('/quiz/:moduleId',(ctx,req)=>{
  const id=req.params.moduleId,questions=ACADEMY.publicQuestions(id,req.query?.lang);
  if(!questions)fail('ACADEMY_LESSON_UNKNOWN',404);
  if(ctx.user.role!=='owner'&&!GATES.canEnter(ctx.s,ctx.user.id,id))fail('ACADEMY_PREVIOUS_STAGE_REQUIRED',423);
  return {courseId:ACADEMY.COURSE_ID,moduleId:id,passScore:90,questions,serverGraded:true,certificationOwnerOnly:true};
 });
 post('/quiz/:moduleId',(ctx,req)=>{
  const id=req.params.moduleId;learner(ctx,id);const result=ACADEMY.grade(id,req.body?.answers,req.body?.lang);
  const a=attempt(ctx,id,{type:'sbc_am_objective',answers:req.body.answers,score:result.score,passed:result.passed,response:'Server-graded '+ACADEMY.VERSION});a.lang=PRACTICE.language(req.body?.lang);
  return {attemptId:a.id,serverGraded:true,...result,certified:false,automaticOutreach:false};
 });
 get('/lab/:moduleId',(ctx,req)=>{
  const id=req.params.moduleId,lab=PRACTICE.publicLab(id,req.query?.lang);if(!lab)fail('ACADEMY_LAB_UNKNOWN',404);
  if(ctx.user.role!=='owner'&&!GATES.canEnter(ctx.s,ctx.user.id,id))fail('ACADEMY_PREVIOUS_STAGE_REQUIRED',423);
  return {lab,dialogue:DIALOGUE.nodes(PRACTICE.language(req.query?.lang))};
 });
 post('/lab/:moduleId',(ctx,req)=>{
  const id=req.params.moduleId;learner(ctx,id);const result=PRACTICE.gradeLab(id,req.body);
  if(['am-08','am-12'].includes(id)){const dialogue=DIALOGUE.grade(req.body?.dialogue,req.body?.lang);result.dialogue=dialogue;result.passed=result.passed&&dialogue.passed;result.critical=[...result.critical,...dialogue.critical];}
  const a=attempt(ctx,id,{type:'sbc_am_work_sample',response:result.artifact,score:result.score,passed:result.passed});
  a.workSample=result;return {attemptId:a.id,...result,certified:false};
 });
 post('/roleplay/:moduleId',(ctx,req)=>{
  const id=req.params.moduleId;learner(ctx,id);const response=PRACTICE.validateText(req.body?.response);
  const a=attempt(ctx,id,{type:'sbc_am_roleplay_for_owner_review',response,score:null,passed:null});a.academyVersion=PRACTICE.VERSION;
  return {submitted:true,attemptId:a.id,review:'OWNER_REVIEW_REQUIRED',certified:false,liveCallsAuthorized:false};
 });
 post('/owner/review/:attemptId',(ctx,req)=>{
  owner(ctx);const a=ctx.s.attempts.find(a=>String(a.id)===String(req.params.attemptId)&&a.courseId===ACADEMY.COURSE_ID);if(!a)fail('ACADEMY_ATTEMPT_NOT_FOUND',404);
  target(ctx,a.userId);
  if(a.moduleId!=='am-12'||a.type!=='sbc_am_roleplay_for_owner_review')fail('ACADEMY_CAPSTONE_REVIEW_ONLY',403);
  const latest=GATES.latestAttempt(ctx.s,a.userId,'am-12','sbc_am_roleplay_for_owner_review');
  if(latest?.id!==a.id)fail('ACADEMY_LATEST_CAPSTONE_REQUIRED',409);
  const result=PRACTICE.gradeRubric(req.body),now=new Date().toISOString();
  a.academyRubric={...result,reviewId:TRAINING.uid('rubric'),reviewedAt:now,reviewedBy:ctx.user.id};a.score=result.score;a.passed=result.passed;a.status=result.passed?'passed':'failed';a.reviewedAt=now;a.reviewedBy=ctx.user.id;a.reviewNotes=result.notes;
  ctx.s.reviews.push({id:TRAINING.uid('review'),userId:a.userId,attemptId:a.id,status:result.passed?'Passed':'Failed',score:result.score,notes:result.notes,reviewedAt:now,reviewedBy:ctx.user.id,rubric:a.academyRubric});
  TRAINING.recordEvent(ctx.s,{type:'am_capstone_rubric_review',userId:a.userId,actorId:ctx.user.id,attemptId:a.id,score:result.score,passed:result.passed});
  return {review:result,readiness:GATES.readiness(ctx.s,ctx.db,a.userId)};
 });
 post('/owner/certification/:userId',(ctx,req)=>{
  owner(ctx);const u=target(ctx,req.params.userId),status=req.body?.status;
  if(!['Certified','Revoked'].includes(status))fail('ACADEMY_CERTIFICATION_STATUS_INVALID');
  const reason=PRACTICE.validateText(req.body?.reason,20,1500);
  if(status==='Certified'&&!GATES.readiness(ctx.s,ctx.db,u.id).ready)fail('ACADEMY_READINESS_INCOMPLETE',409);
  const capstone=GATES.latestAttempt(ctx.s,u.id,'am-12','sbc_am_roleplay_for_owner_review');
  const cert=TRAINING.certify(ctx.work,()=>{},ctx.user,u.id,{status,reason,courseId:ACADEMY.COURSE_ID});cert.academyVersion=PRACTICE.VERSION;cert.capstoneAttemptId=capstone?.id||null;cert.capstoneReviewId=capstone?.academyRubric?.reviewId||null;
  return {certification:cert,clearance:GATES.hasClearance(ctx.s,ctx.db,u.id)};
 });
 return {courseId:ACADEMY.COURSE_ID,role:'account_manager',externals:false,ownerCertificationRequired:true};
}
module.exports={register};
