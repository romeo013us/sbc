// SBC_V6648_TENANT_SCOPED_REVENUE
const {requireTenant,scopeCustomers,scopeRevenueDb}=require('./v6648-revenue-tenant.cjs');
// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
/**
 * SBC V56.12.2 — Revenue Growth Engine
 * Additive orchestration over existing Revenue PLAY + Elite Closer + Hardening.
 *
 * Ten practices:
 * 1) lead-quality gate
 * 2) speed-to-lead / freshness priority
 * 3) next-best-action ranking
 * 4) offer ladder / fit guardrail
 * 5) objection recovery
 * 6) disciplined follow-up cadence
 * 7) stale-lead / win-back recovery
 * 8) expansion / referral opportunity detection
 * 9) continuous hook experimentation
 * 10) revenue-per-conversation / capacity optimization
 *
 * No new credentials. No direct provider bypass. High-risk financial actions remain owner-gated.
 */
const crypto=require('crypto');
const VERSION='56.12.2';
const CADENCE_HOURS=[0,6,24,72,168];
const money=n=>Math.round(Number(n||0)*100)/100;
const clean=(v,n=500)=>String(v??'').trim().slice(0,n);
const now=()=>new Date().toISOString();
const id=(p='rg')=>`${p}_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;
const daysAgo=(d,ref=Date.now())=>ref-Number(d)*86400000;

const OFFER_LADDER=[
  {sku:'SBC-99-STARTER',price:99,fit:['weakPresence','noWebsite','budgetLow']},
  {sku:'SBC-199-STARTER',price:199,fit:['presence','email','hosting']},
  {sku:'SBC-349-ESSENTIALS',price:349,fit:['securityGap','emailControl','hostingControl']},
  {sku:'SBC-699-COMPLETE',price:699,fit:['needsWebsite','needsCards','highUrgency']}
];

function freshness(customer){
  const t=new Date(customer.lastContactAt||customer.sbcRevenueOutreachAt||customer.updatedAt||customer.createdAt||0).getTime();
  if(!t)return 30;
  const h=Math.max(0,(Date.now()-t)/3600000);
  return h<1?30:h<6?22:h<24?16:h<72?8:h<168?3:0;
}
function quality(customer={}){
  let score=0;const reasons=[];
  if(customer.businessName||customer.business_name){score+=12;}else reasons.push('MISSING_BUSINESS_NAME');
  if(customer.phone||customer.phone_e164){score+=18;}else reasons.push('NO_PHONE');
  if(customer.email){score+=15;}else reasons.push('NO_EMAIL');
  if(customer.website){score+=8;}
  if(customer.industry){score+=8;}else reasons.push('MISSING_INDUSTRY');
  if(['Sales Ready','Verified','verified','sales-ready'].includes(String(customer.verificationStatus||'')))score+=25;
  const temp=String(customer.leadTemperature||'').toLowerCase();if(temp==='hot')score+=12;else if(temp==='warm')score+=7;
  if(String(customer.status||'').toLowerCase()==='do not contact')return {score:0,grade:'BLOCKED',reasons:['DO_NOT_CONTACT']};
  const grade=score>=80?'A':score>=65?'B':score>=50?'C':'D';return {score,grade,reasons};
}
function offerFor(customer={},profile={}){
  const p=profile.detectedPainPoints||{};const intent=Number(profile.intentScore||customer.intentScore||0);
  if((p.needsWebsite||p.needsCards||String(p.urgency||'').toUpperCase()==='HIGH')&&intent>=75)return OFFER_LADDER[3];
  if(p.securityGap||String(p.emailControl||'').toUpperCase()==='POOR'||String(p.hostingControl||'').toUpperCase()==='POOR')return OFFER_LADDER[2];
  if(p.noWebsite||p.weakPresence||String(p.budget||'').toUpperCase()==='LOW')return OFFER_LADDER[0];
  return OFFER_LADDER[1];
}
function nextAction(customer={},profile={},hardening={}){
  const q=quality(customer);if(q.grade==='BLOCKED')return {action:'SUPPRESS',reason:q.reasons.join(',')};
  if(q.grade==='D')return {action:'ENRICH_OR_REVIEW',reason:q.reasons.join(',')};
  if(hardening.frozen)return {action:'OWNER_HANDOFF',reason:'HOT_LEAD_FROZEN'};
  const intent=Number(profile.intentScore||customer.intentScore||0);
  const offer=offerFor(customer,profile);
  if(intent>=90)return {action:'CLOSE_OR_HANDOFF',offer};
  if(intent>=75)return {action:'OFFER_AND_TRIAL_CLOSE',offer};
  if(intent>=55)return {action:'DISCOVERY',offer};
  if(customer.sbcRevenueFollowupAt)return {action:'FOLLOW_UP',offer};
  return {action:'QUALIFY',offer};
}
function followupDue(customer={}){
  const t=Number(customer.sbcRevenueOutreachAt||0);if(!t)return false;
  const count=Number(customer.sbcRevenueOutreachCount||0);const hours=CADENCE_HOURS[Math.min(count,CADENCE_HOURS.length-1)]||168;
  return Date.now()>=t+hours*3600000;
}
function opportunities(customers=[]){
  const out=[];for(const c of customers){
    const lifetime=money(c.lifetimeRevenue||c.totalRevenue||0);const status=String(c.status||'').toLowerCase();
    if(status==='customer'&&lifetime>0){
      out.push({leadId:c.id,type:'EXPANSION',score:Math.min(100,40+Math.min(40,lifetime/25)),reason:'Existing customer with recorded revenue',nextAction:'REVIEW_UPSELL_OR_RENEWAL'});
      if(c.referralSource||c.satisfactionScore>=8)out.push({leadId:c.id,type:'REFERRAL',score:75,reason:'Customer relationship signal available',nextAction:'REQUEST_REFERRAL'});
    }
    if(['lost','closed lost'].includes(status)&&new Date(c.updatedAt||0).getTime()<daysAgo(30))out.push({leadId:c.id,type:'WIN_BACK',score:55,reason:'Lost lead older than 30 days',nextAction:'REQUALIFY'});
  }return out.sort((a,b)=>b.score-a.score);
}
function revenueMetrics(customers=[],interactions=[],orders=[]){
  const wins=interactions.filter(x=>/SALE|WON|CLOSED/i.test(String(x.outcome||'')));
  const conversations=interactions.filter(x=>/CONVERSATION|CONNECTED|CALL_CONNECTED/i.test(String(x.outcome||'')));
  const revenue=wins.reduce((n,x)=>n+money(x.revenue),0)+orders.reduce((n,x)=>n+money(x.total||x.amount),0);
  return {leads:customers.length,qualified:customers.filter(c=>quality(c).score>=65).length,conversations:conversations.length,sales:wins.length,revenue:money(revenue),closeRate:conversations.length?wins.length/conversations.length:0,revenuePerConversation:conversations.length?money(revenue/conversations.length):0,averageOrderValue:wins.length?money(revenue/wins.length):0};
}
class RevenueGrowthEngine{
  constructor(ctx={}){this.ctx=ctx;this.pool=ctx.mysqlPool;this.elite=ctx.eliteCloser;this.hard=ctx.hardening;this.db=ctx.db||{};this.onRevenuePlay=ctx.onRevenuePlay;}
  async ensureTables(){if(!this.pool)return;
    await this.pool.query(`CREATE TABLE IF NOT EXISTS sbc_revenue_growth_actions_v56122(id VARCHAR(100) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,lead_id VARCHAR(100) NOT NULL,action_type VARCHAR(60) NOT NULL,priority DECIMAL(8,2) NOT NULL DEFAULT 0,status VARCHAR(30) NOT NULL DEFAULT 'READY',reason LONGTEXT,offer_sku VARCHAR(100) NOT NULL DEFAULT '',due_at DATETIME NULL,metadata_json LONGTEXT,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,INDEX idx_rg_actions(tenant_id,status,priority),INDEX idx_rg_lead(tenant_id,lead_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS sbc_revenue_growth_daily_v56122(id VARCHAR(100) PRIMARY KEY,tenant_id BIGINT NOT NULL,run_date DATE NOT NULL,metrics_json LONGTEXT NOT NULL,created_at DATETIME NOT NULL,UNIQUE KEY uq_rg_day(tenant_id,run_date)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }
  async cycle({tenantId,limit=100,auto=false}={}){
    tenantId=requireTenant(tenantId);
    await this.ensureTables();const customers=scopeCustomers(this.db.customers,tenantId);
    const scoped=scopeRevenueDb(this.db,tenantId);const interactions=scoped.eliteCloserInteractions||[];const orders=scoped.orders||[];const actions=[];
    for(const c of customers.slice(0,Math.max(1,Number(limit)))){
      const profile=this.elite?.profile?this.elite.profile(c,[]):{};const frozen=this.hard?.isFrozen?this.hard.isFrozen(c.id):false;const q=quality(c);const action=nextAction(c,profile,{frozen});
      const priority=Math.min(200,q.score+Number(profile.intentScore||0)*0.7+freshness(c)+(String(c.leadTemperature||'').toLowerCase()==='hot'?30:0));
      const offer=action.offer||offerFor(c,profile);const due=followupDue(c)?new Date().toISOString():null;
      if(action.action==='SUPPRESS')continue;
      const row={id:id('rga'),tenantId,leadId:String(c.id),actionType:action.action,priority:Math.round(priority*100)/100,status:action.action==='ENRICH_OR_REVIEW'?'REVIEW':'READY',reason:clean(action.reason||`Quality ${q.grade}; intent ${profile.intentScore||0}`,1000),offerSku:offer?.sku||'',dueAt:due,metadata:{quality:q,offer,tenBestPractices:true},createdAt:now(),updatedAt:now()};actions.push(row);
      if(this.pool)await this.pool.query(`INSERT INTO sbc_revenue_growth_actions_v56122(id,tenant_id,lead_id,action_type,priority,status,reason,offer_sku,due_at,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,[row.id,tenantId,row.leadId,row.actionType,row.priority,row.status,row.reason,row.offerSku,due?new Date(due).toISOString().slice(0,19).replace('T',' '):null,JSON.stringify(row.metadata),new Date(row.createdAt),new Date(row.updatedAt)]);
    }
    const metrics=revenueMetrics(customers,interactions,orders);const opp=opportunities(customers);metrics.opportunities=opp.length;metrics.topOpportunity=opp[0]||null;
    if(this.pool)await this.pool.query(`INSERT INTO sbc_revenue_growth_daily_v56122(id,tenant_id,run_date,metrics_json,created_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE metrics_json=VALUES(metrics_json),created_at=VALUES(created_at)`,[id('rgd'),tenantId,new Date().toISOString().slice(0,10),JSON.stringify(metrics),new Date()]);
    let revenuePlay=null;if(auto&&typeof this.onRevenuePlay==='function')revenuePlay=await this.onRevenuePlay({limit:Math.min(10,Math.max(1,Number(limit))),reason:'v56.12.2-growth-engine',tenantId});
    return {ok:true,version:VERSION,automated:true,actions:actions.sort((a,b)=>b.priority-a.priority).slice(0,50),metrics,opportunities:opp.slice(0,25),revenuePlay};
  }
  async dashboard(tenantId){tenantId=requireTenant(tenantId);await this.ensureTables();let metrics={};if(this.pool){const [r]=await this.pool.query('SELECT metrics_json FROM sbc_revenue_growth_daily_v56122 WHERE tenant_id=? ORDER BY run_date DESC LIMIT 1',[tenantId]);metrics=r[0]?JSON.parse(r[0].metrics_json||'{}'):{};}else {const scoped=scopeRevenueDb(this.db,tenantId);metrics=revenueMetrics(scoped.customers||[],scoped.eliteCloserInteractions||[],scoped.orders||[]);}return {ok:true,version:VERSION,metrics,topActions:(this.db.revenueGrowthActions||[]).slice(0,50)};}
}
module.exports={VERSION,OFFER_LADDER,CADENCE_HOURS,quality,offerFor,nextAction,followupDue,opportunities,revenueMetrics,RevenueGrowthEngine};
