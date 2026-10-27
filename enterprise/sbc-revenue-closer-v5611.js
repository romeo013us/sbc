// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
const crypto = require('crypto');

const VERSION = '56.11.0';
const OFFER_MATRIX = Object.freeze({
  LOW_BUDGET_WEAK_PRESENCE: { sku: 'SBC-99-STARTER', price: 99, name: 'Business Starter / Local Presence' },
  TECH_CONSOLIDATION: { sku: 'SBC-199-STARTER', price: 199, name: 'Business Starter' },
  ESSENTIALS: { sku: 'SBC-349-ESSENTIALS', price: 349, name: 'Business Essentials' },
  FULL_LAUNCH: { sku: 'SBC-699-COMPLETE', price: 699, name: 'SBC Complete Business Launch' }
});

function id(prefix='rc'){ return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`; }
function clean(v,n=2000){ return String(v ?? '').trim().slice(0,n); }
function iso(){ return new Date().toISOString(); }
function sqlDate(v){ return new Date(v || Date.now()).toISOString().slice(0,19).replace('T',' '); }
function bool(v){ return v===true || String(v||'').toLowerCase()==='true'; }
function parseJson(v,fallback){ try{return typeof v==='string'?JSON.parse(v||''):v??fallback}catch{return fallback;} }

function objectionStrategy(objection=''){
  const key=String(objection||'').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'_');
  const map={
    ALREADY_HAVE_WEBSITE:'I understand. I am not calling because you need another website. Let me ask one thing: does your current setup also handle business email, security, backups, and a clean path for customers to contact or book you?',
    NO_BUDGET:'That is fair. I would not push you into a package that does not fit. Let me narrow this down to the smallest useful improvement and show you what that would cost.',
    SEND_ME_SOMETHING:'Absolutely. I can send the details. Before I do, which matters more right now: getting more customers, fixing your current online setup, or getting your business technology under control?',
    TOO_BUSY:'Understood. I will keep this brief. The reason for the call is one specific opportunity I noticed with your business. If it is relevant, I can explain it in 30 seconds; if not, I will get out of your way.',
    ALREADY_HAVE_PROVIDER:'Makes sense. I am not asking you to replace someone just for the sake of it. What I want to understand is whether you are getting the result you are paying for.',
    NOT_INTERESTED:'No problem. Before I let you go, is that because the problem is already handled, or because it is simply not a priority right now?'
  };
  return map[key] || 'Acknowledge the objection without arguing, ask one diagnostic question, then reconnect the answer to the prospect\'s stated business goal.';
}

function chooseOffer(profile={}){
  const pain=profile.detectedPainPoints||{};
  const intent=Number(profile.intentScore||0);
  const budget=String(pain.budget||'').toUpperCase();
  const urgency=String(pain.urgency||'').toUpperCase();
  if((urgency==='HIGH'||intent>=85) && (pain.needsCards===true || pain.needsWebsite===true) && budget!=='LOW') return OFFER_MATRIX.FULL_LAUNCH;
  if(pain.hostingControl==='POOR' || pain.emailControl==='POOR' || pain.securityGap===true) return OFFER_MATRIX.ESSENTIALS;
  if(budget==='LOW' || pain.weakPresence===true || pain.noWebsite===true) return OFFER_MATRIX.LOW_BUDGET_WEAK_PRESENCE;
  return OFFER_MATRIX.TECH_CONSOLIDATION;
}

function buildProfile(customer={}){
  const li=customer.leadIntelligence||customer.li||{};
  const pain={
    weakPresence: Boolean(!customer.website || /poor|unusable|needs review/i.test(String(customer.websiteStatus||''))),
    noWebsite: !customer.website,
    needsWebsite: /website|web|online presence/i.test(String(li.opportunityType||'')),
    needsCards: /card/i.test(String(li.opportunityType||'')) || bool(li.needsCards),
    bookingGap: Boolean(li.bookingPlatform && !customer.website),
    hostingControl: String(li.hostingControl||'').toUpperCase(),
    emailControl: String(li.emailControl||'').toUpperCase(),
    securityGap: bool(li.securityGap),
    urgency: String(li.urgency||'').toUpperCase() || (String(customer.leadTemperature||'').toLowerCase()==='hot'?'HIGH':'MEDIUM'),
    budget: String(li.budget||'').toUpperCase()
  };
  const intent=Math.max(0,Math.min(100,Number(customer.intentScore||li.intentScore||0)));
  return {id:String(customer.id||''),businessName:clean(customer.businessName||customer.contactName||'Business',255),industry:clean(customer.industry||'',120),phone:clean(customer.phone||'',50),email:clean(customer.email||'',255),website:clean(customer.website||'',500),detectedPainPoints:pain,intentScore:intent,currentTierPackage:String(customer.currentTierPackage||li.recommendedPackage||'NONE').slice(0,80),nextBestAction:{action:'DISCOVER',reason:'Confirm the prospect\'s highest-value business problem before presenting an offer.'}};
}

class RevenueCloser {
  constructor(ctx={}){ this.ctx=ctx; }
  get db(){return this.ctx.db||{};}
  get pool(){return this.ctx.mysqlPool;}
  async ensureTables(){
    if(!this.pool)return;
    await this.pool.query(`CREATE TABLE IF NOT EXISTS sbc_lead_prospect_profiles (
      id VARCHAR(64) PRIMARY KEY, tenant_id BIGINT NOT NULL DEFAULT 1, business_name VARCHAR(255) NOT NULL, industry_type VARCHAR(100),
      contact_phone VARCHAR(50) NOT NULL, contact_email VARCHAR(255), detected_pain_points LONGTEXT, intent_score INT NOT NULL DEFAULT 0,
      current_tier_package VARCHAR(80) NOT NULL DEFAULT 'NONE', last_interaction_timestamp DATETIME NULL, next_best_action LONGTEXT,
      created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, INDEX idx_rc_phone(contact_phone), INDEX idx_rc_tenant(tenant_id,updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS sbc_conversation_state_logs (
      id VARCHAR(80) PRIMARY KEY, tenant_id BIGINT NOT NULL DEFAULT 1, lead_id VARCHAR(64) NOT NULL, channel_type VARCHAR(16) NOT NULL,
      duration_seconds INT NOT NULL DEFAULT 0, conversation_transcript LONGTEXT, objections_encountered LONGTEXT, close_outcome VARCHAR(80) NOT NULL DEFAULT 'PENDING_FOLLOW_UP',
      call_score INT NOT NULL DEFAULT 0, intent_score INT NOT NULL DEFAULT 0, recommended_offer VARCHAR(80) NOT NULL DEFAULT '', created_at DATETIME NOT NULL,
      INDEX idx_rc_conv_lead(lead_id,created_at), INDEX idx_rc_conv_tenant(tenant_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS sbc_revenue_contact_events (
      id VARCHAR(80) PRIMARY KEY, tenant_id BIGINT NOT NULL DEFAULT 1, lead_id VARCHAR(64) NOT NULL, event_type VARCHAR(60) NOT NULL,
      channel_type VARCHAR(16) NOT NULL, outcome VARCHAR(80) NOT NULL DEFAULT '', amount DECIMAL(14,2) NOT NULL DEFAULT 0, metadata_json LONGTEXT,
      created_at DATETIME NOT NULL, INDEX idx_rc_event_lead(lead_id,created_at), INDEX idx_rc_event_type(event_type,created_at), INDEX idx_rc_event_tenant(tenant_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS sbc_sales_experiments (
      id VARCHAR(80) PRIMARY KEY, tenant_id BIGINT NOT NULL DEFAULT 1, name VARCHAR(160) NOT NULL, channel_type VARCHAR(16) NOT NULL, variants_json LONGTEXT NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
      winner_variant VARCHAR(100) NOT NULL DEFAULT '', created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, INDEX idx_rc_exp_tenant(tenant_id,status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS sbc_ai_call_sessions (
      id VARCHAR(80) PRIMARY KEY, tenant_id BIGINT NOT NULL DEFAULT 1, lead_id VARCHAR(64) NOT NULL, twilio_call_sid VARCHAR(100) NOT NULL DEFAULT '',
      status VARCHAR(40) NOT NULL, eligibility_json LONGTEXT, outcome VARCHAR(100) NOT NULL DEFAULT '', intent_score INT NOT NULL DEFAULT 0, offer_sku VARCHAR(80) NOT NULL DEFAULT '',
      handoff_required TINYINT(1) NOT NULL DEFAULT 0, started_at DATETIME NULL, ended_at DATETIME NULL, created_at DATETIME NOT NULL,
      UNIQUE KEY uq_rc_twilio_sid(twilio_call_sid), INDEX idx_rc_session_lead(lead_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }
  eligibility(customer={}, options={}){
    const phone=String(customer.phone||'').replace(/\D/g,'');
    const suppressed=bool(customer.doNotContact)||bool(customer.doNotCall)||String(customer.status||'').toLowerCase()==='do not call';
    const salesReady=String(customer.verificationStatus||'')==='Sales Ready';
    const consent=bool(customer.aiCallConsent)||bool(customer.callConsent)||bool(customer.consentToCall);
    const strict=String(options.policy||process.env.SBC_AI_OUTBOUND_POLICY||'strict').toLowerCase()!=='owner_review';
    const hour=options.currentHour!==undefined?Number(options.currentHour):Number(new Intl.DateTimeFormat('en-US',{hour:'numeric',hour12:false,timeZone:options.timeZone||'America/New_York'}).format(new Date()));
    const inWindow=hour>=8 && hour<21;
    const checks={phone:Boolean(phone&&phone.length>=10),suppressed:!suppressed,salesReady,consent:strict?consent:true,inWindow};
    const reasons=[];
    if(!checks.phone)reasons.push('MISSING_OR_INVALID_PHONE');
    if(!checks.suppressed)reasons.push('SUPPRESSED_OR_DNC');
    if(!checks.salesReady)reasons.push('LEAD_NOT_SALES_READY');
    if(!checks.consent)reasons.push('AI_CALL_CONSENT_REQUIRED');
    if(!checks.inWindow)reasons.push('OUTSIDE_LOCAL_CALLING_WINDOW');
    return {allowed:reasons.length===0,policy:strict?'strict':'owner_review',checks,reasons,phone:phone.length===10?`+1${phone}`:(phone?`+${phone}`:'')};
  }
  async profile(customer,tenantId=1){
    const p=buildProfile(customer);
    const offer=chooseOffer(p);
    p.nextBestAction={action:p.intentScore>=90?'HANDOFF_OR_CLOSE':'DISCOVER_AND_OFFER',recommendedOffer:offer.sku,reason:p.intentScore>=90?'High purchase intent detected; prepare a human close with full context.':'Confirm pain, quantify impact, then present the smallest credible offer.'};
    if(this.pool){await this.pool.query(`INSERT INTO sbc_lead_prospect_profiles(id,tenant_id,business_name,industry_type,contact_phone,contact_email,detected_pain_points,intent_score,current_tier_package,last_interaction_timestamp,next_best_action,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE business_name=VALUES(business_name),industry_type=VALUES(industry_type),contact_phone=VALUES(contact_phone),contact_email=VALUES(contact_email),detected_pain_points=VALUES(detected_pain_points),intent_score=VALUES(intent_score),current_tier_package=VALUES(current_tier_package),next_best_action=VALUES(next_best_action),updated_at=VALUES(updated_at)`,
      [p.id,Number(__sbcRequireTenantId(tenantId)),p.businessName,p.industry,p.phone,p.email,JSON.stringify(p.detectedPainPoints),p.intentScore,p.currentTierPackage,null,JSON.stringify(p.nextBestAction),sqlDate(iso()),sqlDate(iso())]);}
    return {...p,recommendedOffer:offer};
  }
  async recordEvent({leadId,tenantId=1,eventType,channel='PHONE',outcome='',amount=0,metadata={}}={}){
    const event={id:id('rce'),leadId:String(leadId||''),tenantId:Number(__sbcRequireTenantId(tenantId)),eventType:clean(eventType,60),channelType:clean(channel,16),outcome:clean(outcome,80),amount:Number(amount||0),metadata,createdAt:iso()};
    this.db.revenueContactEvents=Array.isArray(this.db.revenueContactEvents)?this.db.revenueContactEvents:[];
    this.db.revenueContactEvents.unshift(event);this.db.revenueContactEvents=this.db.revenueContactEvents.slice(0,3000);
    if(this.pool)await this.pool.query(`INSERT INTO sbc_revenue_contact_events(id,tenant_id,lead_id,event_type,channel_type,outcome,amount,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,[event.id,event.tenantId,event.leadId,event.eventType,event.channelType,event.outcome,event.amount,JSON.stringify(event.metadata||{}),sqlDate(event.createdAt)]);
    if(this.ctx.addActivity)this.ctx.addActivity(eventType,`Revenue Closer: ${eventType}`,{customerId:event.leadId,channel:event.channelType,outcome:event.outcome,amount:event.amount});
    return event;
  }
  async recordConversation({leadId,tenantId=1,channel='PHONE',durationSeconds=0,transcript='',objections=[],outcome='PENDING_FOLLOW_UP',callScore=0,intentScore=0,offerSku=''}={}){
    const row={id:id('conv'),leadId:String(leadId||''),tenantId:Number(__sbcRequireTenantId(tenantId)),channelType:channel,durationSeconds:Number(durationSeconds||0),conversationTranscript:clean(transcript,50000),objectionsEncountered:Array.isArray(objections)?objections:[],closeOutcome:clean(outcome,80),callScore:Math.max(0,Math.min(100,Number(callScore||0))),intentScore:Math.max(0,Math.min(100,Number(intentScore||0))),recommendedOffer:String(offerSku||''),createdAt:iso()};
    if(this.pool)await this.pool.query(`INSERT INTO sbc_conversation_state_logs(id,tenant_id,lead_id,channel_type,duration_seconds,conversation_transcript,objections_encountered,close_outcome,call_score,intent_score,recommended_offer,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,[row.id,row.tenantId,row.leadId,row.channelType,row.durationSeconds,row.conversationTranscript,JSON.stringify(row.objectionsEncountered),row.closeOutcome,row.callScore,row.intentScore,row.recommendedOffer,sqlDate(row.createdAt)]);
    return row;
  }
  async createExperiment({tenantId=1,name,channel='PHONE',variants=['A','B']}={}){const row={id:id('exp'),tenantId:Number(__sbcRequireTenantId(tenantId)),name:clean(name,160),channelType:clean(channel,16),variants:[...new Set((Array.isArray(variants)?variants:['A','B']).map(v=>clean(v,100)).filter(Boolean))].slice(0,6),status:'ACTIVE',winnerVariant:'',createdAt:iso(),updatedAt:iso()};if(row.variants.length<2)throw new Error('At least two experiment variants are required.');this.db.salesExperiments=Array.isArray(this.db.salesExperiments)?this.db.salesExperiments:[];this.db.salesExperiments.unshift(row);if(this.pool)await this.pool.query('INSERT INTO sbc_sales_experiments(id,tenant_id,name,channel_type,variants_json,status,winner_variant,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',[row.id,row.tenantId,row.name,row.channelType,JSON.stringify(row.variants),row.status,row.winnerVariant,sqlDate(row.createdAt),sqlDate(row.updatedAt)]);return row;}
  async experimentOutcome(experimentId,variant,outcome=''){const v=clean(variant,100),o=clean(outcome,80);if(this.pool)await this.pool.query('INSERT INTO sbc_revenue_contact_events(id,tenant_id,lead_id,event_type,channel_type,outcome,amount,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)',[id('rce'),'1','experiment',`EXPERIMENT_${experimentId}`,'META',o,0,JSON.stringify({experimentId,variant:v}),sqlDate(iso())]);this.db.experimentOutcomes=Array.isArray(this.db.experimentOutcomes)?this.db.experimentOutcomes:[];this.db.experimentOutcomes.push({experimentId,variant:v,outcome:o,createdAt:iso()});return this.experimentReport(experimentId);}
  async experimentReport(experimentId){let rows=[];if(this.pool){const [r]=await this.pool.query("SELECT metadata_json,outcome FROM sbc_revenue_contact_events WHERE event_type=? ORDER BY created_at DESC LIMIT 1000",[`EXPERIMENT_${experimentId}`]);rows=r.map(x=>({...parseJson(x.metadata_json,{}),outcome:x.outcome}));}else rows=(this.db.experimentOutcomes||[]).filter(x=>x.experimentId===experimentId);const by={};for(const r of rows){const v=r.variant||'UNKNOWN';by[v]=by[v]||{variant:v,total:0,wins:0,revenue:0};by[v].total++;if(/WON|SALE|APPOINTMENT|POSITIVE/i.test(r.outcome||''))by[v].wins++;}const ranked=Object.values(by).sort((a,b)=>b.wins/Math.max(1,b.total)-a.wins/Math.max(1,a.total));return {experimentId,variants:Object.values(by),leadingVariant:ranked[0]?.variant||'',confidence:ranked.length>1&&ranked[0].total>=10?'observed':'directional'};}
  async metrics(tenantId=1){
    if(this.pool){
      const [[e]] = await this.pool.query(`SELECT COUNT(*) contacts, SUM(event_type IN ('CALL_ATTEMPT','CALL_CONNECTED','CONTACT')) actual_contacts, SUM(event_type='CONVERSATION') conversations, SUM(event_type='OFFER_EXTENDED') offers, SUM(event_type='SALE_WON') sales, COALESCE(SUM(CASE WHEN event_type='SALE_WON' THEN amount ELSE 0 END),0) revenue FROM sbc_revenue_contact_events WHERE tenant_id=?`,[Number(__sbcRequireTenantId(tenantId))]);
      const [[h]] = await this.pool.query(`SELECT SUM(handoff_required=1) handoffs, SUM(status='COMPLETED') completed_calls FROM sbc_ai_call_sessions WHERE tenant_id=?`,[Number(__sbcRequireTenantId(tenantId))]);
      return {contacts:Number(e?.contacts||0),actualContacts:Number(e?.actual_contacts||0),conversations:Number(e?.conversations||0),offers:Number(e?.offers||0),sales:Number(e?.sales||0),revenue:Number(e?.revenue||0),handoffs:Number(h?.handoffs||0),completedCalls:Number(h?.completed_calls||0)};
    }
    const rows=this.db.revenueContactEvents||[];return {contacts:rows.length,actualContacts:rows.filter(x=>['CALL_CONNECTED','CONTACT'].includes(x.eventType)).length,conversations:rows.filter(x=>x.eventType==='CONVERSATION').length,offers:rows.filter(x=>x.eventType==='OFFER_EXTENDED').length,sales:rows.filter(x=>x.eventType==='SALE_WON').length,revenue:rows.filter(x=>x.eventType==='SALE_WON').reduce((n,x)=>n+Number(x.amount||0),0),handoffs:0,completedCalls:0};
  }
}

module.exports={VERSION,OFFER_MATRIX,RevenueCloser,objectionStrategy,chooseOffer,buildProfile,id};
