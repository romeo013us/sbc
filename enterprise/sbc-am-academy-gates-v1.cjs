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
const PRACTICE=require('./sbc-am-practice-v2.cjs');
const pendingWrites=new WeakMap();
function beginPendingWrite(db,userId){let users=pendingWrites.get(db);if(!users){users=new Set();pendingWrites.set(db,users);}users.add(String(userId));}
function endPendingWrite(db,userId){pendingWrites.get(db)?.delete(String(userId));}
function latestAttempt(s,userId,id,type){return (s?.attempts||[]).filter(a=>String(a.userId)===String(userId)&&a.courseId===COURSE_ID&&a.moduleId===id&&a.type===type).at(-1)||null;}
function stageIndex(moduleId){return STAGES.findIndex(s=>s.includes(String(moduleId)));}
function completed(s,userId,id){
 return Boolean((s?.progress||[]).some(p=>String(p.userId)===String(userId)&&p.courseId===COURSE_ID&&p.moduleId===id&&['completed','passed'].includes(String(p.status))));
}
function objectivePassed(s,userId,id){
 const a=latestAttempt(s,userId,id,'sbc_am_objective');return a?.passed===true&&Number(a.score)>=90;
}
function practiced(s,userId,id){
 const a=latestAttempt(s,userId,id,'sbc_am_roleplay_for_owner_review');return Boolean(a&&String(a.response||'').trim().length>=20&&a.passed!==false);
}
function labPassed(s,userId,id){
 const a=latestAttempt(s,userId,id,'sbc_am_work_sample');
 return Boolean(a?.passed===true&&Number(a.score)>=90&&a.workSample?.version===PRACTICE.VERSION&&a.workSample?.critical?.length===0);
}
function canEnter(s,userId,moduleId){
 const index=stageIndex(moduleId);
 if(index<0)return false;
 return STAGES.slice(0,index).every(ids=>ids.every(id=>completed(s,userId,id)&&objectivePassed(s,userId,id)&&practiced(s,userId,id)&&labPassed(s,userId,id)));
}
function readiness(s,db,userId){
 const user=(db?.users||[]).find(u=>String(u.id)===String(userId));
 if(!user||user.role!=='account_manager'||user.active===false)return {ready:false,code:'NOT_AN_ACTIVE_ACCOUNT_MANAGER',done:0,total:MODULES.length,missing:MODULES.slice()};
 const modules=MODULES.map(id=>({id,completed:completed(s,userId,id),knowledge:objectivePassed(s,userId,id),practice:practiced(s,userId,id),workSample:labPassed(s,userId,id)}));
 const missing=modules.filter(m=>!m.completed||!m.knowledge||!m.practice||!m.workSample).map(m=>m.id);
 const ownerIds=new Set((db.users||[]).filter(u=>u.role==='owner'&&u.active!==false&&Number(u.tenantId)===Number(user.tenantId)).map(u=>String(u.id)));
 const a=latestAttempt(s,userId,'am-12','sbc_am_roleplay_for_owner_review'),r=a?.academyRubric;
 let validRubric=false;try{validRubric=Boolean(r&&r.version===PRACTICE.VERSION&&PRACTICE.gradeRubric({...r,critical:Object.fromEntries(['truthfulness','contactPermission','paymentAuthority','privacy'].map(k=>[k,r.critical.includes(k)]))}).passed)}catch(_){}
 const capstone=Boolean(a?.passed===true&&Number(a.score)>=90&&validRubric&&ownerIds.has(String(a.reviewedBy||''))&&String(r?.reviewedBy)===String(a.reviewedBy));
 return {ready:missing.length===0&&capstone,code:missing.length?'LESSONS_INCOMPLETE':capstone?'READY_FOR_OWNER_CERTIFICATION':'CAPSTONE_OWNER_OBSERVATION_REQUIRED',done:MODULES.length-missing.length,total:MODULES.length,missing,modules,capstoneOwnerPassed:capstone};
}
function hasClearance(s,db,userId){
 if(pendingWrites.get(db)?.has(String(userId)))return false;
 const facts=readiness(s,db,userId);
 if(!facts.ready)return false;
 const certifications=(s?.certifications||[]).filter(c=>String(c.userId)===String(userId)&&c.courseId===COURSE_ID);
 const latest=certifications[certifications.length-1];
 const expires=latest?.expiresAt?Date.parse(latest.expiresAt):null;
 return latest?.status==='Certified'&&latest.academyVersion===PRACTICE.VERSION&&latest.capstoneAttemptId===latestAttempt(s,userId,'am-12','sbc_am_roleplay_for_owner_review')?.id&&latest.capstoneReviewId===latestAttempt(s,userId,'am-12','sbc_am_roleplay_for_owner_review')?.academyRubric?.reviewId&&String(latest.certifiedBy||'')!==''&&(!latest.expiresAt||(Number.isFinite(expires)&&expires>Date.now()))&&
 (db?.users||[]).some(u=>String(u.id)===String(latest.certifiedBy)&&u.role==='owner'&&u.active!==false&&Number(u.tenantId)===Number((db.users||[]).find(x=>String(x.id)===String(userId))?.tenantId));
}
function isTrainingSafeRoute(method,url){
 const verb=String(method||'').toUpperCase(),path=String(url||'').split('?')[0];
 if(!path.startsWith('/api/')||path.includes('%')||path.includes('..')||path.includes('//')||path.includes('\\'))return false;
 if(verb==='GET')return ['/api/me','/api/training','/api/v9/time/status','/api/sbc/academy-am/v1/window','/api/sbc/sales/workforce/academy/me'].includes(path)||
 /^\/api\/training\/courses\/sbc-account-manager-mastery-20261122$/.test(path)||
 /^\/api\/sbc\/academy-am\/v1\/(?:quiz|lab)\/am-[0-9]{2}$/.test(path);
 if(verb==='POST')return ['/api/logout','/api/v9/time/clock','/api/training/progress','/api/sbc/academy-am/v1/window/start'].includes(path)||
 /^\/api\/sbc\/academy-am\/v1\/(?:quiz|roleplay|lab)\/am-[0-9]{2}$/.test(path);
 return false;
}
module.exports=Object.freeze({COURSE_ID,STAGES,MODULES,stageIndex,completed,objectivePassed,practiced,labPassed,latestAttempt,canEnter,readiness,hasClearance,isTrainingSafeRoute,beginPendingWrite,endPendingWrite});
