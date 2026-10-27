
'use strict';

const crypto = require('crypto');

const FEATURES = [
  ['autonomous-agent-runtime','Autonomous Agentic AI Runtime','Runs bounded background reasoning tasks with explicit action policies and owner gates.'],
  ['trust-layer','Localized Context Isolation / Trust Layer','Masks or hashes PII before model-facing payloads leave the application boundary.'],
  ['predictive-conversion','Predictive Conversion & Churn Scoring','Produces a deterministic 1–99 readiness score from available CRM signals; ML provider can replace it later.'],
  ['conversation-revenue','Conversation & Revenue Intelligence','Normalizes transcript summaries, intent, price-risk and next-action fields when a transcription provider is connected.'],
  ['brand-intelligence','Autonomous Brand Intelligence','Extracts brand signals from supplied website content; external crawling/model activation remains provider-gated.'],
  ['dynamic-forecasting','Dynamic Forecasting Engine','Calculates pipeline velocity and scenario projections from internal records.'],
  ['semantic-segmentation','Semantic Audience Segmentation','Converts a constrained natural-language request into a safe structured filter plan; never executes arbitrary SQL.'],
  ['generative-outreach','Contextual Generative Outreach','Builds a context package for personalized outreach; message generation can be delegated to the configured AI provider.'],
  ['agent-builder','No-Code Agentic Workflow Builder','Stores declarative workflow definitions with validation before activation.'],
  ['data-enrichment','Automated Data Enrichment & Social Graphing','Provides enrichment contracts and provider slots without fabricating third-party data.'],
  ['anomaly-detection','Real-Time Telemetry Anomaly Detection','Tracks bounded operational signals and flags unusual activity for review.'],
  ['dedup-sanitization','Database Duplication & Sanitization','Finds probable duplicate entities using normalized business/contact signals before any merge.'],
  ['omnichannel-triage','Omnichannel Intent Routing','Classifies inbound messages into safe routing intents and suggested queues.'],
  ['knowledge-drafting','Proactive Knowledge Base Drafting','Turns resolved issue metadata into an approval-ready knowledge draft.'],
  ['human-handoff','AI-to-Human Operational Handoff','Packages context, tool activity, errors and recommended next steps for a human owner.'],
  ['server-driven-ui','Server-Driven AI Interface','Returns UI hints and allowed actions without allowing model output to execute arbitrary frontend code.'],
  ['intent-anticipation','Intent Anticipation','Generates evidence-backed follow-up opportunities from existing activity and purchase signals.'],
  ['smart-scheduling','Smart Scheduling','Produces scheduling suggestions and calendar action plans; actual booking remains connector-gated.'],
  ['semantic-data-graph','Semantic Data Graph Linking','Creates relationship candidates between CRM entities for review.'],
  ['self-correcting-workflows','Self-Correcting Long-Running Workflows','Persists state-machine checkpoints and safe retry/handoff decisions.']
];

const IRREVERSIBLE = new Set([
  'refund_payment','charge_payment','register_domain','submit_print_order',
  'delete_customer','merge_customer','send_bulk_message','change_owner_credentials'
]);

function hash(v){ return crypto.createHash('sha256').update(String(v??'')).digest('hex'); }
function mask(v){
  if(v==null) return v;
  if(Array.isArray(v)) return v.map(mask);
  if(typeof v!=='object') return String(v);
  const out={};
  for(const [k,val] of Object.entries(v)){
    const key=String(k).toLowerCase();
    if(/password|token|secret|api[_-]?key|authorization|cookie/.test(key)) out[k]='[REDACTED]';
    else if(/email/.test(key) && typeof val==='string') out[k]=val.replace(/^(.).+(@.+)$/, '$1***$2');
    else if(/phone|mobile|fax/.test(key) && typeof val==='string') out[k]=val.replace(/\D/g,'').replace(/(\d{3})\d+(\d{2})$/,'$1***$2');
    else if(/address|street|ssn|tax|government|dob/.test(key)) out[k]='[MASKED]';
    else out[k]=mask(val);
  }
  return out;
}
function readiness(env={}){
  return {
    enabled:true,
    mode:'bounded-agent-runtime',
    providerConfigured:Boolean(env.OPENAI_API_KEY),
    trustLayer:true,
    piiMasking:true,
    ownerBoundary:true,
    irreversibleActionsDefault:'blocked',
    backgroundExecution:'safe-worker-ready',
    featureCount:FEATURES.length,
    features:FEATURES.map(([id,name,description])=>({id,name,description,status:'ready'}))
  };
}
function normalizeName(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function scoreLead(lead={}){
  let score=35;
  if(lead.phone) score+=10;
  if(lead.email) score+=10;
  if(lead.website) score+=8;
  if(lead.industry) score+=6;
  if(lead.notes) score+=5;
  const status=String(lead.status||'').toLowerCase();
  if(/qualified|quoted|opportunity/.test(status)) score+=15;
  if(/won|customer/.test(status)) score=95;
  if(/lost|dead|do not contact/.test(status)) score=8;
  return Math.max(1,Math.min(99,score));
}
function forecast(leads=[]){
  const scores=leads.map(scoreLead);
  const n=scores.length||1;
  const avg=Math.round(scores.reduce((a,b)=>a+b,0)/n);
  return {sampleSize:leads.length,averageReadiness:avg,highReadiness:scores.filter(x=>x>=70).length,method:'deterministic CRM signals; not a guarantee or probability'};
}
function duplicateCandidates(records=[]){
  const map=new Map(), pairs=[];
  for(const r of records){
    const key=[normalizeName(r.businessName||r.company),normalizeName(r.phone),normalizeName(r.email)].filter(Boolean).join('|');
    if(!key) continue;
    if(map.has(key)) pairs.push({existingId:map.get(key),candidateId:r.id,reason:'normalized business/contact match'});
    else map.set(key,r.id);
  }
  return pairs;
}
function intent(text=''){
  const t=String(text).toLowerCase();
  const rules=[
    ['payment',['refund','charge','invoice','payment']],
    ['fulfillment',['tracking','shipping','print','cards','flyer','delivery']],
    ['support',['broken','error','problem','help','not working']],
    ['sales',['price','quote','pricing','interested','package']],
    ['appointment',['schedule','meeting','call','appointment']]
  ];
  const hit=rules.find(([,words])=>words.some(w=>t.includes(w)));
  return {intent:hit?hit[0]:'general',confidence:hit?0.72:0.35,needsHuman:!hit};
}
function uiHints(role='team',context={}){
  const hints={role,layout:'sbc-standard',showTechnicalDetails:role==='owner'||role==='manager',priorityActions:[]};
  if(role==='sales') hints.priorityActions=['next-lead','instant-demo','what-if-quote','call-notes'];
  if(role==='owner') hints.priorityActions=['system-health','kim-control-plane','fulfillment','security'];
  return {...hints,context:mask(context)};
}
function handoff(input={}){
  return {
    id:'handoff_'+crypto.randomBytes(8).toString('hex'),
    createdAt:new Date().toISOString(),
    status:'human_review',
    summary:String(input.summary||'Agent requested human assistance.').slice(0,4000),
    reason:String(input.reason||'agent_boundary').slice(0,500),
    attemptedActions:Array.isArray(input.attemptedActions)?input.attemptedActions.slice(0,25):[],
    recommendedNextSteps:Array.isArray(input.nextSteps)?input.nextSteps.slice(0,10):[],
    context:mask(input.context||{})
  };
}
function actionPolicy(action, role){
  if(IRREVERSIBLE.has(String(action))) return {allowed:role==='owner',requiresOwner:true,reason:'Protected irreversible operation'};
  return {allowed:true,requiresOwner:false,reason:'Reversible/read-only action'};
}
module.exports={FEATURES,readiness,mask,hash,scoreLead,forecast,duplicateCandidates,intent,uiHints,handoff,actionPolicy,IRREVERSIBLE};
