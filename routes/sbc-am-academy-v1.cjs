'use strict';
/* Server-graded, tenant-scoped Academy 360 assessment.
 * The answer key is never delivered by this router. A passing quiz does NOT
 * change employee permissions, issue a certificate, authorize outbound, or
 * create a customer contact. All attempts remain owner-reviewable.
 */
const TRAINING=require('../enterprise/training-system-v2.js');
const ACADEMY=require('../enterprise/sbc-am-academy-v1.cjs');
const GATES=require('../enterprise/sbc-am-academy-gates-v1.cjs');
const BUDGET=require('../enterprise/sbc-am-training-budget-v1.cjs');
const PREFIX='/api/sbc/academy-am/v1';
function error(res,e){
 const code=String(e?.message||'ACADEMY_ERROR').slice(0,120);
 return res.status(e?.status||(/RECOVERY|WRITER|READ_ONLY/.test(code)?423:400)).json({ok:false,error:code});
}
function register(app,{auth,getDb,tenantForRead,writer,isReadOnly,save}={}){
 if(!app||typeof auth!=='function'||typeof getDb!=='function'||typeof tenantForRead!=='function'||typeof writer!=='function'||typeof isReadOnly!=='function'||typeof save!=='function')
  throw Error('ACADEMY_ROUTE_DEPENDENCIES_REQUIRED');
 function context(req,write=false){
  const user=req.user,db=getDb(),tenant=Number(tenantForRead(req));
  if(!user||user.active===false||!['owner','account_manager'].includes(String(user.role)))
   throw Object.assign(Error('ACADEMY_ROLE_DENIED'),{status:403});
  if(!Number.isSafeInteger(tenant)||tenant<1)
   throw Object.assign(Error('TENANT_CONTEXT_REQUIRED'),{status:403});
  if(user.tenantId!=null&&Number(user.tenantId)!==tenant)
   throw Object.assign(Error('ACADEMY_TENANT_DENIED'),{status:403});
  if(!db||!Array.isArray(db.users))
   throw Object.assign(Error('ACADEMY_DB_UNAVAILABLE'),{status:503});
  const actual=db.users.find(u=>String(u.id)===String(user.id)&&u.active!==false&&String(u.role)===String(user.role)&&Number(u.tenantId??tenant)===tenant);
  if(!actual)throw Object.assign(Error('ACADEMY_SESSION_NOT_FOUND'),{status:403});
  const s=TRAINING.ensureState(db),course=TRAINING.findCourse(s,ACADEMY.COURSE_ID);
  if(!course||!TRAINING.userCanSeeCourse(user,course))
   throw Object.assign(Error('ACADEMY_COURSE_UNAVAILABLE'),{status:403});
  if(!Array.isArray(s.amTrainingWindows))s.amTrainingWindows=[];
  if(write){
   if(isReadOnly())throw Object.assign(Error('ACADEMY_RECOVERY_READ_ONLY'),{status:423});
   writer();
  }
  return {s,course,user,db,tenant};
 }
 function lesson(ctx,id){
  const module=TRAINING.findModule(ctx.s,ACADEMY.COURSE_ID,id);
  if(!module)return null;
  return module;
 }
 app.get(PREFIX+'/window',auth,(req,res)=>{
  try{res.setHeader('Cache-Control','no-store');const ctx=context(req);
   return res.json({ok:true,...BUDGET.asOf(ctx.s,ctx.db,ctx.user.id),payrollAuthority:'SBC official employee time clock',wagesNotCapped:true});
  }catch(e){return error(res,e)}
 });
 app.post(PREFIX+'/window/start',auth,async(req,res)=>{
  try{res.setHeader('Cache-Control','no-store');const ctx=context(req,true);
   if(ctx.user.role!=='account_manager')return res.status(403).json({ok:false,error:'ACADEMY_ACCOUNT_MANAGER_ONLY'});
   const result=BUDGET.start(ctx.s,ctx.db,ctx.user.id);
   if(result.created){TRAINING.recordEvent(ctx.s,{type:'am_training_shift_started',userId:ctx.user.id,courseId:ACADEMY.COURSE_ID,actorId:ctx.user.id});await save()}
   return res.json({ok:true,...BUDGET.asOf(ctx.s,ctx.db,ctx.user.id),created:result.created});
  }catch(e){return error(res,e)}
 });
 app.get(PREFIX+'/owner/readiness/:userId',auth,(req,res)=>{
  try{res.setHeader('Cache-Control','no-store');const ctx=context(req);
   if(ctx.user.role!=='owner')return res.status(403).json({ok:false,error:'ACADEMY_OWNER_ONLY'});
   const target=ctx.db.users.find(u=>String(u.id)===String(req.params.userId)&&Number(u.tenantId??ctx.tenant)===ctx.tenant);
   if(!target||target.role!=='account_manager')return res.status(404).json({ok:false,error:'ACADEMY_EMPLOYEE_NOT_FOUND'});
   return res.json({ok:true,userId:String(target.id),readiness:GATES.readiness(ctx.s,ctx.db,target.id),budget:BUDGET.asOf(ctx.s,ctx.db,target.id)});
  }catch(e){return error(res,e)}
 });
 app.post(PREFIX+'/owner/override/:userId',auth,async(req,res)=>{
  try{res.setHeader('Cache-Control','no-store');const ctx=context(req,true);
   if(ctx.user.role!=='owner')return res.status(403).json({ok:false,error:'ACADEMY_OWNER_ONLY'});
   const target=ctx.db.users.find(u=>String(u.id)===String(req.params.userId)&&Number(u.tenantId??ctx.tenant)===ctx.tenant);
   if(!target||target.role!=='account_manager')return res.status(404).json({ok:false,error:'ACADEMY_EMPLOYEE_NOT_FOUND'});
   BUDGET.extend(ctx.s,ctx.db,target.id,{ownerId:ctx.user.id,reason:req.body?.reason,minutes:req.body?.minutes,shifts:req.body?.shifts});
   TRAINING.recordEvent(ctx.s,{type:'am_training_owner_extension',userId:String(target.id),actorId:ctx.user.id,minutes:req.body?.minutes,shifts:req.body?.shifts});
   await save();return res.json({ok:true,ownerAuthorized:true,budget:BUDGET.asOf(ctx.s,ctx.db,target.id)});
  }catch(e){return error(res,e)}
 });
 app.get(PREFIX+'/quiz/:moduleId',auth,(req,res)=>{
  try{
   res.setHeader('Cache-Control','no-store');
   const ctx=context(req),module=lesson(ctx,req.params.moduleId),qs=ACADEMY.publicQuestions(req.params.moduleId);
   if(!module||!qs)return res.status(404).json({ok:false,error:'ACADEMY_LESSON_UNKNOWN'});
   if(!GATES.canEnter(ctx.s,ctx.user.id,module.id))return res.status(423).json({ok:false,error:'ACADEMY_PREVIOUS_STAGE_REQUIRED'});
   return res.json({ok:true,courseId:ACADEMY.COURSE_ID,moduleId:module.id,passScore:90,
    questions:qs,serverGraded:true,certificationOwnerOnly:true});
  }catch(e){return error(res,e)}
 });
 app.post(PREFIX+'/quiz/:moduleId',auth,async(req,res)=>{
  try{
   res.setHeader('Cache-Control','no-store');
   const ctx=context(req,true),module=lesson(ctx,req.params.moduleId);
   if(!module)return res.status(404).json({ok:false,error:'ACADEMY_LESSON_UNKNOWN'});
   if(!GATES.canEnter(ctx.s,ctx.user.id,module.id))return res.status(423).json({ok:false,error:'ACADEMY_PREVIOUS_STAGE_REQUIRED'});
   if(ctx.user.role!=='account_manager')return res.status(403).json({ok:false,error:'ACADEMY_ACCOUNT_MANAGER_ONLY'});
   BUDGET.permit(ctx.s,ctx.db,ctx.user.id);
   const result=ACADEMY.grade(module.id,req.body?.answers);
   const attempt=new TRAINING.TrainingSessionController(ctx.db,()=>{}).submitAttempt(ctx.user.id,ACADEMY.COURSE_ID,module.id,{
    type:'sbc_am_objective',answers:req.body.answers,score:result.score,passed:result.passed,
    response:'Server-graded objective quiz; question set '+ACADEMY.VERSION});
   await save();
   return res.json({ok:true,attemptId:attempt.id,serverGraded:true,score:result.score,
    passed:result.passed,correct:result.correct,total:result.total,details:result.details,
    remediation:result.remediation,certified:false,automaticOutreach:false});
  }catch(e){return error(res,e)}
 });
 app.post(PREFIX+'/roleplay/:moduleId',auth,async(req,res)=>{
  try{
   res.setHeader('Cache-Control','no-store');
   const ctx=context(req,true),module=lesson(ctx,req.params.moduleId);
   if(!module)return res.status(404).json({ok:false,error:'ACADEMY_LESSON_UNKNOWN'});
   if(!GATES.canEnter(ctx.s,ctx.user.id,module.id))return res.status(423).json({ok:false,error:'ACADEMY_PREVIOUS_STAGE_REQUIRED'});
   if(ctx.user.role!=='account_manager')return res.status(403).json({ok:false,error:'ACADEMY_ACCOUNT_MANAGER_ONLY'});
   BUDGET.permit(ctx.s,ctx.db,ctx.user.id);
   const response=String(req.body?.response||'').trim();
   if(response.length<80||response.length>3500)
    throw Object.assign(Error('ACADEMY_ROLEPLAY_LENGTH_80_TO_3500'),{status:422});
   if(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(response)||/(?:\+?1[\s-]?)?\(?[2-9]\d{2}\)?[\s.-]?[2-9]\d{2}[\s.-]?\d{4}/.test(response))
    throw Object.assign(Error('ACADEMY_POSSIBLE_REAL_CONTACT_DATA'),{status:422});
   const attempt=new TRAINING.TrainingSessionController(ctx.db,()=>{}).submitAttempt(ctx.user.id,ACADEMY.COURSE_ID,module.id,{
    type:'sbc_am_roleplay_for_owner_review',response,score:null,passed:null});
   await save();
   return res.json({ok:true,submitted:true,attemptId:attempt.id,review:'OWNER_REVIEW_REQUIRED',
    certified:false,liveCallsAuthorized:false});
  }catch(e){return error(res,e)}
 });
 return {courseId:ACADEMY.COURSE_ID,role:'account_manager',externals:false,ownerCertificationRequired:true};
}
module.exports={register};
