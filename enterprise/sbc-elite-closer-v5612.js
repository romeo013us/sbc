// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
const crypto = require('crypto');

const VERSION = '56.12.2';
const STAGES = Object.freeze(['ATTENTION','DISCOVERY','PAIN','IMPACT','DESIRED_OUTCOME','FIT','OFFER','OBJECTION','TRIAL_CLOSE','CLOSE','HANDOFF','FOLLOW_UP']);
const STYLES = Object.freeze({
  CONSULTATIVE: 'consultative', DIRECT: 'direct', DIAGNOSTIC: 'diagnostic', VALUE: 'value', RELATIONSHIP: 'relationship'
});
const OFFERS = Object.freeze({
  SBC_99: {sku:'SBC-99-STARTER',price:99,name:'Business Starter / Local Presence'},
  SBC_199: {sku:'SBC-199-STARTER',price:199,name:'Business Starter'},
  SBC_349: {sku:'SBC-349-ESSENTIALS',price:349,name:'Business Essentials'},
  SBC_699: {sku:'SBC-699-COMPLETE',price:699,name:'SBC Complete Business Launch'}
});

function clean(v,n=3000){return String(v??'').trim().slice(0,n);}
function id(prefix='ec'){return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;}
function bool(v){return v===true||String(v||'').toLowerCase()==='true'||String(v||'')==='1';}
function now(){return new Date().toISOString();}
function sqlDate(v=now()){return new Date(v).toISOString().slice(0,19).replace('T',' ');}
function json(v,f={}){try{return typeof v==='string'?JSON.parse(v||''):v??f}catch{return f;}}

const OBJECTIONS = {
  PRICE:{label:'price',response:'Do not defend the price immediately. First confirm what outcome they are buying and whether the smaller path solves the actual problem.',question:'If we could solve the specific issue you care about without adding a lot of overhead, would that be worth looking at?'},
  NO_BUDGET:{label:'budget',response:'De-escalate and diagnose. Offer the smallest credible step only if it genuinely fits.',question:'Is the issue that the budget is unavailable right now, or that you are not yet convinced the result is worth paying for?'},
  ALREADY_HAVE_WEBSITE:{label:'existing website',response:'Do not attack the existing provider. Find the gap between having a website and getting the desired business result.',question:'What is the one thing you wish your current setup did better for the business?'},
  ALREADY_HAVE_PROVIDER:{label:'existing provider',response:'Respect the relationship and compare outcomes, not vendors.',question:'Are you happy with the result you are getting from them, or is there something you would change if you could?'},
  SEND_ME_SOMETHING:{label:'send information',response:'Agree, then earn a reason to make the material specific instead of generic.',question:'Absolutely. What should I make sure I address so I do not just send you another generic sales sheet?'},
  TOO_BUSY:{label:'timing',response:'Ask for a micro-commitment or a callback rather than forcing the conversation.',question:'Understood. Give me 20 seconds to tell you why I called, and you can decide whether it deserves a real conversation.'},
  NOT_INTERESTED:{label:'not interested',response:'Diagnose the rejection once, then respect it. Never grind through a clear no.',question:'Fair enough. Is that because the problem is already handled, or because it simply is not a priority right now?'},
  NEED_TO_THINK:{label:'think about it',response:'Clarify the unresolved decision variable instead of pushing.',question:'Of course. What part do you want to think through most—the solution, the investment, or whether now is the right time?'},
  NEED_PARTNER:{label:'partner approval',response:"Identify the partner's decision criteria and create a concise handoff package.",question:'What will your partner need to see or understand before they can say yes?'}
};

const PLAYBOOKS = {
  DEFAULT:{name:'SBC Consultative Closer',style:STYLES.CONSULTATIVE,sequence:['ATTENTION','DISCOVERY','PAIN','IMPACT','DESIRED_OUTCOME','FIT','OFFER','OBJECTION','TRIAL_CLOSE','CLOSE']},
  LOCAL_SERVICE:{name:'Local Service Growth',style:STYLES.DIAGNOSTIC,sequence:['ATTENTION','DISCOVERY','PAIN','IMPACT','DESIRED_OUTCOME','FIT','OFFER','OBJECTION','TRIAL_CLOSE','CLOSE']},
  PROFESSIONAL:{name:'Professional Services',style:STYLES.VALUE,sequence:['ATTENTION','DISCOVERY','PAIN','DESIRED_OUTCOME','FIT','OFFER','OBJECTION','TRIAL_CLOSE','CLOSE']},
  RETAIL:{name:'Retail / Walk-In Business',style:STYLES.DIRECT,sequence:['ATTENTION','DISCOVERY','PAIN','IMPACT','FIT','OFFER','OBJECTION','TRIAL_CLOSE','CLOSE']}
};

function industryKey(industry=''){const s=String(industry).toLowerCase();if(/restaurant|salon|barber|cleaning|pressure|landscap|plumb|hvac|contract|repair|auto|detailing|beauty|nail/.test(s))return 'LOCAL_SERVICE';if(/law|account|consult|insurance|real estate|medical|dental|finance/.test(s))return 'PROFESSIONAL';if(/retail|shop|store|boutique|clothing/.test(s))return 'RETAIL';return 'DEFAULT';}

function chooseStyle(profile={},history=[]){
  const recent=history.slice(0,5).map(x=>String(x.style||'')).filter(Boolean);
  const objections=history.flatMap(x=>Array.isArray(x.objections)?x.objections:[]).map(String);
  if(objections.filter(x=>/PRICE|BUDGET/i.test(x)).length>=2)return STYLES.VALUE;
  if(Number(profile.intentScore||0)>=85)return STYLES.DIRECT;
  if(recent.includes(STYLES.DIAGNOSTIC))return STYLES.DIAGNOSTIC;
  return STYLES.CONSULTATIVE;
}

function offerFor(profile={}){
  const p=profile.detectedPainPoints||{}; const intent=Number(profile.intentScore||0); const budget=String(p.budget||'').toUpperCase();
  if((intent>=88||String(p.urgency||'').toUpperCase()==='HIGH')&&budget!=='LOW'&&(p.needsWebsite||p.needsCards))return OFFERS.SBC_699;
  if(p.securityGap||String(p.hostingControl||'').toUpperCase()==='POOR'||String(p.emailControl||'').toUpperCase()==='POOR')return OFFERS.SBC_349;
  if(budget==='LOW'||p.noWebsite||p.weakPresence)return OFFERS.SBC_99;
  return OFFERS.SBC_199;
}

function stageFromSignals({transcript='',intentScore=0,offerMentioned=false,objection=false,buyingSignal=false}={}){
  const t=String(transcript).toLowerCase();
  if(buyingSignal||/where do i pay|how do i start|send the invoice|let's do it|sign me up|i want to get started|get started/.test(t))return 'CLOSE';
  if(objection)return 'OBJECTION';
  if(offerMentioned)return 'TRIAL_CLOSE';
  if(Number(intentScore)>=80)return 'OFFER';
  if(/how much|price|cost|package|what do you offer/.test(t))return 'FIT';
  if(/because|losing|miss|problem|issue|struggle|need|can't|cannot/.test(t))return 'PAIN';
  return 'DISCOVERY';
}

function scoreConversationSignals(text=''){
  const t=String(text).toLowerCase();
  const positive=['need','want','looking for','how much','price','start','today','send','book','interested','yes','sounds good','makes sense'];
  const negative=['stop calling','do not call','remove me','not interested','no thanks'];
  const buying=['how do i pay','send invoice','get started','sign me up','let’s do it',"let's do it",'when can you start'];
  const p=positive.reduce((n,x)=>n+(t.includes(x)?1:0),0), n=negative.reduce((n,x)=>n+(t.includes(x)?1:0),0), b=buying.reduce((n,x)=>n+(t.includes(x)?1:0),0);
  return {intentScore:Math.max(0,Math.min(100,35+p*7-n*18+b*15)),buyingSignal:b>0,optOut:n>0};
}

class EliteCloser {
  constructor(ctx={}){this.ctx=ctx;this.pool=ctx.mysqlPool;this.db=ctx.db||{};}
  async ensureTables(){
    if(!this.pool)return;
    await this.pool.query(`CREATE TABLE IF NOT EXISTS sbc_elite_closer_profiles(id VARCHAR(80) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,lead_id VARCHAR(80) NOT NULL,industry_key VARCHAR(40) NOT NULL DEFAULT 'DEFAULT',playbook VARCHAR(80) NOT NULL,style VARCHAR(40) NOT NULL,stage VARCHAR(40) NOT NULL DEFAULT 'DISCOVERY',intent_score INT NOT NULL DEFAULT 0,pain_summary LONGTEXT,desired_outcome LONGTEXT,offer_sku VARCHAR(80) NOT NULL DEFAULT '',next_best_action LONGTEXT,updated_at DATETIME NOT NULL,created_at DATETIME NOT NULL,INDEX idx_ec_lead(tenant_id,lead_id),INDEX idx_ec_stage(tenant_id,stage)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS sbc_elite_closer_interactions(id VARCHAR(80) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,lead_id VARCHAR(80) NOT NULL,channel_type VARCHAR(20) NOT NULL,style VARCHAR(40) NOT NULL,stage VARCHAR(40) NOT NULL,transcript LONGTEXT,outcome VARCHAR(80) NOT NULL DEFAULT '',intent_score INT NOT NULL DEFAULT 0,offer_sku VARCHAR(80) NOT NULL DEFAULT '',revenue DECIMAL(12,2) NOT NULL DEFAULT 0,created_at DATETIME NOT NULL,INDEX idx_ec_int_lead(tenant_id,lead_id,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS sbc_elite_closer_experiments(id VARCHAR(80) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,name VARCHAR(160) NOT NULL,variants_json LONGTEXT NOT NULL,metrics_json LONGTEXT NOT NULL,status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',winner_variant VARCHAR(100) NOT NULL DEFAULT '',owner_approved TINYINT(1) NOT NULL DEFAULT 0,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,INDEX idx_ec_exp(tenant_id,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS sbc_elite_closer_queue(id VARCHAR(80) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,lead_id VARCHAR(80) NOT NULL,priority_score DECIMAL(8,2) NOT NULL DEFAULT 0,action VARCHAR(80) NOT NULL,reason LONGTEXT,eligible TINYINT(1) NOT NULL DEFAULT 0,status VARCHAR(30) NOT NULL DEFAULT 'READY',created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,UNIQUE KEY uq_ec_queue(tenant_id,lead_id,status),INDEX idx_ec_queue(tenant_id,status,priority_score)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }
  profile(customer={},history=[]){
    const industry=industryKey(customer.industry);const play=PLAYBOOKS[industry]||PLAYBOOKS.DEFAULT;const style=chooseStyle(customer,history);const offer=offerFor(customer);const signals=scoreConversationSignals(history?.[0]?.transcript||'');const intent=Math.max(Number(customer.intentScore||0),signals.intentScore||0);const stage=stageFromSignals({transcript:history?.[0]?.transcript||'',intentScore:intent});
    return {leadId:String(customer.id||''),businessName:clean(customer.businessName||'Business',255),industry:clean(customer.industry||'',120),industryKey:industry,playbook:play.name,style,stage,intentScore:intent,offer,objective:'Earn the sale when fit is established; otherwise earn the next committed step.',nextBestAction:intent>=90?'PREPARE_CLOSE_OR_HUMAN_HANDOFF':stage==='PAIN'?'QUANTIFY_IMPACT':stage==='OFFER'?'TRIAL_CLOSE':'ASK_ONE_DISCOVERY_QUESTION',sequence:play.sequence};
  }
  prompt(customer,profile,{transcript='',objection='' }={}){
    const offer=profile.offer||offerFor(profile);const objectionContext=objection?OBJECTIONS[String(objection).toUpperCase()]||OBJECTIONS.NOT_INTERESTED:null;
    return `You are Kim, the SBC AI Sales Representative and Revenue Closer. You are not a dialer and not a generic support bot. Your job is to conduct a high-quality business sales conversation and earn a real outcome.

IDENTITY: You are an AI assistant. Disclose that naturally at the beginning. Never pretend to be human.
MISSION: Maximize qualified sales outcomes, not call volume. A valid outcome is a sale, a qualified appointment, a requested human handoff, or a clean follow-up commitment. Never manufacture urgency, facts, reviews, scarcity, discounts, guarantees, or customer pain.

CLOSING METHOD: ${profile.playbook}. Style: ${profile.style}. Stage: ${profile.stage}.
SEQUENCE: ${profile.sequence.join(' -> ')}
RULES: Ask one strong question at a time. Listen. Reflect the prospect's words. Quantify impact when possible. Connect the offer to the stated outcome. Present one recommended offer before alternatives. Handle objections by acknowledging -> diagnosing -> responding -> checking. Use a trial close before a hard close when appropriate. If the buyer is ready, ask directly for the next action. If the buyer asks for a human or a protected action, hand off with full context. If the buyer gives a clear no or opt-out, stop.

APPROVED OFFER: ${JSON.stringify(offer)}
PROSPECT: ${JSON.stringify({businessName:customer.businessName,contactName:customer.contactName,industry:customer.industry,website:customer.website})}
PROFILE: ${JSON.stringify(profile)}
PRIOR TRANSCRIPT: ${clean(transcript,12000)}
CURRENT OBJECTION: ${objectionContext?JSON.stringify(objectionContext):'none'}

NEVER claim a sale occurred until the existing SBC order/payment system records it. Do not capture payment yourself. Do not bypass SBC eligibility, suppression, owner controls, or financial gates.`;
  }
  async upsertProfile(customer,{history=[]}={}){
    const p=this.profile(customer,history), row={id:id('ecp'),...p,createdAt:now(),updatedAt:now()};
    this.db.eliteCloserProfiles=Array.isArray(this.db.eliteCloserProfiles)?this.db.eliteCloserProfiles:[];
    const existing=this.db.eliteCloserProfiles.find(x=>String(x.leadId)===String(p.leadId));if(existing){Object.assign(existing,row,{id:existing.id,createdAt:existing.createdAt});row.id=existing.id;}
    else this.db.eliteCloserProfiles.unshift(row);
    this.db.eliteCloserProfiles=this.db.eliteCloserProfiles.slice(0,5000);
    if(this.pool)await this.pool.query(`INSERT INTO sbc_elite_closer_profiles(id,tenant_id,lead_id,industry_key,playbook,style,stage,intent_score,pain_summary,desired_outcome,offer_sku,next_best_action,updated_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE style=VALUES(style),stage=VALUES(stage),intent_score=VALUES(intent_score),offer_sku=VALUES(offer_sku),next_best_action=VALUES(next_best_action),updated_at=VALUES(updated_at)`,[row.id,Number(__sbcRequireTenantId(customer.tenantId)),p.leadId,p.industryKey,p.playbook,p.style,p.stage,p.intentScore,JSON.stringify(customer.leadIntelligence||{}),'',p.offer.sku,p.nextBestAction,sqlDate(row.updatedAt),sqlDate(row.createdAt)]);
    return p;
  }
  priority(customer,p){
    const temp=String(customer.leadTemperature||'').toLowerCase();let score=Number(p.intentScore||0)+(temp==='hot'?25:temp==='warm'?12:0);if(customer.verificationStatus==='Sales Ready')score+=20;if(customer.email)score+=4;if(customer.phone)score+=4;return Math.min(150,score);
  }
  async buildQueue(customers=[],eligibilityFn=()=>({allowed:false,reasons:['UNWIRED']}),tenantId=1){
    await this.ensureTables();const rows=[];
    for(const c of customers.slice(0,1000)){
      const p=await this.upsertProfile(c);const e=eligibilityFn(c);const priority=this.priority(c,p);const action=e.allowed?(p.intentScore>=88?'CALL_TO_CLOSE':'DISCOVERY_CALL'):'WAIT_FOR_ELIGIBILITY';
      const q={id:id('ecq'),tenantId,leadId:String(c.id),priorityScore:priority,action,reason:e.allowed?'Eligible prospect ranked by intent + sales readiness.':e.reasons?.join(', ')||'Eligibility gate not satisfied.',eligible:Boolean(e.allowed),status:e.allowed?'READY':'BLOCKED',createdAt:now(),updatedAt:now()};rows.push(q);
      if(this.pool && e.allowed){await this.pool.query(`INSERT INTO sbc_elite_closer_queue(id,tenant_id,lead_id,priority_score,action,reason,eligible,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE priority_score=VALUES(priority_score),action=VALUES(action),reason=VALUES(reason),eligible=VALUES(eligible),updated_at=VALUES(updated_at)`,[q.id,tenantId,q.leadId,q.priorityScore,q.action,q.reason,q.eligible?1:0,q.status,sqlDate(q.createdAt),sqlDate(q.updatedAt)]);}
    }
    this.db.eliteCloserQueue=rows.sort((a,b)=>b.priorityScore-a.priorityScore).slice(0,200);return this.db.eliteCloserQueue;
  }
  async recordInteraction(x={}){const r={id:id('eci'),tenantId:Number(__sbcRequireTenantId(x.tenantId)),leadId:String(x.leadId||''),channelType:clean(x.channel||'PHONE',20),style:clean(x.style||STYLES.CONSULTATIVE,40),stage:clean(x.stage||'DISCOVERY',40),transcript:clean(x.transcript||'',50000),outcome:clean(x.outcome||'',80),intentScore:Number(x.intentScore||0),offerSku:clean(x.offerSku||'',80),revenue:Number(x.revenue||0),createdAt:now()};this.db.eliteCloserInteractions=Array.isArray(this.db.eliteCloserInteractions)?this.db.eliteCloserInteractions:[];this.db.eliteCloserInteractions.unshift(r);this.db.eliteCloserInteractions=this.db.eliteCloserInteractions.slice(0,5000);if(this.pool)await this.pool.query('INSERT INTO sbc_elite_closer_interactions(id,tenant_id,lead_id,channel_type,style,stage,transcript,outcome,intent_score,offer_sku,revenue,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[r.id,r.tenantId,r.leadId,r.channelType,r.style,r.stage,r.transcript,r.outcome,r.intentScore,r.offerSku,r.revenue,sqlDate(r.createdAt)]);return r;}
  async arenaReport(tenantId=1){
    let rows=this.db.eliteCloserInteractions||[];
    if(this.pool){const [r]=await this.pool.query('SELECT style,outcome,COUNT(*) total,COALESCE(SUM(revenue),0) revenue FROM sbc_elite_closer_interactions WHERE tenant_id=? GROUP BY style,outcome',[tenantId]);rows=r;}
    const map={};for(const r of rows){const s=r.style||'unknown';map[s]=map[s]||{style:s,interactions:0,wins:0,revenue:0};map[s].interactions+=Number(r.total||1);map[s].revenue+=Number(r.revenue||0);if(/SALE|WON|CLOSED/i.test(String(r.outcome||'')))map[s].wins+=Number(r.total||1);}
    const ranked=Object.values(map).map(x=>({...x,closeRate:x.wins/Math.max(1,x.interactions)})).sort((a,b)=>b.closeRate-a.closeRate||b.revenue-a.revenue);return {styles:ranked,leadingStyle:ranked[0]?.style||STYLES.CONSULTATIVE,confidence:ranked[0]?.interactions>=20?'observed':'directional',ownerApprovalRequired:true};
  }
  async benchmark(tenantId=1){
    let sales=0,conversations=0,offers=0,revenue=0,handoffs=0,optOuts=0,interactions=0;
    if(this.pool){const [[r]]=await this.pool.query(`SELECT COUNT(*) interactions,SUM(outcome IN ('CONVERSATION','CONNECTED','CALL_CONNECTED')) conversations,SUM(outcome IN ('OFFERED','OFFER_EXTENDED')) offers,SUM(outcome IN ('SALE','WON','CLOSED')) sales,COALESCE(SUM(revenue),0) revenue FROM sbc_elite_closer_interactions WHERE tenant_id=?`,[tenantId]);interactions=Number(r.interactions||0);conversations=Number(r.conversations||0);offers=Number(r.offers||0);sales=Number(r.sales||0);revenue=Number(r.revenue||0);}
    else {const rows=this.db.eliteCloserInteractions||[];interactions=rows.length;conversations=rows.filter(x=>/CONVERSATION|CONNECTED/.test(x.outcome)).length;offers=rows.filter(x=>/OFFER/.test(x.outcome)).length;sales=rows.filter(x=>/SALE|WON|CLOSED/.test(x.outcome)).length;revenue=rows.reduce((n,x)=>n+Number(x.revenue||0),0);}
    return {interactions,conversations,offers,sales,revenue,closeRate:sales/Math.max(1,conversations),revenuePerConversation:revenue/Math.max(1,conversations),handoffs,optOuts,truth:'Observed revenue data only; no vendor case study or model claim is treated as proof.'};
  }
}

module.exports={VERSION,STAGES,STYLES,OFFERS,OBJECTIONS,PLAYBOOKS,industryKey,chooseStyle,offerFor,stageFromSignals,scoreConversationSignals,EliteCloser};
