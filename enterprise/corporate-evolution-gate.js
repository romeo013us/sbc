'use strict';
const crypto=require('crypto');
const VERSION='1.0.0';
const DEFAULT_THRESHOLD=1000000;
function now(){return new Date().toISOString();}
function ensure(store){
  store.corporateEvolution=store.corporateEvolution&&typeof store.corporateEvolution==='object'?store.corporateEvolution:{};
  const s=store.corporateEvolution;
  s.enabled=Boolean(s.enabled);
  s.thresholdCents=Number(s.thresholdCents||DEFAULT_THRESHOLD);
  s.evaluations=Array.isArray(s.evaluations)?s.evaluations:[];
  s.alerts=Array.isArray(s.alerts)?s.alerts:[];
  return s;
}
function evaluate(store,input={},actor='owner'){
  if(actor!=='owner')throw new Error('OWNER_AUTHORITY_REQUIRED');
  const s=ensure(store);
  const balanceCents=Number(input.balanceCents||0);
  if(!Number.isFinite(balanceCents)||balanceCents<0)throw new Error('INVALID_BALANCE');
  const thresholdCents=Number(input.thresholdCents||s.thresholdCents||DEFAULT_THRESHOLD);
  const eligible=balanceCents>=thresholdCents;
  const id=`ce_${crypto.randomBytes(8).toString('hex')}`;
  const row={id,balanceCents,thresholdCents,eligible,decision:eligible?'OWNER_REVIEW_REQUIRED':'ACCUMULATE',legalActionExecuted:false,bankingActionExecuted:false,createdAt:now()};
  s.evaluations.unshift(row); s.evaluations=s.evaluations.slice(0,100);
  if(eligible)s.alerts.unshift({id:`alert_${crypto.randomBytes(7).toString('hex')}`,type:'CORPORATE_STRUCTURE_REVIEW',status:'OPEN',message:'Threshold reached. Prepare legal/tax/banking review; no filing or transfer was executed.',createdAt:now()});
  s.alerts=s.alerts.slice(0,100); return {version:VERSION,balanceCents,thresholdCents,eligible,decision:row.decision,legalActionExecuted:false,bankingActionExecuted:false,latestAlert:eligible?s.alerts[0]:null};
}
function summary(store){const s=ensure(store);return {version:VERSION,enabled:s.enabled,thresholdCents:s.thresholdCents,evaluations:s.evaluations.slice(0,20),openAlerts:s.alerts.filter(a=>a.status==='OPEN').slice(0,20),policy:'DETECT -> ALERT -> OWNER REVIEW -> AUTHORIZED PROVIDER -> VERIFY -> AUDIT'};}
module.exports={VERSION,ensure,evaluate,summary};
