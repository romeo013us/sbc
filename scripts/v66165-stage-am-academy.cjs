'use strict';
/* SBC Academy 360 · GoDaddy isolated staging build only.
 * Harden legacy Training V2 routes against bypassing Academy skill checks,
 * authorizations and recorded owner certification. No canonical server writes.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66165_AM_ACADEMY_360';
const REG="app.get('/api/training',auth,async(req,res)=>{";
const ROLE="  if(u.role==='account_manager'&&!SBC_ACCOUNT_MANAGER_ROLE_GATE.allowAccountManager(u,req.method,req.path)) {";
const PROGRESS="  const prior=TRAINING_SYSTEM.progressFor(s,uid,c.id,m.id)||{};";
const ATTEMPT="  const attempt=new TRAINING_SYSTEM.TrainingSessionController(db,()=>{}).submitAttempt(uid,c.id,m.id,{type:b.type,answers:b.answers,response:b.response,score:b.score,passed:b.passed});";
const REVIEW="  try{const r=TRAINING_SYSTEM.reviewAttempt(db,()=>saveData(),req.user,String(req.params.attemptId),req.body?.score,req.body?.passed,req.body?.notes);";
const CERT="  try{const c=TRAINING_SYSTEM.certify(db,()=>saveData(),req.user,String(req.params.userId),req.body||{});";
function once(s,a,b,label){if(s.split(a).length!==2)throw Error('AM_ACADEMY_ANCHOR_DRIFT_'+label);return s.replace(a,b)}
function patchServer(raw){
 let s=String(raw||'');if(s.includes('// '+MARK))return s;
 if(!s.includes('SBC_V6649_REQUIRE_WRITER')||!s.includes('TRAINING_SYSTEM.ensureState'))throw Error('AM_ACADEMY_FULL_SERVER_REQUIRED');
 const register=[
 '// '+MARK+' · Dedicated AM curriculum, score integrity, training budget and owner approval',
 "const SBC_AM_ACADEMY_360=require('./enterprise/sbc-am-academy-v1.cjs');",
 "const SBC_AM_ACADEMY_GATES=require('./enterprise/sbc-am-academy-gates-v1.cjs');",
 "const SBC_AM_TRAINING_BUDGET=require('./enterprise/sbc-am-training-budget-v1.cjs');",
 "require('./routes/sbc-am-academy-v1.cjs').register(app,{",
 ' auth,',
 ' getDb:()=>db,',
 ' tenantForRead:req=>requireRequestTenant(req),',
 ' isReadOnly:()=>SBC_RUNTIME_READ_ONLY||MYSQL_RECOVERY_REQUIRED||!MYSQL_RECOVERY_EVALUATED,',
 ' writer:()=>SBC_V6649_REQUIRE_WRITER(),',
 ' save:()=>saveData()',
 '});',
 ''
 ].join('\n');
 s=once(s,REG,register+REG,'ROUTE');
 const perimeter=[
 "  // Before certification an Account Manager may access Academy and clocking only.",
 "  if(u.role==='account_manager'&&!SBC_AM_ACADEMY_GATES.isTrainingSafeRoute(req.method,req.path)&&",
 "     !SBC_AM_ACADEMY_GATES.hasClearance(db.settings?.trainingCenterV2,db,u.id)){",
 "     res.setHeader('Cache-Control','no-store');",
 "     return res.status(403).json({ok:false,error:'ACCOUNT_MANAGER_ACADEMY_CERTIFICATION_REQUIRED'});",
 "  }",
 ''
 ].join('\n');
 s=once(s,ROLE,perimeter+ROLE,'ROLE_GATE');
 const progressGate=[
 "  if(c.id===SBC_AM_ACADEMY_360.COURSE_ID){",
 "    if(SBC_RUNTIME_READ_ONLY||MYSQL_RECOVERY_REQUIRED||!MYSQL_RECOVERY_EVALUATED)return res.status(423).json({ok:false,error:'ACADEMY_RECOVERY_READ_ONLY'});",
 "    try{SBC_V6649_REQUIRE_WRITER()}catch(e){return res.status(423).json({ok:false,error:'ACADEMY_WRITER_LEASE_REQUIRED'})}",
 "    if(req.user.role!=='account_manager'||!SBC_AM_ACADEMY_GATES.canEnter(s,uid,m.id))return res.status(423).json({ok:false,error:'ACADEMY_STAGE_LOCKED'});",
 "    if(['completed','passed'].includes(status)){",
 "      if(status==='passed')return res.status(403).json({ok:false,error:'ACADEMY_OWNER_REVIEW_REQUIRED'});",
 "      if(!SBC_AM_ACADEMY_GATES.objectivePassed(s,uid,m.id)||!SBC_AM_ACADEMY_GATES.practiced(s,uid,m.id)||String(b.evidence||'').trim().length<80)return res.status(422).json({ok:false,error:'ACADEMY_QUIZ_AND_ROLEPLAY_REQUIRED'});",
 "      try{SBC_AM_TRAINING_BUDGET.permit(s,db,uid)}catch(e){return res.status(e.status||423).json({ok:false,error:String(e.message)})}",
 "    }",
 "  }",
 ''
 ].join('\n');
 s=once(s,PROGRESS,progressGate+PROGRESS,'PROGRESS');
 const attempts=[
 "  if(c.id===SBC_AM_ACADEMY_360.COURSE_ID)return res.status(403).json({ok:false,error:'ACADEMY_SERVER_GRADED_ASSESSMENT_ONLY'});",
 ''
 ].join('\n');
 s=once(s,ATTEMPT,attempts+ATTEMPT,'ATTEMPTS');
 const reviewGate=[
 "  const academyAttempt=(TRAINING_SYSTEM.ensureState(db).attempts||[]).find(x=>String(x.id)===String(req.params.attemptId));",
 "  if(academyAttempt?.courseId===SBC_AM_ACADEMY_360.COURSE_ID){",
 "   if(req.user.role!=='owner')return res.status(403).json({ok:false,error:'ACADEMY_OWNER_REVIEW_ONLY'});",
 "   if(academyAttempt.type==='sbc_am_objective')return res.status(403).json({ok:false,error:'ACADEMY_OBJECTIVE_GRADES_IMMUTABLE'});",
 "  }",
 ''
 ].join('\n');
 s=once(s,REVIEW,reviewGate+REVIEW,'REVIEW');
 const certGate=[
 "  const certUser=(db.users||[]).find(x=>String(x.id)===String(req.params.userId));",
 "  if(certUser?.role==='account_manager'&&req.body?.status==='Certified'){",
 "   if(req.body?.courseId!==SBC_AM_ACADEMY_360.COURSE_ID)return res.status(422).json({ok:false,error:'ACADEMY_CURRENT_COURSE_REQUIRED'});",
 "   const decision=SBC_AM_ACADEMY_GATES.readiness(TRAINING_SYSTEM.ensureState(db),db,certUser.id);",
 "   if(!decision.ready)return res.status(409).json({ok:false,error:'ACADEMY_READINESS_INCOMPLETE',...decision});",
 "   if(SBC_RUNTIME_READ_ONLY||MYSQL_RECOVERY_REQUIRED||!MYSQL_RECOVERY_EVALUATED)return res.status(423).json({ok:false,error:'ACADEMY_RECOVERY_READ_ONLY'});",
 "   try{SBC_V6649_REQUIRE_WRITER()}catch(e){return res.status(423).json({ok:false,error:'ACADEMY_WRITER_LEASE_REQUIRED'})}",
 "  }",
 ''
 ].join('\n');
 s=once(s,CERT,certGate+CERT,'CERTIFICATION');
 return s;
}
if(require.main===module){
 const target=path.resolve(__dirname,'../server.js'),before=fs.readFileSync(target,'utf8'),after=patchServer(before);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66165_ISOLATED_STAGE!=='YES')throw Error('AM_ACADEMY_DISPOSABLE_STAGE_ONLY');
  fs.writeFileSync(target,after);
 }
 if(process.argv.includes('--verify-staged')&&before!==after)throw Error('AM_ACADEMY_MISSING_FROM_RELEASE');
 console.log('[SBC V66.165] Account Manager Academy '+(before===after?'STAGED_VERIFIED':'STAGE_READY'));
}
module.exports={MARK,patchServer};
