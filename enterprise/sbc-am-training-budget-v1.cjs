'use strict';
/* SBC Academy 360 training budget: TWO shifts / EIGHT clocked hours.
 * This limits additional ASSIGNED TRAINING and calls for owner review.
 * It NEVER computes wages, denies pay, edits the time clock, terminates
 * employment, fabricates clock entries, or authorizes customer outreach.
 */
const POLICY=Object.freeze({baseMinutes:480,baseShifts:2,maxExtensionMinutes:240,maxExtensionShifts:1});
function entries(db,userId){
 return (Array.isArray(db?.settings?.v9?.timeEntries)?db.settings.v9.timeEntries:[])
 .filter(x=>String(x?.userId)===String(userId)&&x.mode==='training'&&
  Number.isFinite(Date.parse(x.clockIn||'')))
 .slice().sort((a,b)=>Date.parse(a.clockIn)-Date.parse(b.clockIn));
}
function activeEntry(db,userId){
 return entries(db,userId).find(e=>!e.clockOut)||null;
}
function start(state,db,userId,at=new Date().toISOString()){
 if(!state||!Array.isArray(state.amTrainingWindows))throw Error('ACADEMY_WINDOW_STATE_REQUIRED');
 const existing=state.amTrainingWindows.find(w=>String(w.userId)===String(userId));
 if(existing)return {window:existing,created:false};
 const live=activeEntry(db,userId);
 if(!live)throw Object.assign(Error('ACADEMY_CLOCK_IN_TRAINING_REQUIRED'),{status:409});
 const origin=new Date(live.clockIn).toISOString();
 const window={userId:String(userId),startedAt:origin,firstTimeEntryId:String(live.id||''),plannedMinutes:POLICY.baseMinutes,
  plannedShifts:POLICY.baseShifts,extensionMinutes:0,extensionShifts:0,ownerOverride:null,
  createdAt:at,status:'IN_PROGRESS'};
 state.amTrainingWindows.push(window);
 return {window,created:true};
}
function asOf(state,db,userId,now=Date.now()){
 const w=state?.amTrainingWindows?.find(x=>String(x.userId)===String(userId));
 if(!w)return {status:'NOT_STARTED',active:false,trainingMinutes:0,shiftsUsed:0,minutesRemaining:POLICY.baseMinutes,
  shiftsRemaining:POLICY.baseShifts,clockedIn:Boolean(activeEntry(db,userId)),ownerReviewRequired:false,policy:POLICY};
 const origin=Date.parse(w.startedAt),timestamp=now instanceof Date?now.getTime():Number(now);
 if(!Number.isFinite(origin)||!Number.isFinite(timestamp))throw Error('ACADEMY_TRAINING_CLOCK_INVALID');
 const relevant=entries(db,userId).filter(e=>Date.parse(e.clockIn)>=origin-1000);
 let totalMilliseconds=0,shifts=0,closedShifts=0;
 for(const e of relevant){
  const first=Date.parse(e.clockIn);if(!Number.isFinite(first))continue;
  const end=e.clockOut?Date.parse(e.clockOut):timestamp;
  if(!Number.isFinite(end)||end<first)continue;
  const clipped=Math.max(0,Math.min(end,timestamp)-first);
  if(clipped<=0)continue;
  shifts++;if(e.clockOut)closedShifts++;
  // The official time clock remains the payroll authority. Here the gross
  // time-clock elapsed is a conservative training budget, not wage arithmetic.
  totalMilliseconds+=clipped;
 }
 const minutes=Math.ceil(totalMilliseconds/60000);
 const cap=POLICY.baseMinutes+Math.max(0,Number(w.extensionMinutes)||0);
 const maxShifts=POLICY.baseShifts+Math.max(0,Number(w.extensionShifts)||0);
 const budgetReached=minutes>=cap||closedShifts>=maxShifts;
 const live=Boolean(relevant.find(e=>!e.clockOut));
 return {status:budgetReached?'OWNER_REVIEW_REQUIRED':'IN_PROGRESS',active:!budgetReached&&live,
  trainingMinutes:minutes,shiftsUsed:shifts,closedShifts,
  minutesRemaining:Math.max(0,cap-minutes),shiftsRemaining:Math.max(0,maxShifts-closedShifts),
  clockedIn:live,ownerReviewRequired:budgetReached,
  ownerOverride:w.ownerOverride?{approvedAt:w.ownerOverride.approvedAt,reason:w.ownerOverride.reason}:null,
  policy:POLICY,startedAt:w.startedAt};
}
function permit(state,db,userId,now=Date.now()){
 const status=asOf(state,db,userId,now);
 if(status.status==='NOT_STARTED')throw Object.assign(Error('ACADEMY_TRAINING_NOT_STARTED'),{status:409});
 if(status.ownerReviewRequired)throw Object.assign(Error('ACADEMY_OWNER_REVIEW_REQUIRED'),{status:423});
 if(!status.clockedIn)throw Object.assign(Error('ACADEMY_CLOCK_IN_TRAINING_REQUIRED'),{status:409});
 return status;
}
function extend(state,db,userId,{ownerId,reason,minutes=0,shifts=0,at}={}){
 if(!ownerId)throw Error('ACADEMY_OWNER_REQUIRED');
 const w=state?.amTrainingWindows?.find(x=>String(x.userId)===String(userId));
 if(!w)throw Object.assign(Error('ACADEMY_WINDOW_MISSING'),{status:404});
 if(!Number.isSafeInteger(minutes)||minutes<0||minutes>POLICY.maxExtensionMinutes||
 !Number.isSafeInteger(shifts)||shifts<0||shifts>POLICY.maxExtensionShifts||
 (minutes===0&&shifts===0))throw Object.assign(Error('ACADEMY_OVERRIDE_LIMIT_INVALID'),{status:422});
 if(String(reason||'').trim().length<20||String(reason).length>500)throw Object.assign(Error('ACADEMY_OVERRIDE_REASON_REQUIRED'),{status:422});
 if(w.ownerOverride)throw Object.assign(Error('ACADEMY_OVERRIDE_ALREADY_USED'),{status:409});
 w.extensionMinutes=minutes;w.extensionShifts=shifts;
 w.ownerOverride={ownerId:String(ownerId),reason:String(reason).trim(),approvedAt:at||new Date().toISOString()};
 return w;
}
module.exports=Object.freeze({POLICY,entries,activeEntry,start,asOf,permit,extend});
