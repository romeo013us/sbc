'use strict';
// Research is evidence to review, never publication-ready copy. No auto-promotion.
const {record,string,validURL}=require('./contracts.cjs');
const statuses=new Set(['unverified','approved','rejected']);
const types=new Set(['website','directory','social','service','hours','phone','review']);
const websiteStates=new Set(['active','broken','parked']);
function assessResearch(input={}){
 if(!record(input)||Object.keys(input).some(k=>!['researchCompleted','signals'].includes(k)))throw Error('INVALID_RESEARCH_INPUT');
 const researchCompleted=input.researchCompleted===true;
 const signals=input.signals??[];
 if(!Array.isArray(signals)||signals.length>100)throw Error('INVALID_RESEARCH_SIGNALS');
 const cleaned=signals.map(signal=>{
  if(!record(signal)||Object.keys(signal).some(k=>!['type','value','source_url','confidence_score','status','website_state','approvedBy','approvedAt'].includes(k))||
    !types.has(signal.type)||!string(signal.value,350)||!validURL(signal.source_url)||
    typeof signal.confidence_score!=='number'||signal.confidence_score<0||signal.confidence_score>1||!Number.isFinite(signal.confidence_score)||!statuses.has(signal.status)||
    (signal.website_state!==undefined&&(signal.type!=='website'||!websiteStates.has(signal.website_state)))||
    (signal.status==='approved'&&(!string(signal.approvedBy,100)||!string(signal.approvedAt,40))))throw Error('INVALID_RESEARCH_SIGNAL');
  return Object.freeze({...signal});
 });
 const approved=cleaned.filter(s=>s.status==='approved');
 const active=approved.some(s=>s.type==='website'&&s.website_state==='active');
 const unavailable=approved.some(s=>s.type==='website'&&['broken','parked'].includes(s.website_state));
 const listings=approved.some(s=>['directory','social'].includes(s.type));
 // Null means *not established*, not no website. 'No web presence' requires
 // a completed search with no contradictory positive signal.
 const websiteStatus=active?'verified_active_site':unavailable?'broken_or_parked_domain':listings?'directory_or_social_only':
  (researchCompleted&&!cleaned.some(s=>['website','directory','social'].includes(s.type)&&s.status!=='rejected')?'no_web_presence_found':null);
 return Object.freeze({schemaVersion:1,researchCompleted,websiteStatus,signals:cleaned});
}
module.exports={assessResearch};
