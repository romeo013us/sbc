'use strict';
const crypto = require('crypto');

const VERSION = '1.0.0';
const STATES = Object.freeze({
  LEAD_VERIFIED:'LEAD_VERIFIED', OFFER_SELECTED:'OFFER_SELECTED', OUTREACH_READY:'OUTREACH_READY',
  OUTREACH_SENT:'OUTREACH_SENT', RESPONSE_RECEIVED:'RESPONSE_RECEIVED', QUALIFIED:'QUALIFIED',
  PROPOSAL_READY:'PROPOSAL_READY', PROPOSAL_SENT:'PROPOSAL_SENT', CHECKOUT_READY:'CHECKOUT_READY',
  PAID:'PAID', FULFILLMENT_QUEUED:'FULFILLMENT_QUEUED', BLOCKED:'BLOCKED', LOST:'LOST'
});
const TRANSITIONS = Object.freeze({
  LEAD_VERIFIED:['OFFER_SELECTED','BLOCKED'], OFFER_SELECTED:['OUTREACH_READY','BLOCKED'],
  OUTREACH_READY:['OUTREACH_SENT','BLOCKED'], OUTREACH_SENT:['RESPONSE_RECEIVED','LOST','BLOCKED'],
  RESPONSE_RECEIVED:['QUALIFIED','LOST'], QUALIFIED:['PROPOSAL_READY','BLOCKED'],
  PROPOSAL_READY:['PROPOSAL_SENT','BLOCKED'], PROPOSAL_SENT:['CHECKOUT_READY','LOST','BLOCKED'],
  CHECKOUT_READY:['PAID','BLOCKED'], PAID:['FULFILLMENT_QUEUED'],
  FULFILLMENT_QUEUED:[], BLOCKED:[], LOST:[]
});

function transition(from,to){
  const next=TRANSITIONS[from]||[];
  if(!next.includes(to)) throw new Error(`INVALID_SALE_TRANSITION:${from}->${to}`);
  return true;
}
function idempotencyKey(tenantId,leadId,stage,payload={}){
  return crypto.createHash('sha256').update(JSON.stringify({tenantId:String(tenantId),leadId:String(leadId),stage,payload})).digest('hex');
}
function normalizeLead(lead={}){
  return {
    id:String(lead.id||lead.leadId||''), businessName:String(lead.businessName||lead.company||''),
    contactName:String(lead.contactName||lead.name||''), email:String(lead.email||''), phone:String(lead.phone||''),
    verified:Boolean(lead.verified||lead.leadIntelligence?.verificationStatus==='Verified'),
    score:Number(lead.score||lead.leadIntelligence?.score||0), tier:String(lead.tier||lead.leadIntelligence?.leadTemperature||'').toUpperCase(),
    recommendedPackage:String(lead.recommendedPackage||lead.leadIntelligence?.recommendedPackage||''),
    dealValue:Number(lead.dealValue||lead.leadIntelligence?.estimatedDealValue||0),
    marketingConsent:Boolean(lead.marketingConsent||lead.hasMarketingConsent||lead.leadIntelligence?.marketingConsent),
    suppressed:Boolean(lead.suppressed||lead.leadIntelligence?.suppressed),
    source:String(lead.source||'')
  };
}
function selectOffer(lead={}){
  const l=normalizeLead(lead);
  const name=l.recommendedPackage || (l.dealValue>=699?'SBC Complete Business Launch':l.dealValue>=349?'Business Essentials':'Business Starter');
  const catalog={
    'Business Starter':199,'Business Essentials':349,'Professional Business':599,'SBC Complete Business Launch':699,'Business Growth':999
  };
  const price=catalog[name]||Math.max(0,l.dealValue||199);
  return {packageName:name,price,reason:l.recommendedPackage?'Lead intelligence recommendation':'Revenue-tier fallback'};
}
function buildPlan({tenantId,lead,channel='sms',purpose='marketing'}={}){
  const l=normalizeLead(lead);
  if(!l.id) throw new Error('LEAD_ID_REQUIRED');
  if(!l.verified) return {status:'BLOCKED',reason:'LEAD_NOT_VERIFIED',stage:STATES.LEAD_VERIFIED};
  if(l.suppressed) return {status:'BLOCKED',reason:'LEAD_SUPPRESSED',stage:STATES.BLOCKED};
  if(l.score<75) return {status:'HELD',reason:'LEAD_BELOW_AUTOMATION_THRESHOLD',stage:STATES.LEAD_VERIFIED,score:l.score};
  const offer=selectOffer(l);
  const outreach = l.marketingConsent ? {status:'READY',channel,purpose} : {status:'OWNER_APPROVAL_REQUIRED',channel,purpose,reason:'EXPLICIT_MARKETING_CONSENT_REQUIRED'};
  return {status:'READY',version:VERSION,tenantId,lead:l,offer,outreach,nextStage:outreach.status==='READY'?STATES.OUTREACH_READY:STATES.OUTREACH_READY,idempotencyKey:idempotencyKey(tenantId,l.id,'plan',{offer,outreach})};
}
module.exports={VERSION,STATES,TRANSITIONS,transition,normalizeLead,selectOffer,buildPlan,idempotencyKey};
