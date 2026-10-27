'use strict';
const crypto=require('crypto');
const VERSION='57.0.0-GOD-TIER-REVENUE-OS';
const SCORE_WEIGHTS={fit:20,intent:25,engagement:15,contactability:15,urgency:10,history:10,risk:5};
const STATES=['NEW','VERIFIED','READY','CONTACTING','ENGAGED','QUALIFIED','PROPOSAL','CHECKOUT','WON','FULFILLMENT','RETAIN','LOST','SUPPRESSED'];
function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,Number(n)||0));}
function scoreLead(input={}){
 const s={};
 s.fit=clamp(input.fitScore ?? (input.industryFit?80:50));
 s.intent=clamp(input.intentScore ?? (input.buyingSignal?85:40));
 s.engagement=clamp(input.engagementScore ?? (input.responded?90:input.openedProposal?75:35));
 s.contactability=clamp(input.contactabilityScore ?? (input.emailVerified&&input.phoneVerified?95:input.emailVerified||input.phoneVerified?70:35));
 s.urgency=clamp(input.urgencyScore ?? (input.urgent?90:45));
 s.history=clamp(input.historyScore ?? (input.priorCustomer?80:50));
 s.risk=clamp(input.riskScore ?? 0);
 const raw=Object.entries(SCORE_WEIGHTS).reduce((a,[k,w])=>a+s[k]*w/100,0);
 const score=Math.round(clamp(raw-s.risk*0.5));
 const tier=score>=90?'HOT':score>=75?'WARM':score>=55?'NURTURE':'COLD';
 const reasons=Object.entries(s).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k}:${Math.round(v)}`);
 return {score,tier,signals:s,reasons,model:'deterministic-v1'};
}
function nextBestAction(lead={}){
 const score=Number(lead.score||scoreLead(lead).score);
 const state=String(lead.state||lead.status||'NEW').toUpperCase();
 if(['SUPPRESSED','LOST','WON','FULFILLMENT','RETAIN'].includes(state)) return {action:'NO_ACTION',priority:'LOW',reason:`State ${state} is not an active sales state.`};
 if(lead.paymentStarted && !lead.paid) return {action:'CHECKOUT_RECOVERY',priority:'HIGH',reason:'Checkout intent exists without payment.'};
 if(lead.proposalViewed && !lead.accepted) return {action:'PROPOSAL_FOLLOW_UP',priority:'HIGH',reason:'Proposal was viewed but not accepted.'};
 if(score>=90) return {action:'CONTACT_NOW',priority:'CRITICAL',reason:'Hot lead with high revenue propensity.'};
 if(score>=75) return {action:'CONTACT_TODAY',priority:'HIGH',reason:'Warm lead above sales-ready threshold.'};
 if(state==='QUALIFIED') return {action:'CREATE_PROPOSAL',priority:'HIGH',reason:'Qualified opportunity needs a commercial next step.'};
 return {action:'NURTURE',priority:'NORMAL',reason:'No high-confidence immediate action.'};
}
function opportunityValue({upfront=0,monthly=0,months=12,probability=0}={}){const total=(Number(upfront)||0)+(Number(monthly)||0)*(Number(months)||12);return {upfront:Number(upfront)||0,monthly:Number(monthly)||0,expectedValue:Math.round(total*clamp(probability,0,1))};}
function moneyMachineScore(m={}){
 const parts={leadFlow:clamp(m.leadFlow),verification:clamp(m.verification),outreach:clamp(m.outreach),sales:clamp(m.sales),payments:clamp(m.payments),fulfillment:clamp(m.fulfillment),retention:clamp(m.retention),automation:clamp(m.automation)};
 const weights={leadFlow:.12,verification:.10,outreach:.14,sales:.18,payments:.12,fulfillment:.10,retention:.10,automation:.14};
 const score=Math.round(Object.entries(parts).reduce((a,[k,v])=>a+v*weights[k],0));
 const weakest=Object.entries(parts).sort((a,b)=>a[1]-b[1])[0];
 return {score,parts,weakest:{area:weakest[0],score:weakest[1]}};
}
function idempotencyKey(scope,payload){return `${scope}:${crypto.createHash('sha256').update(JSON.stringify(payload||{})).digest('hex')}`;}
function communicationGate({suppressed=false,optInProof=false,purpose='marketing',channel='sms'}={}){
 if(suppressed)return {allowed:false,reason:'CONTACT_SUPPRESSED'};
 if(['marketing','promotional','cold_outreach'].includes(String(purpose).toLowerCase())&&!optInProof)return {allowed:false,reason:'CONSENT_PROOF_REQUIRED',channel,purpose};
 return {allowed:true,reason:'POLICY_ALLOWED',channel,purpose};
}
function stateTransition(from,to){from=String(from||'NEW').toUpperCase();to=String(to||'').toUpperCase();if(!STATES.includes(to))throw new Error('Unknown state');const allowed={NEW:['VERIFIED','SUPPRESSED'],VERIFIED:['READY','SUPPRESSED'],READY:['CONTACTING','SUPPRESSED'],CONTACTING:['ENGAGED','QUALIFIED','SUPPRESSED'],ENGAGED:['QUALIFIED','CONTACTING','SUPPRESSED'],QUALIFIED:['PROPOSAL','CONTACTING','SUPPRESSED'],PROPOSAL:['CHECKOUT','QUALIFIED','LOST','SUPPRESSED'],CHECKOUT:['WON','PROPOSAL','LOST','SUPPRESSED'],WON:['FULFILLMENT','RETAIN'],FULFILLMENT:['RETAIN'],RETAIN:['PROPOSAL','LOST','SUPPRESSED'],LOST:['READY','SUPPRESSED'],SUPPRESSED:[]};if(from!==to&&!allowed[from]?.includes(to))throw new Error(`Invalid state transition ${from} -> ${to}`);return true;}
module.exports={VERSION,SCORE_WEIGHTS,STATES,scoreLead,nextBestAction,opportunityValue,moneyMachineScore,idempotencyKey,communicationGate,stateTransition};
