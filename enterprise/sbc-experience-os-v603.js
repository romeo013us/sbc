'use strict';
const crypto = require('crypto');

const VERSION = '60.3.0-experience-os';
const GOVERNANCE_STAGES = ['OBSERVE','DIAGNOSE','RECOMMEND','APPROVE','EXECUTE','VERIFY','ROLLBACK'];
const ROLE_QUEUES = {
  owner: ['revenue','risk','approvals','customer_health','system_health'],
  manager: ['pipeline','coaching','escalations','conversion'],
  sales_rep: ['priority_leads','followups','appointments','closes'],
  lead_researcher: ['research','verification','scoring','outreach_queue'],
  customer_success: ['health','blockers','adoption','expansion'],
  fulfillment: ['orders','milestones','qa','handoff'],
  finance: ['payments','margin','reconciliation','exceptions']
};
function id(prefix){ return `${prefix}_${crypto.randomUUID()}`; }
function now(){ return new Date().toISOString(); }
function clamp(n,min=0,max=100){ return Math.max(min,Math.min(max,Number(n)||0)); }

function computeHealth({adoption=0,engagement=0,payment=100,blockers=0}={}){
  const blockerPenalty=Math.min(35,Number(blockers||0)*8);
  const score=clamp((Number(adoption)||0)*0.35+(Number(engagement)||0)*0.35+(Number(payment)||0)*0.30-blockerPenalty);
  return {score:Number(score.toFixed(2)),status:score<50?'AT_RISK':score<75?'WATCH':'HEALTHY'};
}

function createExperienceOS({getPool,logger=console}={}){
  if(typeof getPool!=='function') throw new Error('Experience OS requires getPool');
  async function ensure(){
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable');
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_experience_profiles (
      tenant_id VARCHAR(80) NOT NULL, profile_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
      metadata_json JSON NOT NULL, custom_fields_json JSON NOT NULL, updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY(tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_customer_timeline (
      timeline_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, tenant_id VARCHAR(80) NOT NULL,
      event_type VARCHAR(80) NOT NULL, actor_role VARCHAR(40) NOT NULL DEFAULT 'system', payload_json JSON NOT NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY(timeline_id),
      KEY idx_timeline_tenant_time(tenant_id,created_at), KEY idx_timeline_type(tenant_id,event_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_role_work_queue (
      task_id VARCHAR(100) NOT NULL, tenant_id VARCHAR(80) NOT NULL, role_id VARCHAR(40) NOT NULL,
      queue_type VARCHAR(60) NOT NULL, priority INT NOT NULL DEFAULT 50, status ENUM('OPEN','CLAIMED','DONE','BLOCKED') NOT NULL DEFAULT 'OPEN',
      title VARCHAR(255) NOT NULL, payload_json JSON NOT NULL, due_at DATETIME(6) NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY(task_id), KEY idx_queue_role(role_id,status,priority), KEY idx_queue_tenant(tenant_id,status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_logical_cells (
      cell_id VARCHAR(100) NOT NULL, tenant_id VARCHAR(80) NOT NULL, workload VARCHAR(60) NOT NULL,
      status ENUM('ACTIVE','DRAINING','OFFLINE') NOT NULL DEFAULT 'ACTIVE', capacity INT NOT NULL DEFAULT 10,
      active_jobs INT NOT NULL DEFAULT 0, heartbeat_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY(cell_id), UNIQUE KEY uq_cell_tenant_workload(tenant_id,workload), KEY idx_cell_status(status,workload)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_kim_governance (
      action_id VARCHAR(100) NOT NULL, tenant_id VARCHAR(80) NOT NULL, action_type VARCHAR(100) NOT NULL,
      stage ENUM('OBSERVE','DIAGNOSE','RECOMMEND','APPROVE','EXECUTE','VERIFY','ROLLBACK') NOT NULL,
      payload_json JSON NOT NULL, result_json JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY(action_id),
      KEY idx_kim_tenant_time(tenant_id,created_at), KEY idx_kim_stage(stage)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    return true;
  }

  async function upsertProfile({tenantId,metadata={},customFields={}}){
    if(!tenantId) throw new Error('tenant_id_required');
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable');
    const [r]=await pool.query(`INSERT INTO sbc_experience_profiles(tenant_id,profile_version,metadata_json,custom_fields_json)
      VALUES(?,?,?,?,?)`.replace('VALUES(?,?,?,?,?)','VALUES(?,?,?,?)')+
      ` ON DUPLICATE KEY UPDATE profile_version=profile_version+1,metadata_json=VALUES(metadata_json),custom_fields_json=VALUES(custom_fields_json),updated_at=CURRENT_TIMESTAMP(6)`,
      [tenantId,1,JSON.stringify(metadata),JSON.stringify(customFields)]);
    const [rows]=await pool.query('SELECT tenant_id,profile_version,metadata_json,custom_fields_json,updated_at FROM sbc_experience_profiles WHERE tenant_id=?',[tenantId]);
    return rows[0]||{tenant_id:tenantId,profile_version:r?.insertId||1,metadata_json:'{}',custom_fields_json:'{}'};
  }

  async function customer360(tenantId,{timelineLimit=50}={}){
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable');
    const [[tenant]] = await pool.query('SELECT tenant_id,business_name,plan_id,status,metadata_json,created_at,updated_at FROM sbc_saas_tenants WHERE tenant_id=?',[tenantId]);
    if(!tenant) return null;
    const [[health]] = await pool.query('SELECT tenant_id,health_score,status,adoption_score,engagement_score,payment_score,blockers_json,computed_at FROM sbc_customer_health WHERE tenant_id=?',[tenantId]);
    const [ledger]=await pool.query('SELECT event_id,event_type,units,amount_cents,metadata_json,created_at FROM sbc_commercial_ledger WHERE tenant_id=? ORDER BY created_at DESC LIMIT 50',[tenantId]);
    const [timeline]=await pool.query('SELECT timeline_id,event_type,actor_role,payload_json,created_at FROM sbc_customer_timeline WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?',[tenantId,Math.max(1,Math.min(200,Number(timelineLimit)||50))]);
    const [profile]=await pool.query('SELECT profile_version,metadata_json,custom_fields_json,updated_at FROM sbc_experience_profiles WHERE tenant_id=?',[tenantId]);
    return {tenant,health,profile:profile[0]||null,ledger,timeline};
  }

  async function snapshot(tenantId){
    const data=await customer360(tenantId,{timelineLimit:100});
    if(!data) return null;
    return {version:VERSION,generatedAt:now(),tenantId,readModel:data,etag:crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')};
  }

  async function addTimeline({tenantId,eventType,actorRole='system',payload={}}){
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable');
    const [r]=await pool.query('INSERT INTO sbc_customer_timeline(tenant_id,event_type,actor_role,payload_json) VALUES(?,?,?,?)',[tenantId,eventType,actorRole,JSON.stringify(payload)]);
    return {ok:true,timelineId:r.insertId};
  }

  async function queueTask({tenantId,roleId,queueType,title,priority=50,payload={},dueAt=null}){
    if(!ROLE_QUEUES[roleId]) throw new Error('invalid_role');
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable');
    const taskId=id('task');
    await pool.query('INSERT INTO sbc_role_work_queue(task_id,tenant_id,role_id,queue_type,priority,title,payload_json,due_at) VALUES(?,?,?,?,?,?,?,?)',[taskId,tenantId,roleId,queueType,Number(priority)||50,title,JSON.stringify(payload),dueAt]);
    return {ok:true,taskId};
  }

  async function workQueue({tenantId,roleId,status='OPEN',limit=25}){
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable');
    const args=[tenantId,status]; let sql='SELECT task_id,tenant_id,role_id,queue_type,priority,status,title,payload_json,due_at,created_at,updated_at FROM sbc_role_work_queue WHERE tenant_id=? AND status=?';
    if(roleId){sql+=' AND role_id=?';args.push(roleId);}
    sql+=' ORDER BY priority ASC, due_at IS NULL, due_at ASC, created_at ASC LIMIT ?';args.push(Math.max(1,Math.min(100,Number(limit)||25)));
    const [rows]=await pool.query(sql,args); return rows;
  }

  async function upsertCell({tenantId,workload,capacity=10}){
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable');
    const cellId=`cell_${tenantId}_${workload}`;
    await pool.query(`INSERT INTO sbc_logical_cells(cell_id,tenant_id,workload,capacity,heartbeat_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP(6))
      ON DUPLICATE KEY UPDATE capacity=VALUES(capacity),heartbeat_at=CURRENT_TIMESTAMP(6),status='ACTIVE'`,[cellId,tenantId,workload,Math.max(1,Number(capacity)||10)]);
    return {cellId,tenantId,workload,status:'ACTIVE'};
  }

  async function govern({tenantId,actionType,stage='OBSERVE',payload={},result={}}){
    if(!GOVERNANCE_STAGES.includes(stage)) throw new Error('invalid_governance_stage');
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable');
    const actionId=id('kim');
    await pool.query('INSERT INTO sbc_kim_governance(action_id,tenant_id,action_type,stage,payload_json,result_json) VALUES(?,?,?,?,?,?)',[actionId,tenantId,actionType,stage,JSON.stringify(payload),JSON.stringify(result)]);
    return {ok:true,actionId,stage,nextStage:stage==='OBSERVE'?'DIAGNOSE':stage==='DIAGNOSE'?'RECOMMEND':stage==='RECOMMEND'?'APPROVE':stage==='APPROVE'?'EXECUTE':stage==='EXECUTE'?'VERIFY':stage==='VERIFY'?'ROLLBACK':null};
  }

  async function governanceHistory(tenantId,limit=50){
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable');
    const [rows]=await pool.query('SELECT action_id,tenant_id,action_type,stage,payload_json,result_json,created_at,updated_at FROM sbc_kim_governance WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?',[tenantId,Math.max(1,Math.min(100,Number(limit)||50))]);
    return rows;
  }

  return {VERSION,GOVERNANCE_STAGES,ROLE_QUEUES,ensure,upsertProfile,customer360,snapshot,addTimeline,queueTask,workQueue,upsertCell,govern,governanceHistory,computeHealth};
}
module.exports={VERSION,GOVERNANCE_STAGES,ROLE_QUEUES,computeHealth,createExperienceOS};
