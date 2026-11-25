'use strict';
// Deterministic local advisory layer. No network, credentials, model, persistence,
// shell, or execution adapters. External evidence must come from trusted callers.
const {performance}=require('node:perf_hooks');
const AGENTS=Object.freeze({
 research:['Lead research','review_research'],sales:['Sales and account management','review_sales'],
 finance:['Financial intelligence','review_finance'],fulfillment:['Fulfillment intelligence','review_fulfillment'],
 owner:['Owner clearance','review_approvals'],marketing:['Marketing readiness','review_creatives'],
 infrastructure:['Infrastructure recovery','review_release'],academy:['Academy and bilingual speech','review_training'],
 customer_success:['Customer success','review_retention']
});
const CHANNELS=['facebook','instagram','linkedin','google_business'];
const id=v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0?v:typeof v==='string'&&/^[1-9]\d*$/.test(v)&&Number.isSafeInteger(Number(v))?Number(v):null;
function reviewProposal(proposal={},context={}){
 const tenant=id(context.tenantId),p=id(proposal.tenantId);
 const allowed=!!tenant&&tenant===p&&Object.hasOwn(AGENTS,proposal.agent)&&AGENTS[proposal.agent][1]===proposal.tool;
 return {allowed,executionAllowed:false,mode:'HUMAN_REVIEW_ONLY',reason:allowed?'SCOPED_ADVISORY_TOOL':'DENIED_BY_POLICY'};
}
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const DAY=86400000;
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return NaN;const n=Date.parse(v+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===v?n:NaN;}
function creativeReadiness(evidence,start){
 const from=date(start),targetSlots=14,unknown={status:'EVIDENCE_REQUIRED',targetSlots,readySlots:null,blockedSlots:null};
 if(!Number.isFinite(from)||!evidence||evidence.historyComplete!==true||!Array.isArray(evidence.rows)||!Array.isArray(evidence.history)||evidence.rows.length>500||evidence.history.length>10000)return unknown;
 const prior=new Map(),scheduled=new Map(),duplicates=new Set();
 for(const h of evidence.history){const d=date(h?.date);if(!Number.isFinite(d)||!hash(h?.sha256))return unknown;if(d<from&&d>=from-30*DAY)prior.set(h.sha256,true);}
 for(const row of evidence.rows){const d=date(row?.date);if(!Number.isFinite(d)||!['AM','PM'].includes(row?.slot)||!hash(row?.sha256))return unknown;if(d<from||d>=from+7*DAY)continue;const k=row.date+'|'+row.slot;if(scheduled.has(k))duplicates.add(k);else scheduled.set(k,row);}
 let readySlots=0;const used=new Set(prior.keys());
 for(let i=0;i<7;i++)for(const slot of ['AM','PM']){
  const day=new Date(from+i*DAY).toISOString().slice(0,10),key=day+'|'+slot,r=scheduled.get(key);
  if(!r||duplicates.has(key)||r.approved!==true||r.mediaVerified!==true||!Array.isArray(r.channels)||!CHANNELS.every(c=>r.channels.includes(c))||used.has(r.sha256))continue;
  readySlots++;used.add(r.sha256);
 }
 return {status:readySlots===targetSlots?'READY_IN_RECORDED_EVIDENCE':'REVIEW_REQUIRED',targetSlots,readySlots,blockedSlots:targetSlots-readySlots,publicationVerified:false};
}
function researchEvidence(sources,now){
 if(!Array.isArray(sources)||sources.length>500||!Number.isFinite(now))return {status:'EVIDENCE_REQUIRED',usableSources:null};
 const unique=new Set();
 for(const s of sources){
  if(s?.observed!==true||typeof s.url!=='string'||s.url.length>2048)continue;
  const t=Date.parse(s.verifiedAt);if(!Number.isFinite(t)||t>now||t<now-30*DAY)continue;
  try{const u=new URL(s.url);if(u.protocol!=='https:'||u.username||u.password||!u.hostname)continue;u.hash='';unique.add(u.href);}catch{}
 }
 return {status:unique.size?'SOURCE_RECORDS_AVAILABLE':'EVIDENCE_REQUIRED',usableSources:unique.size,independentlyVerified:false};
}
function words(s){return s.normalize('NFKC').toLocaleLowerCase('en-US').match(/[\p{L}\p{N}]+/gu)||[];}
function distance(a,b){
 let p=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const n=[i];for(let j=1;j<=b.length;j++)n[j]=Math.min(p[j]+1,n[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=n;}return p[b.length];
}
function speechBenchmark(samples){
 const unknown={status:'EVIDENCE_REQUIRED',productionCertified:false};
 if(!Array.isArray(samples)||!samples.length||samples.length>100)return unknown;
 const groups={en:{samples:0,words:0,errors:0},es:{samples:0,words:0,errors:0}};
 for(const s of samples){
  if(s?.synthetic!==true||!Object.hasOwn(groups,s.language)||typeof s.reference!=='string'||typeof s.hypothesis!=='string'||s.reference.length>2000||s.hypothesis.length>2000)return unknown;
  const a=words(s.reference),b=words(s.hypothesis);if(!a.length||a.length>200||b.length>200)return unknown;
  const g=groups[s.language];g.samples++;g.words+=a.length;g.errors+=distance(a,b);
 }
 if(!groups.en.samples||!groups.es.samples)return unknown;
 for(const g of Object.values(groups))g.wordErrorRate=g.errors/g.words;
 return {status:'SYNTHETIC_EVALUATION_ONLY',languages:groups,productionCertified:false};
}
function buildFactory(plan,started=performance.now()){
 const agents=Object.entries(AGENTS).map(([agent,[label,tool]])=>{
  const department=plan.departments.find(d=>d.id===agent);
  const decisions=department?.decisions||[];
  const unknown=!department||!decisions.length||decisions.some(d=>d.count===null||!Number.isSafeInteger(d.count)||d.count<0);
  const reviewCount=unknown?null:decisions.reduce((n,d)=>n+d.count,0);
  return {id:agent,label,tool,reviewCount,status:unknown?'EVIDENCE_REQUIRED':reviewCount?'REVIEW_REQUIRED':'NO_ITEMS_IN_SNAPSHOT',authority:'HUMAN_REVIEW_ONLY'};
 });
 return {schema:1,mode:'DETERMINISTIC_ADVISORY',providerCalls:0,externalActions:0,agents,
  runtime:{provider:'local-node',externalInferenceEnabled:false,speechEnabled:false,incrementalProviderSpendCents:0},
  profile:{durationMs:Math.max(0,performance.now()-started),scope:'CURRENT_ADVISORY_COMPUTATION_ONLY'},
  limitations:'No external agent execution, verified creative inventory, actual speech inference or production certification. Department counts are current snapshot observations only.'};
}
module.exports={reviewProposal,creativeReadiness,researchEvidence,speechBenchmark,buildFactory};
