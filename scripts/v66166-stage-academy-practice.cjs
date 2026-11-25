'use strict';
const MARK='SBC_V66166_ACADEMY_PRACTICE';
function replaceOnce(s,from,to){if(s.split(from).length!==2)throw Error('ACADEMY_V2_STAGE_ANCHOR_DRIFT');return s.replace(from,to);}
function patchServer(source){
 let s=String(source||'');
 if(s.includes("require('./routes/sbc-legacy-training-v2.cjs').createTrainingHandlers")){
  const fs=require('node:fs'),path=require('node:path');
  const legacy=fs.readFileSync(path.join(__dirname,'../routes/sbc-legacy-training-v2.cjs'),'utf8');
  for(const token of ['// '+MARK,'SBC_AM_ACADEMY_GATES.objectivePassed','SBC_AM_ACADEMY_GATES.practiced','SBC_AM_ACADEMY_GATES.labPassed','ACADEMY_DEDICATED_OWNER_REVIEW_REQUIRED','ACADEMY_DEDICATED_CERTIFICATION_REQUIRED','ACADEMY_SERVER_GRADED_ASSESSMENT_ONLY','ACADEMY_RECOVERY_READ_ONLY','ACADEMY_WRITER_LEASE_REQUIRED','SBC_AM_TRAINING_BUDGET.permit'])if(!legacy.includes(token))throw Error('ACADEMY_EXTRACTED_GUARD_MISSING_'+token);
  for(const [route,handler] of [['/api/training/progress','progress'],['/api/training/attempts','attempts'],['/api/training/review/:attemptId','review'],['/api/training/certification/:userId','certification']]){
   const mount="app.post('"+route+"',auth,async(req,res)=>{return SBC_LEGACY_TRAINING."+handler+"(req,res)});";
   if(s.split(mount).length!==2)throw Error('ACADEMY_EXTRACTED_MOUNT_DRIFT_'+handler);
  }
  if(!s.includes('// SBC_V66166_TRAINING_SERIALIZATION')||!s.includes('TRAINING_SYSTEM.withWriteLock(db,'))throw Error('ACADEMY_EXTRACTED_LOCK_REQUIRED');
  return s;
 }
 if(s.includes('// '+MARK))return s;
 s=require('./v66165-stage-am-academy.cjs').patchServer(s);
 s=replaceOnce(s,"if(!SBC_AM_ACADEMY_GATES.objectivePassed(s,uid,m.id)||!SBC_AM_ACADEMY_GATES.practiced(s,uid,m.id)||String(b.evidence||'').trim().length<80)","if(!SBC_AM_ACADEMY_GATES.objectivePassed(s,uid,m.id)||!SBC_AM_ACADEMY_GATES.practiced(s,uid,m.id)||!SBC_AM_ACADEMY_GATES.labPassed(s,uid,m.id)||String(b.evidence||'').trim().length<80)");
 s=replaceOnce(s,"if(academyAttempt?.courseId===SBC_AM_ACADEMY_360.COURSE_ID){", "// "+MARK+" · Dedicated owner rubric and certification APIs are authoritative.\n  if(academyAttempt?.courseId===SBC_AM_ACADEMY_360.COURSE_ID)return res.status(403).json({ok:false,error:'ACADEMY_DEDICATED_OWNER_REVIEW_REQUIRED'});\n  if(academyAttempt?.courseId===SBC_AM_ACADEMY_360.COURSE_ID){");
 s=replaceOnce(s,"if(certUser?.role==='account_manager'&&req.body?.status==='Certified'){", "if(certUser?.role==='account_manager')return res.status(403).json({ok:false,error:'ACADEMY_DEDICATED_CERTIFICATION_REQUIRED'});\n  if(certUser?.role==='account_manager'&&req.body?.status==='Certified'){");
 return s;
}
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),file=path.join(__dirname,'../server.js'),before=fs.readFileSync(file,'utf8'),after=patchServer(before);if(process.argv.includes('--apply')){if(process.env.SBC_V66166_ISOLATED_STAGE!=='YES')throw Error('ACADEMY_V2_DISPOSABLE_STAGE_ONLY');fs.writeFileSync(file,after);}if(process.argv.includes('--verify-staged')&&after!==before)throw Error('ACADEMY_V2_NOT_STAGED');console.log('SBC Academy V66.166 '+(before===after?'STAGED_VERIFIED':'STAGE_READY'));}
module.exports={MARK,patchServer};
