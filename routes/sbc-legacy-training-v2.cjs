'use strict';
// Legacy training handlers extracted without changing API contracts or Academy gates.
function createTrainingHandlers(getContext){return {
catalog:async(req,res)=>{
 const {db,MYSQL_RECOVERY_REQUIRED,TRAINING_SYSTEM,trainingAdmin,trainingOwner,saveData,requireRequestTenant,now,audit,SBC_AM_ACADEMY_360,SBC_AM_ACADEMY_GATES,SBC_AM_TRAINING_BUDGET,SBC_RUNTIME_READ_ONLY,MYSQL_RECOVERY_EVALUATED,SBC_V6649_REQUIRE_WRITER}=getContext();
  // Recovery-safe catalog reads use a detached snapshot. Catalog repair and assignment
  // generation must not mutate the live in-memory DB or call saveData while MySQL is locked.
  const recoveryReadOnly=Boolean(MYSQL_RECOVERY_REQUIRED);
  const sourceDb=recoveryReadOnly?{...db,settings:{...(db.settings||{}),trainingCenterV2:db.settings?.trainingCenterV2?JSON.parse(JSON.stringify(db.settings.trainingCenterV2)):undefined},users:Array.isArray(db.users)?db.users:[]}:db;
  const repairedTraining=TRAINING_SYSTEM.repairCourseCatalog(sourceDb), s=repairedTraining.state; const before=s.assignments.length; const beforeCourses=s.courses.length;
  TRAINING_SYSTEM.ensureAssignmentsForWorkforce(sourceDb,s);
  if(!recoveryReadOnly && (repairedTraining.changed || s.assignments.length!==before || s.courses.length!==beforeCourses)) await TRAINING_SYSTEM.saveState(db,s,()=>saveData());
  const userTraining=TRAINING_SYSTEM.getForUser(sourceDb,req.user);
  res.setHeader('Cache-Control','no-store');
  const recoveryMeta=recoveryReadOnly?{recoveryRequired:true,readOnly:true,message:'Recovery lock active. Training content is available for viewing; progress, assignments and certification writes are paused until authoritative MySQL recovery is verified.'}:{};
  if(trainingAdmin(req.user.role)) return res.json({ok:true,mode:'admin',...userTraining,...recoveryMeta,dashboard:TRAINING_SYSTEM.dashboard(sourceDb,s),library:TRAINING_SYSTEM.overview(sourceDb,s,{includeArchived:String(req.query?.includeArchived||'true')!=='false'})});
  return res.json({ok:true,mode:'employee',...userTraining,...recoveryMeta});

},
telemetry:async(req,res)=>{
 const {db,MYSQL_RECOVERY_REQUIRED,TRAINING_SYSTEM,trainingAdmin,trainingOwner,saveData,requireRequestTenant,now,audit,SBC_AM_ACADEMY_360,SBC_AM_ACADEMY_GATES,SBC_AM_TRAINING_BUDGET,SBC_RUNTIME_READ_ONLY,MYSQL_RECOVERY_EVALUATED,SBC_V6649_REQUIRE_WRITER}=getContext();try{const b=req.body||{},s=TRAINING_SYSTEM.ensureState(db),verb=String(b.verb||'experienced').slice(0,80),courseId=String(b.courseId||'').slice(0,160),moduleId=String(b.moduleId||'').slice(0,160);if(!courseId)return res.status(400).json({error:'courseId is required.'});const allowed=['opened','started','completed','assessed','reviewed','lab_started','lab_submitted','experienced'];if(!allowed.includes(verb))return res.status(400).json({error:'Unsupported training telemetry verb.'});const statement={actor:{id:String(req.user.id),name:String(req.user.name||req.user.username||'')},verb:{id:`https://sbc.local/xapi/verbs/${verb}`,display:verb},object:{id:`https://sbc.local/training/${encodeURIComponent(courseId)}${moduleId?`/${encodeURIComponent(moduleId)}`:''}`,definition:{type:String(b.objectType||'training')}},context:{tenantId:requireRequestTenant(req),surface:String(b.context?.surface||'sbc-academy'),architecture:String(b.context?.architecture||'telemetry-first')},result:b.result||null,timestamp:now()};TRAINING_SYSTEM.recordEvent(s,{type:'learning_telemetry',userId:req.user.id,courseId,moduleId,verb,statement});await TRAINING_SYSTEM.saveState(db,s,()=>saveData());res.status(201).json({ok:true,statement});}catch(e){res.status(400).json({error:e.message||'Training telemetry failed.'})}
},
history:async(req,res)=>{
 const {db,MYSQL_RECOVERY_REQUIRED,TRAINING_SYSTEM,trainingAdmin,trainingOwner,saveData,requireRequestTenant,now,audit,SBC_AM_ACADEMY_360,SBC_AM_ACADEMY_GATES,SBC_AM_TRAINING_BUDGET,SBC_RUNTIME_READ_ONLY,MYSQL_RECOVERY_EVALUATED,SBC_V6649_REQUIRE_WRITER}=getContext();
  if(!trainingAdmin(req.user.role)&&req.user.id!==String(req.params.userId))return res.status(403).json({error:'Training history access denied.'});
  const s=TRAINING_SYSTEM.ensureState(db); res.json({ok:true,...TRAINING_SYSTEM.history(db,s,String(req.params.userId))});

},
course:async(req,res)=>{
 const {db,MYSQL_RECOVERY_REQUIRED,TRAINING_SYSTEM,trainingAdmin,trainingOwner,saveData,requireRequestTenant,now,audit,SBC_AM_ACADEMY_360,SBC_AM_ACADEMY_GATES,SBC_AM_TRAINING_BUDGET,SBC_RUNTIME_READ_ONLY,MYSQL_RECOVERY_EVALUATED,SBC_V6649_REQUIRE_WRITER}=getContext();
  const recoveryReadOnly=Boolean(MYSQL_RECOVERY_REQUIRED);
  const sourceDb=recoveryReadOnly?{...db,settings:{...(db.settings||{}),trainingCenterV2:db.settings?.trainingCenterV2?JSON.parse(JSON.stringify(db.settings.trainingCenterV2)):undefined},users:Array.isArray(db.users)?db.users:[]}:db;
  const s=recoveryReadOnly?TRAINING_SYSTEM.repairCourseCatalog(sourceDb).state:TRAINING_SYSTEM.ensureState(sourceDb),c=TRAINING_SYSTEM.findCourse(s,req.params.courseId);
  if(!c)return res.status(404).json({error:'Training course not found.'});
  if(!TRAINING_SYSTEM.userCanSeeCourse(req.user,c))return res.status(403).json({error:'This training course is not available to your role.'});
  res.setHeader('Cache-Control','no-store');
  res.json({ok:true,course:c,summary:TRAINING_SYSTEM.courseSummary(s,req.user.id,c),recoveryRequired:recoveryReadOnly,readOnly:recoveryReadOnly,message:recoveryReadOnly?'Recovery lock active. Course content is view-only; progress and assessments cannot be saved.':''});

},
progress:async(req,res)=>{
 const {db,MYSQL_RECOVERY_REQUIRED,TRAINING_SYSTEM,trainingAdmin,trainingOwner,saveData,requireRequestTenant,now,audit,SBC_AM_ACADEMY_360,SBC_AM_ACADEMY_GATES,SBC_AM_TRAINING_BUDGET,SBC_RUNTIME_READ_ONLY,MYSQL_RECOVERY_EVALUATED,SBC_V6649_REQUIRE_WRITER}=getContext();
  const b=req.body||{},s=TRAINING_SYSTEM.ensureState(db),uid=req.user.id,c=TRAINING_SYSTEM.findCourse(s,b.courseId),m=TRAINING_SYSTEM.findModule(s,b.courseId,b.moduleId);
  if(!c||!m)return res.status(404).json({error:'Training course or module not found.'});
  if(!TRAINING_SYSTEM.userCanSeeCourse(req.user,c))return res.status(403).json({error:'This training is not available to your role.'});
  const allowed=TRAINING_SYSTEM.PROGRESS_STATUSES||['not_started','in_progress','completed','passed','failed','retraining_required'];
  const status=allowed.includes(String(b.status))?String(b.status):'in_progress';
  if(c.id===SBC_AM_ACADEMY_360.COURSE_ID){
    if(SBC_RUNTIME_READ_ONLY||MYSQL_RECOVERY_REQUIRED||!MYSQL_RECOVERY_EVALUATED)return res.status(423).json({ok:false,error:'ACADEMY_RECOVERY_READ_ONLY'});
    try{SBC_V6649_REQUIRE_WRITER()}catch(e){return res.status(423).json({ok:false,error:'ACADEMY_WRITER_LEASE_REQUIRED'})}
    if(req.user.role!=='account_manager'||!SBC_AM_ACADEMY_GATES.canEnter(s,uid,m.id))return res.status(423).json({ok:false,error:'ACADEMY_STAGE_LOCKED'});
    if(['completed','passed'].includes(status)){
      if(status==='passed')return res.status(403).json({ok:false,error:'ACADEMY_OWNER_REVIEW_REQUIRED'});
      if(!SBC_AM_ACADEMY_GATES.objectivePassed(s,uid,m.id)||!SBC_AM_ACADEMY_GATES.practiced(s,uid,m.id)||!SBC_AM_ACADEMY_GATES.labPassed(s,uid,m.id)||String(b.evidence||'').trim().length<80)return res.status(422).json({ok:false,error:'ACADEMY_QUIZ_AND_ROLEPLAY_REQUIRED'});
      try{SBC_AM_TRAINING_BUDGET.permit(s,db,uid)}catch(e){return res.status(e.status||423).json({ok:false,error:String(e.message)})}
    }
  }
  const prior=TRAINING_SYSTEM.progressFor(s,uid,c.id,m.id)||{};
  const p=TRAINING_SYSTEM.upsertProgress(s,{userId:uid,courseId:c.id,moduleId:m.id,status,score:b.score==null?(prior.score??null):Math.max(0,Math.min(100,Number(b.score))),studySeconds:Math.max(Number(prior.studySeconds||0),Number(b.studySeconds||0)),startedAt:prior.startedAt||now(),completedAt:['completed','passed'].includes(status)?(prior.completedAt||now()):prior.completedAt||null,evidence:String(b.evidence||prior.evidence||'').slice(0,5000),notes:String(b.notes||prior.notes||'').slice(0,3000)});
  TRAINING_SYSTEM.recordEvent(s,{type:'progress',userId:uid,courseId:c.id,moduleId:m.id,status,actorId:req.user.id}); await TRAINING_SYSTEM.saveState(db,s,()=>saveData()); audit(req.user,'training_progress_v2',`Training ${status}: ${c.title} / ${m.title}`,{userId:uid,courseId:c.id,moduleId:m.id});
  res.json({ok:true,progress:p,summary:TRAINING_SYSTEM.courseSummary(s,uid,c)});

},
attempts:async(req,res)=>{
 const {db,MYSQL_RECOVERY_REQUIRED,TRAINING_SYSTEM,trainingAdmin,trainingOwner,saveData,requireRequestTenant,now,audit,SBC_AM_ACADEMY_360,SBC_AM_ACADEMY_GATES,SBC_AM_TRAINING_BUDGET,SBC_RUNTIME_READ_ONLY,MYSQL_RECOVERY_EVALUATED,SBC_V6649_REQUIRE_WRITER}=getContext();
  const b=req.body||{},s=TRAINING_SYSTEM.ensureState(db),uid=req.user.id,c=TRAINING_SYSTEM.findCourse(s,b.courseId),m=TRAINING_SYSTEM.findModule(s,b.courseId,b.moduleId);
  if(!c||!m)return res.status(404).json({error:'Training course or module not found.'});
  if(!TRAINING_SYSTEM.userCanSeeCourse(req.user,c))return res.status(403).json({error:'This training is not available to your role.'});
  if(c.id===SBC_AM_ACADEMY_360.COURSE_ID)return res.status(403).json({ok:false,error:'ACADEMY_SERVER_GRADED_ASSESSMENT_ONLY'});
  const attempt=new TRAINING_SYSTEM.TrainingSessionController(db,()=>{}).submitAttempt(uid,c.id,m.id,{type:b.type,answers:b.answers,response:b.response,score:b.score,passed:b.passed});
  // submitAttempt writes the state; persist through the normal application save path as well.
  await TRAINING_SYSTEM.saveState(db,s,()=>saveData()); audit(req.user,'training_attempt_submitted_v2',`Submitted assessment: ${m.title}`,{attemptId:attempt.id,userId:uid}); res.json({ok:true,attempt});

},
assign:async(req,res)=>{
 const {db,MYSQL_RECOVERY_REQUIRED,TRAINING_SYSTEM,trainingAdmin,trainingOwner,saveData,requireRequestTenant,now,audit,SBC_AM_ACADEMY_360,SBC_AM_ACADEMY_GATES,SBC_AM_TRAINING_BUDGET,SBC_RUNTIME_READ_ONLY,MYSQL_RECOVERY_EVALUATED,SBC_V6649_REQUIRE_WRITER}=getContext();
  if(!trainingAdmin(req.user.role))return res.status(403).json({error:'Owner or manager access required.'});
  try{const a=TRAINING_SYSTEM.assignCourse(db,()=>saveData(),req.user,String(req.body?.userId||''),String(req.body?.courseId||''),req.body?.required!==false); audit(req.user,'training_assignment_v2','Assigned training course',{userId:a.userId,courseId:a.courseId}); res.json({ok:true,assignment:a});}catch(e){res.status(400).json({error:e.message})}

},
review:async(req,res)=>{
 const {db,MYSQL_RECOVERY_REQUIRED,TRAINING_SYSTEM,trainingAdmin,trainingOwner,saveData,requireRequestTenant,now,audit,SBC_AM_ACADEMY_360,SBC_AM_ACADEMY_GATES,SBC_AM_TRAINING_BUDGET,SBC_RUNTIME_READ_ONLY,MYSQL_RECOVERY_EVALUATED,SBC_V6649_REQUIRE_WRITER}=getContext();
  if(!trainingAdmin(req.user.role))return res.status(403).json({error:'Owner or manager access required.'});
  const academyAttempt=(TRAINING_SYSTEM.ensureState(db).attempts||[]).find(x=>String(x.id)===String(req.params.attemptId));
  // SBC_V66166_ACADEMY_PRACTICE · Dedicated owner rubric and certification APIs are authoritative.
  if(academyAttempt?.courseId===SBC_AM_ACADEMY_360.COURSE_ID)return res.status(403).json({ok:false,error:'ACADEMY_DEDICATED_OWNER_REVIEW_REQUIRED'});
  if(academyAttempt?.courseId===SBC_AM_ACADEMY_360.COURSE_ID){
   if(req.user.role!=='owner')return res.status(403).json({ok:false,error:'ACADEMY_OWNER_REVIEW_ONLY'});
   if(academyAttempt.type==='sbc_am_objective')return res.status(403).json({ok:false,error:'ACADEMY_OBJECTIVE_GRADES_IMMUTABLE'});
  }
  try{const r=TRAINING_SYSTEM.reviewAttempt(db,()=>saveData(),req.user,String(req.params.attemptId),req.body?.score,req.body?.passed,req.body?.notes); audit(req.user,'training_assessment_review_v2','Reviewed training assessment',{attemptId:req.params.attemptId,score:r.attempt.score,passed:r.attempt.passed}); res.json({ok:true,...r});}catch(e){res.status(400).json({error:e.message})}

},
certification:async(req,res)=>{
 const {db,MYSQL_RECOVERY_REQUIRED,TRAINING_SYSTEM,trainingAdmin,trainingOwner,saveData,requireRequestTenant,now,audit,SBC_AM_ACADEMY_360,SBC_AM_ACADEMY_GATES,SBC_AM_TRAINING_BUDGET,SBC_RUNTIME_READ_ONLY,MYSQL_RECOVERY_EVALUATED,SBC_V6649_REQUIRE_WRITER}=getContext();
  if(!trainingOwner(req.user.role))return res.status(403).json({error:'Owner approval required.'});
  const certUser=(db.users||[]).find(x=>String(x.id)===String(req.params.userId));
  if(certUser?.role==='account_manager')return res.status(403).json({ok:false,error:'ACADEMY_DEDICATED_CERTIFICATION_REQUIRED'});
  if(certUser?.role==='account_manager'&&req.body?.status==='Certified'){
   if(req.body?.courseId!==SBC_AM_ACADEMY_360.COURSE_ID)return res.status(422).json({ok:false,error:'ACADEMY_CURRENT_COURSE_REQUIRED'});
   const decision=SBC_AM_ACADEMY_GATES.readiness(TRAINING_SYSTEM.ensureState(db),db,certUser.id);
   if(!decision.ready)return res.status(409).json({ok:false,error:'ACADEMY_READINESS_INCOMPLETE',...decision});
   if(SBC_RUNTIME_READ_ONLY||MYSQL_RECOVERY_REQUIRED||!MYSQL_RECOVERY_EVALUATED)return res.status(423).json({ok:false,error:'ACADEMY_RECOVERY_READ_ONLY'});
   try{SBC_V6649_REQUIRE_WRITER()}catch(e){return res.status(423).json({ok:false,error:'ACADEMY_WRITER_LEASE_REQUIRED'})}
  }
  try{const c=TRAINING_SYSTEM.certify(db,()=>saveData(),req.user,String(req.params.userId),req.body||{}); audit(req.user,'training_certification_v2',`Training certification ${c.status}`,{userId:c.userId,certificationId:c.id}); res.json({ok:true,certification:c});}catch(e){res.status(400).json({error:e.message})}

},
createCourse:async(req,res)=>{
 const {db,MYSQL_RECOVERY_REQUIRED,TRAINING_SYSTEM,trainingAdmin,trainingOwner,saveData,requireRequestTenant,now,audit,SBC_AM_ACADEMY_360,SBC_AM_ACADEMY_GATES,SBC_AM_TRAINING_BUDGET,SBC_RUNTIME_READ_ONLY,MYSQL_RECOVERY_EVALUATED,SBC_V6649_REQUIRE_WRITER}=getContext();
  if(!trainingOwner(req.user.role))return res.status(403).json({error:'Owner access required to create training.'});
  try{const c=TRAINING_SYSTEM.createCourse(db,()=>saveData(),req.user,req.body||{}); res.status(201).json({ok:true,course:c});}catch(e){res.status(400).json({error:e.message})}

},
newVersion:async(req,res)=>{
 const {db,MYSQL_RECOVERY_REQUIRED,TRAINING_SYSTEM,trainingAdmin,trainingOwner,saveData,requireRequestTenant,now,audit,SBC_AM_ACADEMY_360,SBC_AM_ACADEMY_GATES,SBC_AM_TRAINING_BUDGET,SBC_RUNTIME_READ_ONLY,MYSQL_RECOVERY_EVALUATED,SBC_V6649_REQUIRE_WRITER}=getContext();
  if(!trainingOwner(req.user.role))return res.status(403).json({error:'Owner access required to create a new training version.'});
  try{const c=TRAINING_SYSTEM.cloneCourseVersion(db,()=>saveData(),req.user,String(req.params.courseId),String(req.body?.version||''));res.status(201).json({ok:true,course:c});}catch(e){res.status(400).json({error:e.message})}

},
addModule:async(req,res)=>{
 const {db,MYSQL_RECOVERY_REQUIRED,TRAINING_SYSTEM,trainingAdmin,trainingOwner,saveData,requireRequestTenant,now,audit,SBC_AM_ACADEMY_360,SBC_AM_ACADEMY_GATES,SBC_AM_TRAINING_BUDGET,SBC_RUNTIME_READ_ONLY,MYSQL_RECOVERY_EVALUATED,SBC_V6649_REQUIRE_WRITER}=getContext();
  if(!trainingOwner(req.user.role))return res.status(403).json({error:'Owner access required to edit training content.'});
  try{const m=TRAINING_SYSTEM.addModule(db,()=>saveData(),req.user,String(req.params.courseId),req.body||{}); res.status(201).json({ok:true,module:m});}catch(e){res.status(400).json({error:e.message})}

},
patchCourse:async(req,res)=>{
 const {db,MYSQL_RECOVERY_REQUIRED,TRAINING_SYSTEM,trainingAdmin,trainingOwner,saveData,requireRequestTenant,now,audit,SBC_AM_ACADEMY_360,SBC_AM_ACADEMY_GATES,SBC_AM_TRAINING_BUDGET,SBC_RUNTIME_READ_ONLY,MYSQL_RECOVERY_EVALUATED,SBC_V6649_REQUIRE_WRITER}=getContext();
  if(!trainingOwner(req.user.role))return res.status(403).json({error:'Owner access required.'});
  try{const c=TRAINING_SYSTEM.patchCourse(db,()=>saveData(),req.user,String(req.params.courseId),req.body||{}); res.json({ok:true,course:c});}catch(e){res.status(400).json({error:e.message})}

},
archiveCourse:async(req,res)=>{
 const {db,MYSQL_RECOVERY_REQUIRED,TRAINING_SYSTEM,trainingAdmin,trainingOwner,saveData,requireRequestTenant,now,audit,SBC_AM_ACADEMY_360,SBC_AM_ACADEMY_GATES,SBC_AM_TRAINING_BUDGET,SBC_RUNTIME_READ_ONLY,MYSQL_RECOVERY_EVALUATED,SBC_V6649_REQUIRE_WRITER}=getContext();
  if(!trainingOwner(req.user.role))return res.status(403).json({error:'Owner access required.'});
  try{const c=TRAINING_SYSTEM.patchCourse(db,()=>saveData(),req.user,String(req.params.courseId),{status:'archived'}); res.json({ok:true,course:c});}catch(e){res.status(400).json({error:e.message})}

}
};}
module.exports={createTrainingHandlers};
