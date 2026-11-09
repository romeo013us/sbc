'use strict';
// SBC V66.137 — deterministic phone recovery. No AI, SMS, or outbound calls.
const DAY_MS=86400000;
const ACTIVE_HOLDS=new Set(['HOLD','OWNER_REVIEW','ARCHIVED']);
function cleanPhone(v){
  let n=String(v||'').trim().replace(/[\s().-]/g,'');
  if(/^\d{10}$/.test(n))n='+1'+n;
  else if(/^1\d{10}$/.test(n))n='+'+n;
  return /^\+[1-9]\d{7,14}$/.test(n)?n:'';
}
function recovery(c){const p=c?.leadIntelligence?.phoneRecovery;return p&&typeof p==='object'?p:null;}
function isHeld(c){return ACTIVE_HOLDS.has(String(recovery(c)?.state||''));}
function when(v){const d=Date.parse(String(v||''));return Number.isFinite(d)?d:0;}
function fromLogs(c,logs){
 const phone=cleanPhone(c?.phone);if(!phone)return null;
 if(recovery(c)?.state==='CLEARED')return null;
 const rows=(Array.isArray(logs)?logs:[]).filter(x=>String(x.customerId||'')===String(c.id||'') &&
   Number(x.tenantId||0)===Number(c.tenantId??c.tenant_id) && cleanPhone(x.to)===phone)
   .sort((a,b)=>when(b.updatedAt||b.createdAt||b.startedAt)-when(a.updatedAt||a.createdAt||a.startedAt));
 const latest=rows[0];
 if(!latest||String(latest.outcome||'').trim().toLowerCase()!=='bad number')return null;
 const start=when(latest.updatedAt||latest.endedAt||latest.createdAt||latest.startedAt)||Date.now();
 return {version:1,state:'HOLD',originalPhone:phone,flaggedAt:new Date(start).toISOString(),
   reviewAt:new Date(start+15*DAY_MS).toISOString(),lastCallLogId:String(latest.id||''),researchAttempts:0,
   candidatePhone:'',candidateSource:'',reason:'Historical unreachable-number call; review only after 15 days.'};
}
function hasUnreachableLog(c,logs){return !!fromLogs(c,logs);}

function flag(c,{at=new Date().toISOString(),actor='',callLogId=''}={}){
  if(!c||typeof c!=='object')throw Error('PHONE_RECOVERY_CUSTOMER_REQUIRED');
  const phone=cleanPhone(c.phone);
  const old=recovery(c);
  if(old&&ACTIVE_HOLDS.has(old.state)&&(!old.originalPhone||old.originalPhone===phone))return old;
  const start=when(at)||Date.now();
  const p={version:1,state:'HOLD',originalPhone:phone,flaggedAt:new Date(start).toISOString(),
    reviewAt:new Date(start+15*DAY_MS).toISOString(),lastCallLogId:String(callLogId||'').slice(0,120),
    flaggedBy:String(actor||'').slice(0,120),researchAttempts:0,candidatePhone:'',candidateSource:'',
    reason:'Unreachable number; no automatic retry. One targeted review after 15 days.'};
  c.leadIntelligence={...(c.leadIntelligence||{}),phoneRecovery:p};
  c.salesQueueState='phone_hold';c.salesDisposition='Bad Number';c.salesNextAttemptAt='';
  c.updatedAt=new Date(start).toISOString();
  return p;
}
function reviewDue(c,at=new Date().toISOString()){
  const p=recovery(c);return p?.state==='HOLD'&&when(p.reviewAt)>0&&when(at)>=when(p.reviewAt);
}
function needsOwner(c){return recovery(c)?.state==='OWNER_REVIEW';}
function review(c,{outcome,candidatePhone='',source='',notes='',actor='',at=new Date().toISOString()}={}){
  if(!reviewDue(c,at))throw Error('PHONE_RECOVERY_NOT_DUE');
  const current=recovery(c);
  const result=String(outcome||'').trim().toUpperCase();
  if(!['NO_NEW_NUMBER','CANDIDATE_FOUND'].includes(result))throw Error('PHONE_RECOVERY_INVALID_OUTCOME');
  const clean=cleanPhone(candidatePhone),basis=String(source||'').trim().slice(0,400);
  if(result==='CANDIDATE_FOUND'&&(!clean||clean===cleanPhone(c.phone)||basis.length<8))
    throw Error('PHONE_RECOVERY_NEW_NUMBER_AND_SOURCE_REQUIRED');
  const p={...current,reviewedAt:new Date(when(at)||Date.now()).toISOString(),
    reviewedBy:String(actor||'').slice(0,120),researchAttempts:Math.max(0,Number(current.researchAttempts||0))+1,
    reviewNotes:String(notes||'').slice(0,1000),
    state:result==='CANDIDATE_FOUND'?'OWNER_REVIEW':'ARCHIVED',
    candidatePhone:result==='CANDIDATE_FOUND'?clean:'',
    candidateSource:result==='CANDIDATE_FOUND'?basis:''};
  c.leadIntelligence={...(c.leadIntelligence||{}),phoneRecovery:p};
  c.updatedAt=p.reviewedAt;return p;
}
function approve(c,{actor='',at=new Date().toISOString()}={}){
  const p=recovery(c);
  if(p?.state!=='OWNER_REVIEW'||!cleanPhone(p.candidatePhone)||!p.candidateSource)
    throw Error('PHONE_RECOVERY_NO_VERIFIED_CANDIDATE');
  const stamp=new Date(when(at)||Date.now()).toISOString();
  c.phone=p.candidatePhone;
  c.leadIntelligence={...(c.leadIntelligence||{}),phoneRecovery:{...p,state:'CLEARED',approvedAt:stamp,
      approvedBy:String(actor||'').slice(0,120),previousPhone:p.originalPhone}};
  c.salesQueueState='new';c.salesDisposition='Phone reverified';c.salesNextAttemptAt='';
  c.verificationStatus='Needs Verification';c.updatedAt=stamp;
  return c.leadIntelligence.phoneRecovery;
}
module.exports={cleanPhone,recovery,isHeld,fromLogs,hasUnreachableLog,flag,reviewDue,needsOwner,review,approve};
