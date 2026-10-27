'use strict';
const crypto=require('crypto');
const VERSION='2.0.0';
const ACTIONS=Object.freeze({CONTACT_NOW:'CONTACT_NOW',CONTACT_TODAY:'CONTACT_TODAY',PROPOSAL_FOLLOW_UP:'PROPOSAL_FOLLOW_UP',CHECKOUT_RECOVERY:'CHECKOUT_RECOVERY',CREATE_PROPOSAL:'CREATE_PROPOSAL',NURTURE:'NURTURE',NO_ACTION:'NO_ACTION'});
function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,Number(n)||0));}
function scoreOpportunity(x={}){
  const fit=clamp(x.fitScore??x.industryFitScore??50),intent=clamp(x.intentScore??(x.buyingSignal?90:40)),engagement=clamp(x.engagementScore??(x.responded?90:x.openedProposal?75:35)),contactability=clamp(x.contactabilityScore??((x.emailVerified&&x.phoneVerified)?95:(x.emailVerified||x.phoneVerified)?70:35)),urgency=clamp(x.urgencyScore??(x.urgent?90:45)),history=clamp(x.historyScore??(x.priorCustomer?85:45));
  const revenue=clamp(x.revenuePotentialScore??50),risk=clamp(x.riskScore??0);
  const score=Math.round(fit*.15+intent*.20+engagement*.12+contactability*.13+urgency*.10+history*.10+revenue*.20-risk*.10);
  const tier=score>=90?'HOT':score>=75?'WARM':score>=55?'NURTURE':'COLD';
  return {score,tier,signals:{fit,intent,engagement,contactability,urgency,history,revenue,risk},model:VERSION};
}
function nextAction(x={}){
  const score=Number(x.score||0),state=String(x.state||x.status||'NEW').toUpperCase();
  if(['SUPPRESSED','LOST','WON','FULFILLMENT','RETAIN'].includes(state))return {action:ACTIONS.NO_ACTION,priority:'LOW',reason:`State ${state} is not an active acquisition state.`};
  if(x.paymentStarted&&!x.paid)return {action:ACTIONS.CHECKOUT_RECOVERY,priority:'CRITICAL',reason:'Checkout intent exists without completed payment.'};
  if(x.proposalViewed&&!x.accepted)return {action:ACTIONS.PROPOSAL_FOLLOW_UP,priority:'HIGH',reason:'Proposal was viewed but not accepted.'};
  if(state==='QUALIFIED')return {action:ACTIONS.CREATE_PROPOSAL,priority:'HIGH',reason:'Qualified opportunity is ready for a commercial proposal.'};
  if(score>=90)return {action:ACTIONS.CONTACT_NOW,priority:'CRITICAL',reason:'Highest-probability revenue opportunity.'};
  if(score>=75)return {action:ACTIONS.CONTACT_TODAY,priority:'HIGH',reason:'Sales-ready opportunity.'};
  return {action:ACTIONS.NURTURE,priority:'NORMAL',reason:'No higher-confidence immediate action.'};
}
function opportunityId(tenantId,leadId){return crypto.createHash('sha256').update(`${tenantId}:${leadId}`).digest('hex').slice(0,24);}
function morningBrief({collected=0,pipeline=0,hot=0,callbacks=0,proposals=0,upsells=0,topOpportunity=null,bottleneck=''}={}){return {version:VERSION,headline:'SBC MONEY MACHINE 2.0',collected, pipeline, hot, callbacks, proposals, upsells, topOpportunity, bottleneck, generatedAt:new Date().toISOString()};}
module.exports={VERSION,ACTIONS,scoreOpportunity,nextAction,opportunityId,morningBrief};
