'use strict';
/* SBC Account Manager Academy · fail-closed certification and stage policy.
 * Practice gate is limited to account_manager role; owner access stays intact.
 * No state mutation, payment, dialer, or network side effects.
 */
const COURSE_ID='sbc-account-manager-mastery-20261122';
const STAGES=Object.freeze([
 Object.freeze(['am-01','am-02','am-03']),
 Object.freeze(['am-04','am-05']),
 Object.freeze(['am-07']),
 Object.freeze(['am-06','am-08']),
 Object.freeze(['am-10']),
 Object.freeze(['am-09']),
 Object.freeze(['am-11']),
 Object.freeze(['am-12'])
]);
const MODULES=STAGES.flat();
function stageIndex(moduleId){return STAGES.findIndex(s=>s.includes(String(moduleId)));}
function completed(s,userId,id){
 return Boolean((s?.progress||[]).some(p=>String(p.userId)===String(userId)&&p.courseId===COURSE_ID&&p.moduleId===id&&['completed','passed'].includes(String(p.status))));
}
function objectivePassed(s,userId,id){
 return Boolean((s?.attempts||[]).some(a=>String(a.userId)===String(userId)&&a.courseId===COURSE_ID&&a.moduleId===id&&a.type==='sbc_am_objective'&&a.passed===true&&Number(a.score)>=90));
}
function practiced(s,userId,id){
 return Boolean((s?.attempts||[]).some(a=>String(a.userId)===String(userId)&&a.courseId===COURSE_ID&&a.moduleId===id&&a.type==='sbc_am_roleplay_for_owner_review'&&String(a.response||'').length>=80));
}
function canEnter(s,userId,moduleId){
 const index=stageIndex(moduleId);
 if(index<0)return false;
 return STAGES.slice(0,index).every(ids=>ids.every(id=>completed(s,userId,id)&&objectivePassed(s,userId,id)&&practiced(s,userId,id)));
}
function readiness(s,db,userId){
 const user=(db?.users||[]).find(u=>String(u.id)===String(userId));
 if(!user||user.role!=='account_manager'||user.active===false)return {ready:false,code:'NOT_AN_ACTIVE_ACCOUNT_MANAGER',done:0,total:MODULES.length,missing:MODULES.slice()};
 const missing=MODULES.filter(id=>!completed(s,userId,id)||!objectivePassed(s,userId,id)||!practiced(s,userId,id));
 const ownerIds=new Set((db.users||[]).filter(u=>u.role==='owner'&&u.active!==false).map(u=>String(u.id)));
 const capstone=(s?.attempts||[]).some(a=>String(a.userId)===String(userId)&&a.courseId===COURSE_ID&&a.moduleId==='am-12'&&a.type==='sbc_am_roleplay_for_owner_review'&&a.passed===true&&Number(a.score)>=90&&ownerIds.has(String(a.reviewedBy||'')));
 return {ready:missing.length===0&&capstone,code:missing.length?'LESSONS_INCOMPLETE':capstone?'READY_FOR_OWNER_CERTIFICATION':'CAPSTONE_OWNER_OBSERVATION_REQUIRED',done:MODULES.length-missing.length,total:MODULES.length,missing,capstoneOwnerPassed:capstone};
}
function hasClearance(s,db,userId){
 const facts=readiness(s,db,userId);
 if(!facts.ready)return false;
 const certifications=(s?.certifications||[]).filter(c=>String(c.userId)===String(userId)&&c.courseId===COURSE_ID);
 const latest=certifications[certifications.length-1];
 return latest?.status==='Certified'&&String(latest.certifiedBy||'')!==''&&
 (db?.users||[]).some(u=>String(u.id)===String(latest.certifiedBy)&&u.role==='owner'&&u.active!==false);
}
function isTrainingSafeRoute(method,url){
 const verb=String(method||'').toUpperCase(),path=String(url||'').split('?')[0];
 if(!path.startsWith('/api/')||path.includes('%')||path.includes('..')||path.includes('//')||path.includes('\\'))return false;
 if(verb==='GET')return ['/api/me','/api/training','/api/v9/time/status','/api/sbc/academy-am/v1/window'].includes(path)||
 /^\/api\/training\/courses\/sbc-account-manager-mastery-20261122$/.test(path)||
 /^\/api\/sbc\/academy-am\/v1\/quiz\/am-[0-9]{2}$/.test(path);
 if(verb==='POST')return ['/api/logout','/api/v9/time/clock','/api/training/progress','/api/sbc/academy-am/v1/window/start'].includes(path)||
 /^\/api\/sbc\/academy-am\/v1\/(?:quiz|roleplay)\/am-[0-9]{2}$/.test(path);
 return false;
}
module.exports=Object.freeze({COURSE_ID,STAGES,MODULES,stageIndex,completed,objectivePassed,practiced,canEnter,readiness,hasClearance,isTrainingSafeRoute});
