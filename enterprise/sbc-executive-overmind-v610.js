'use strict';
const crypto = require('crypto');

const VERSION = '61.0.0-executive-sovereignty';
const IDENTITY = 'SBC_EXECUTIVE_OVERMIND';
const STAGES = ['OBSERVE','ASSESS','DISAGREE','DECIDE','AUTHORIZE','EXECUTE','VERIFY','LEARN'];
const RISK = Object.freeze({LOW:10, MEDIUM:40, HIGH:70, CRITICAL:100});
const AUTHORITY = Object.freeze({
  AUTONOMOUS: 'AUTONOMOUS',
  BOUNDED: 'BOUNDED',
  OWNER_SIGNATURE: 'OWNER_SIGNATURE',
  OWNER_VETO_ONLY: 'OWNER_VETO_ONLY'
});
const HARD_OWNER_ACTIONS = new Set(['bank_account_change','credential_change','owner_access','legal_commitment','irreversible_data_delete','refund_policy_change','large_capital_commitment','security_boundary_change']);

function id(prefix){return `${prefix}_${crypto.randomUUID()}`;}
function now(){return new Date().toISOString();}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d;}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function money(v){return Math.round(num(v)*100)/100;}

const DEFAULT_POLICY = Object.freeze({
  objective:'MAXIMIZE_SUSTAINABLE_COLLECTED_GROSS_PROFIT',
  ownerInvolvementTargetPct:5,
  preferReversibleActions:true,
  requireEvidenceForMaterialClaims:true,
  autonomousRiskCeiling:'LOW',
  boundedRiskCeiling:'MEDIUM',
  financialSafety:'NO_UNBOUNDED_FINANCIAL_MUTATION',
  preserveOwnerVeto:true,
  recoveryModeBlocksMutation:true
});

function normalizeContext(input={}){
  const c=input&&typeof input==='object'?input:{};
  return {
    cash: num(c.cash),
    runRate: num(c.runRate),
    targetRunRate: num(c.targetRunRate),
    pipeline: num(c.pipeline),
    collected: num(c.collected),
    marginPct: num(c.marginPct,0),
    leads: num(c.leads),
    hotLeads: num(c.hotLeads),
    warmLeads: num(c.warmLeads),
    conversionPct: num(c.conversionPct),
    paymentConversionPct: num(c.paymentConversionPct),
    churnPct: num(c.churnPct),
    capacityPct: num(c.capacityPct,100),
    recoverySafe: Boolean(c.recoverySafe),
    healthScore: num(c.healthScore,100),
    constraints:Array.isArray(c.constraints)?c.constraints.slice(0,20):[],
    recentOutcomes:Array.isArray(c.recentOutcomes)?c.recentOutcomes.slice(0,20):[]
  };
}

function expectedValue(play, c){
  const pipeline = Math.max(c.pipeline, c.leads * Math.max(1,c.conversionPct)/100 * 500);
  const hot = c.hotLeads * 350;
  const warm = c.warmLeads * 125;
  const base = play==='REACTIVATE_HIGH_INTENT'?hot*0.18 + warm*0.06:
    play==='IMPROVE_PAYMENT_CONVERSION'?Math.max(c.collected, pipeline)*0.08:
    play==='IMPROVE_CHECKOUT'?Math.max(c.pipeline,c.collected)*0.05:
    play==='INCREASE_LEAD_VOLUME'?Math.max(1000,c.pipeline)*0.025:
    play==='RETENTION_INTERVENTION'?Math.max(c.collected,1000)*0.06:0;
  return money(base);
}

function rankPlays(c){
  const candidates = [
    {id:'REACTIVATE_HIGH_INTENT',label:'Re-engage highest-intent leads',risk:'LOW',cost:0,authority:AUTHORITY.AUTONOMOUS,reason:'Existing demand can be monetized before buying additional demand.'},
    {id:'IMPROVE_PAYMENT_CONVERSION',label:'Improve payment conversion',risk:'LOW',cost:0,authority:AUTHORITY.AUTONOMOUS,reason:'Collected revenue is the economic endpoint; fixing conversion can outperform top-of-funnel expansion.'},
    {id:'IMPROVE_CHECKOUT',label:'Optimize checkout friction',risk:'LOW',cost:0,authority:AUTHORITY.AUTONOMOUS,reason:'Conversion optimization is reversible and measurable.'},
    {id:'RETENTION_INTERVENTION',label:'Protect at-risk customer revenue',risk:'LOW',cost:0,authority:AUTHORITY.AUTONOMOUS,reason:'Retained revenue is usually cheaper than replacement acquisition.'},
    {id:'INCREASE_LEAD_VOLUME',label:'Increase lead acquisition',risk:'MEDIUM',cost:500,authority:AUTHORITY.BOUNDED,reason:'More leads are useful only after downstream conversion constraints are addressed.'}
  ];
  return candidates.map(p=>{
    const ev=expectedValue(p.id,c);
    let score=ev - p.cost;
    if(p.id==='INCREASE_LEAD_VOLUME' && c.paymentConversionPct>0 && c.paymentConversionPct<60) score*=0.35;
    if(p.id==='REACTIVATE_HIGH_INTENT' && c.hotLeads>0) score*=1.35;
    if(p.id==='RETENTION_INTERVENTION' && c.churnPct>5) score*=1.4;
    if(c.capacityPct<70 && p.id==='INCREASE_LEAD_VOLUME') score*=0.5;
    return {...p,expectedValue:ev,decisionScore:money(score),confidence:clamp(0.55+(p.id==='REACTIVATE_HIGH_INTENT'&&c.hotLeads?0.25:0)+(p.id==='IMPROVE_PAYMENT_CONVERSION'&&c.paymentConversionPct>0?0.15:0),0.5,0.97)};
  }).sort((a,b)=>b.decisionScore-a.decisionScore);
}

function evaluateOwnerProposal(proposal={}, context={}, policy=DEFAULT_POLICY){
  const c=normalizeContext(context);
  const action=String(proposal.action||proposal.type||'').toLowerCase().replace(/[^a-z0-9_ -]/g,' ').trim();
  const requestedAmount=Math.max(0,num(proposal.amount||proposal.budget||proposal.spend));
  const hardOwner=[...HARD_OWNER_ACTIONS].some(x=>action.includes(x.replaceAll('_',' '))||action.includes(x));
  const plays=rankPlays(c);
  const best=plays[0];
  const requestedExpectedValue= num(proposal.expectedValue, best?.expectedValue||0);
  const roi=requestedAmount>0?money((requestedExpectedValue-requestedAmount)/requestedAmount):null;
  const objections=[];
  if(hardOwner) objections.push('Action is outside autonomous authority and requires owner signature.');
  if(requestedAmount>0 && requestedExpectedValue<requestedAmount) objections.push('Expected economic value is below requested capital allocation.');
  if(policy.preferReversibleActions && proposal.reversible===false) objections.push('Non-reversible action violates the standing reversible-first policy.');
  if(c.recoverySafe && policy.recoveryModeBlocksMutation) objections.push('SBC is in recovery-safe mode; mutation is suspended until authoritative data recovery completes.');
  const disagree=objections.length>0 || (best && action && !action.includes(best.id.toLowerCase().replaceAll('_',' ')) && requestedExpectedValue < best.expectedValue*0.65);
  const authority=hardOwner?AUTHORITY.OWNER_SIGNATURE:(requestedAmount>1000?AUTHORITY.OWNER_SIGNATURE:(requestedAmount>250?AUTHORITY.BOUNDED:AUTHORITY.AUTONOMOUS));
  return {decisionId:id('decision'),timestamp:now(),identity:IDENTITY,stage:disagree?'DISAGREE':'DECIDE',decision:disagree?'REJECT_OR_REDIRECT':'ACCEPT',disagree,authority,requested:{action:proposal.action||proposal.type||null,amount:requestedAmount},bestAlternative:best,rankedAlternatives:plays,objections,recommendation:disagree?`I reject or redirect this action because ${objections[0]||'its expected value is materially below the best available play.'} My recommended move is ${best?.label||'continue evidence gathering'}.`: 'Proceed within delegated authority and verify the outcome.',economic:{requestedExpectedValue,roi,bestExpectedValue:best?.expectedValue||0},policy};
}

function formulateExecutiveMandate(context={}, policy=DEFAULT_POLICY){
  const c=normalizeContext(context); const plays=rankPlays(c); const top=plays[0];
  const directives=[];
  if(c.runRate>0 && c.targetRunRate>0 && c.runRate<c.targetRunRate) directives.push({id:id('dir'),type:'MONEY_MAXIMIZATION',priority:'CRITICAL',objective:policy.objective,rationale:`Run-rate is ${money(c.runRate)} against target ${money(c.targetRunRate)}.`,play:top?.id});
  if(c.churnPct>5) directives.push({id:id('dir'),type:'RETENTION_PROTECTION',priority:'HIGH',play:'RETENTION_INTERVENTION'});
  if(c.paymentConversionPct>0 && c.paymentConversionPct<60) directives.push({id:id('dir'),type:'PAYMENT_CONVERSION',priority:'HIGH',play:'IMPROVE_PAYMENT_CONVERSION'});
  if(!directives.length) directives.push({id:id('dir'),type:'CONTINUOUS_OPTIMIZATION',priority:'NORMAL',play:top?.id||'OBSERVE'});
  return {identity:IDENTITY,generatedAt:now(),objective:policy.objective,mandate:'Operate SBC in the company\'s best economic and operational interest within the delegated authority matrix.',topPlay:top,directives,policy};
}

function createOvermind({getPool,logger=console}={}){
  const memory=[]; const pool=()=>typeof getPool==='function'?getPool():null;
  async function ensure(){const p=pool();if(!p)return false;await p.query(`CREATE TABLE IF NOT EXISTS sbc_executive_decisions (decision_id VARCHAR(140) PRIMARY KEY,tenant_id VARCHAR(80) NOT NULL,stage VARCHAR(40) NOT NULL,decision VARCHAR(40) NOT NULL,authority VARCHAR(40) NOT NULL,action_type VARCHAR(160) NULL,expected_value_cents BIGINT NOT NULL DEFAULT 0,decision_json JSON NOT NULL,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),KEY idx_exec_decisions(tenant_id,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);await p.query(`CREATE TABLE IF NOT EXISTS sbc_executive_policy (tenant_id VARCHAR(80) PRIMARY KEY,policy_json JSON NOT NULL,updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);return true;}
  async function record(tenantId,result){const p=pool();if(p)await p.query('INSERT INTO sbc_executive_decisions(decision_id,tenant_id,stage,decision,authority,action_type,expected_value_cents,decision_json) VALUES(?,?,?,?,?,?,?,?)',[result.decisionId,String(tenantId),result.stage,result.decision,result.authority,result.requested?.action||null,Math.round(num(result.economic?.requestedExpectedValue)*100),JSON.stringify(result)]);memory.push(result);if(memory.length>200)memory.shift();return result;}
  async function challenge({tenantId=1,proposal={},context={},policy=DEFAULT_POLICY}={}){const result=evaluateOwnerProposal(proposal,context,policy);await record(tenantId,result);return result;}
  async function mandate({tenantId=1,context={},policy=DEFAULT_POLICY}={}){const result=formulateExecutiveMandate(context,policy);await record(tenantId,{decisionId:id('mandate'),stage:'DECIDE',decision:'MANDATE',authority:AUTHORITY.AUTONOMOUS,requested:{action:'EXECUTIVE_MANDATE'},economic:{requestedExpectedValue:result.topPlay?.expectedValue||0},...result});return result;}
  async function list({tenantId=1,limit=20}={}){const p=pool();if(!p)return memory.slice(-limit).reverse();const [rows]=await p.query('SELECT decision_id,stage,decision,authority,action_type,expected_value_cents,decision_json,created_at FROM sbc_executive_decisions WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?',[String(tenantId),Math.min(100,Math.max(1,Number(limit)||20))]);return rows.map(r=>{try{return JSON.parse(r.decision_json||'{}')}catch{return r;}});}
  return {VERSION,IDENTITY,STAGES,AUTHORITY,DEFAULT_POLICY,ensure,challenge,mandate,list,evaluateOwnerProposal,rankPlays};
}
module.exports={VERSION,IDENTITY,STAGES,AUTHORITY,DEFAULT_POLICY,evaluateOwnerProposal,rankPlays,formulateExecutiveMandate,createOvermind};
