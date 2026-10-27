'use strict';
const crypto = require('crypto');

const { RELEASE_VERSION } = require('../config/release-identity');
const VERSION = `${RELEASE_VERSION}-commercial-os`;
const DEFAULT_PLANS = [
  {id:'quickstart',name:'Quickstart',monthly:0,setup:99,description:'Business foundation without website build.',features:['Google Business Profile','Business cards','Social profiles']},
  {id:'starter',name:'Business Starter',monthly:29,setup:199,description:'Core business presence and operating tools.',features:['Domain','SSL','Managed hosting','Business email','CRM']},
  {id:'essentials',name:'Business Essentials',monthly:49,setup:349,description:'Most popular operating package.',features:['Everything in Starter','Microsoft 365 email','Backups','Security','Lead workflows','Kim assistance']},
  {id:'professional',name:'Professional Business',monthly:99,setup:699,description:'Full managed business operating package.',features:['Everything in Essentials','Advanced automation','Fulfillment','Revenue intelligence','Priority support']},
  {id:'growth',name:'Business Growth',monthly:199,setup:999,description:'Advanced growth and automation.',features:['Everything in Professional','Advanced AI operations','Customer success automation','Usage metering','Executive analytics']}
];
const ROLE_PLAYBOOKS = {
  owner:{label:'Owner',focus:'Revenue, approvals, strategy, risk',queue:['Review revenue','Approve exceptions','Review customer health','Review system health']},
  manager:{label:'Sales Manager',focus:'Pipeline, coaching, team performance',queue:['Review pipeline','Coach reps','Resolve escalations','Review conversion']},
  sales_rep:{label:'Sales Rep',focus:'Conversations, appointments, closes',queue:['Work priority leads','Follow up','Book appointments','Close opportunities']},
  lead_researcher:{label:'Lead Generator',focus:'Verified, sales-ready opportunities',queue:['Research businesses','Verify contacts','Score leads','Queue outreach']},
  customer_success:{label:'Customer Success',focus:'Adoption, retention, expansion',queue:['Review health','Resolve blockers','Drive adoption','Identify expansion']},
  fulfillment:{label:'Fulfillment',focus:'Delivery quality and speed',queue:['Process orders','Update milestones','QA deliverables','Complete handoff']},
  finance:{label:'Finance',focus:'Collections, margin, reconciliation',queue:['Review payments','Review margin','Reconcile ledger','Escalate exceptions']}
};

function id(prefix='id'){ return `${prefix}_${crypto.randomUUID()}`; }
function now(){ return new Date().toISOString(); }
function hashAction(payload){ return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'); }

function createCommercialOS({getPool, logger=console}={}){
  if(typeof getPool!=='function') throw new Error('Commercial OS requires getPool');
  async function ensure(){
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable');
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_commercial_plans (
      plan_id VARCHAR(64) NOT NULL, name VARCHAR(120) NOT NULL, monthly_cents BIGINT NOT NULL DEFAULT 0,
      setup_cents BIGINT NOT NULL DEFAULT 0, description VARCHAR(500) NOT NULL, features_json JSON NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY(plan_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_saas_tenants (
      tenant_id VARCHAR(80) NOT NULL, business_name VARCHAR(255) NOT NULL, plan_id VARCHAR(64) NOT NULL,
      status ENUM('PROVISIONING','ACTIVE','SUSPENDED','CANCELLED') NOT NULL DEFAULT 'PROVISIONING',
      idempotency_key VARCHAR(191) NOT NULL, metadata_json JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY(tenant_id), UNIQUE KEY uq_tenant_idem(idempotency_key), KEY idx_tenant_plan(status,plan_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_commercial_ledger (
      ledger_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, tenant_id VARCHAR(80) NOT NULL, event_id VARCHAR(100) NOT NULL,
      event_type VARCHAR(80) NOT NULL, units BIGINT NOT NULL DEFAULT 0, amount_cents BIGINT NOT NULL DEFAULT 0,
      metadata_json JSON NOT NULL, action_hash CHAR(64) NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY(ledger_id), UNIQUE KEY uq_ledger_event(event_id), KEY idx_ledger_timeline(tenant_id,created_at), KEY idx_ledger_type(tenant_id,event_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_onboarding_runs (
      onboarding_id VARCHAR(100) NOT NULL, tenant_id VARCHAR(80) NOT NULL, status ENUM('STARTED','READY','BLOCKED') NOT NULL DEFAULT 'STARTED',
      steps_json JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY(onboarding_id), UNIQUE KEY uq_onboard_tenant(tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_customer_health (
      tenant_id VARCHAR(80) NOT NULL, health_score DECIMAL(5,2) NOT NULL DEFAULT 100, status ENUM('HEALTHY','WATCH','AT_RISK') NOT NULL DEFAULT 'HEALTHY',
      adoption_score DECIMAL(5,2) NOT NULL DEFAULT 0, engagement_score DECIMAL(5,2) NOT NULL DEFAULT 0, payment_score DECIMAL(5,2) NOT NULL DEFAULT 100,
      blockers_json JSON NOT NULL, computed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY(tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    for(const p of DEFAULT_PLANS){
      await pool.query(`INSERT INTO sbc_commercial_plans(plan_id,name,monthly_cents,setup_cents,description,features_json) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),monthly_cents=VALUES(monthly_cents),setup_cents=VALUES(setup_cents),description=VALUES(description),features_json=VALUES(features_json),updated_at=CURRENT_TIMESTAMP(6)`,[p.id,p.name,p.monthly*100,p.setup*100,p.description,JSON.stringify(p.features)]);
    }
    return true;
  }

  async function provisionTenant({businessName,planId='growth',idempotencyKey,metadata={}}){
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable');
    const key=String(idempotencyKey||'').trim(); if(!key) throw new Error('idempotency_key_required');
    const plan=DEFAULT_PLANS.find(p=>p.id===planId); if(!plan) throw new Error('invalid_plan');
    const existing=await pool.query('SELECT tenant_id,status,plan_id FROM sbc_saas_tenants WHERE idempotency_key=? LIMIT 1',[key]);
    if(existing[0][0]) return {ok:true,replayed:true,tenantId:existing[0][0].tenant_id,status:existing[0][0].status,planId:existing[0][0].plan_id};
    const tenantId=id('tenant'); const onboardingId=id('onboard');
    const steps=['account','profile','plan','crm','communications','payments','training','go_live'];
    const conn=await pool.getConnection();
    try{
      await conn.beginTransaction();
      await conn.query('INSERT INTO sbc_saas_tenants(tenant_id,business_name,plan_id,status,idempotency_key,metadata_json) VALUES(?,?,?,?,?,?)',[tenantId,String(businessName||'').trim()||'New SBC Business',plan.id,'PROVISIONING',key,JSON.stringify(metadata)]);
      await conn.query('INSERT INTO sbc_onboarding_runs(onboarding_id,tenant_id,status,steps_json) VALUES(?,?,?,?,?)'.replace('VALUES(?,?,?,?,?)','VALUES(?,?,?,?)'),[onboardingId,tenantId,'STARTED',JSON.stringify(steps.map(name=>({name,status:'PENDING'})))]);
      await conn.query('INSERT INTO sbc_customer_health(tenant_id,health_score,status,blockers_json) VALUES(?,?,?,?)',[tenantId,100,'HEALTHY',JSON.stringify([])]);
      await conn.query('INSERT INTO sbc_commercial_ledger(tenant_id,event_id,event_type,units,amount_cents,metadata_json,action_hash) VALUES(?,?,?,?,?,?,?)',[tenantId,id('evt'),'TENANT_PROVISIONED',0,plan.setup*100,JSON.stringify({planId:plan.id}),hashAction({tenantId,planId:plan.id,key})]);
      await conn.commit();
      await pool.query("UPDATE sbc_saas_tenants SET status='ACTIVE',updated_at=CURRENT_TIMESTAMP(6) WHERE tenant_id=?",[tenantId]);
      return {ok:true,replayed:false,tenantId,onboardingId,status:'ACTIVE',planId:plan.id};
    }catch(e){
      await conn.rollback().catch(()=>{});
      if(e && (e.code==='ER_DUP_ENTRY'||e.errno===1062)){
        const [rows]=await pool.query('SELECT tenant_id,status,plan_id FROM sbc_saas_tenants WHERE idempotency_key=? LIMIT 1',[key]);
        if(rows[0]) return {ok:true,replayed:true,tenantId:rows[0].tenant_id,status:rows[0].status,planId:rows[0].plan_id};
      }
      throw e;
    }finally{conn.release();}
  }

  async function recordUsage({tenantId,eventType='USAGE',units=0,amountCents=0,metadata={},eventId}){
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable');
    if(!tenantId) throw new Error('tenant_id_required');
    const eid=String(eventId||id('evt'));
    const actionHash=hashAction({tenantId,eventType,units,amountCents,metadata,eid});
    try{
      const [r]=await pool.query('INSERT INTO sbc_commercial_ledger(tenant_id,event_id,event_type,units,amount_cents,metadata_json,action_hash) VALUES(?,?,?,?,?,?,?)',[tenantId,eid,eventType,Number(units)||0,Number(amountCents)||0,JSON.stringify(metadata),actionHash]);
      return {ok:true,ledgerId:r.insertId,eventId:eid,recorded:true};
    }catch(e){
      if(e && (e.code==='ER_DUP_ENTRY'||e.errno===1062)) return {ok:true,eventId:eid,recorded:false,replayed:true};
      throw e;
    }
  }

  async function completeOnboarding(tenantId){
    const pool=getPool();
    const [rows]=await pool.query('SELECT onboarding_id,steps_json FROM sbc_onboarding_runs WHERE tenant_id=? LIMIT 1',[tenantId]);
    if(!rows[0]) throw new Error('onboarding_not_found');
    const steps=JSON.parse(rows[0].steps_json||'[]').map(x=>({...x,status:'COMPLETE',completedAt:now()}));
    await pool.query("UPDATE sbc_onboarding_runs SET status='READY',steps_json=?,updated_at=CURRENT_TIMESTAMP(6) WHERE tenant_id=?",[JSON.stringify(steps),tenantId]);
    await pool.query("UPDATE sbc_saas_tenants SET status='ACTIVE',updated_at=CURRENT_TIMESTAMP(6) WHERE tenant_id=?",[tenantId]);
    return {ok:true,tenantId,status:'READY',steps};
  }

  async function health(tenantId){
    const pool=getPool();
    const [rows]=await pool.query('SELECT tenant_id,health_score,status,adoption_score,engagement_score,payment_score,blockers_json,computed_at FROM sbc_customer_health WHERE tenant_id=?',[tenantId]);
    return rows[0]||null;
  }

  async function summary(){
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable');
    const [[counts]] = await pool.query(`SELECT COUNT(*) tenants, SUM(status='ACTIVE') activeTenants, SUM(status='PROVISIONING') provisioning, SUM(status='AT_RISK') atRisk FROM sbc_saas_tenants`);
    const [[rev]] = await pool.query(`SELECT COALESCE(SUM(amount_cents),0) ledgerCents, COUNT(*) ledgerEvents FROM sbc_commercial_ledger`);
    const [plans]=await pool.query('SELECT plan_id,name,monthly_cents,setup_cents,active FROM sbc_commercial_plans WHERE active=1 ORDER BY monthly_cents');
    const [healthRows]=await pool.query(`SELECT status,COUNT(*) count FROM sbc_customer_health GROUP BY status`);
    return {version:VERSION,counts,ledger:{...rev},plans,health:healthRows,rolePlaybooks:ROLE_PLAYBOOKS};
  }

  return {VERSION,ensure,provisionTenant,recordUsage,completeOnboarding,health,summary,ROLE_PLAYBOOKS};
}

module.exports={createCommercialOS,DEFAULT_PLANS,ROLE_PLAYBOOKS,VERSION};
