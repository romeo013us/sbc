'use strict';
const crypto = require('crypto');
const VERSION = '60.4.2-state-kernel';
const GOVERNANCE_STAGES = ['OBSERVE','DIAGNOSE','RECOMMEND','APPROVE','EXECUTE','VERIFY','ROLLBACK'];
const WORKLOADS = ['CORE','SALES','TELEPHONY','FULFILLMENT','AI'];
const TRANSITIONS = {OBSERVE:'DIAGNOSE',DIAGNOSE:'RECOMMEND',RECOMMEND:'APPROVE',APPROVE:'EXECUTE',EXECUTE:'VERIFY',VERIFY:'ROLLBACK',ROLLBACK:null};
const TERMINAL = new Set(['VERIFY','ROLLBACK']);
const sha = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const uuid = p => `${p}_${crypto.randomUUID()}`;
const safeJson = v => JSON.stringify(v ?? {});

function createStateKernel({getPool, logger=console}={}) {
  if (typeof getPool !== 'function') throw new Error('State Kernel requires getPool');
  const projectionCache = new Map();
  const dirty = new Set();

  async function ensure() {
    const pool = getPool(); if (!pool) throw new Error('mysql_unavailable');
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_state_events (
      event_id VARCHAR(100) NOT NULL, tenant_id VARCHAR(80) NOT NULL, aggregate_id VARCHAR(120) NOT NULL,
      event_type VARCHAR(100) NOT NULL, idempotency_key VARCHAR(191) NOT NULL, sequence_no BIGINT UNSIGNED NOT NULL,
      payload_json JSON NOT NULL, event_hash CHAR(64) NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY(event_id), UNIQUE KEY uq_state_event_idem(tenant_id,idempotency_key),
      UNIQUE KEY uq_state_event_sequence(tenant_id,aggregate_id,sequence_no), KEY idx_state_timeline(tenant_id,aggregate_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_state_projections (
      tenant_id VARCHAR(80) NOT NULL, aggregate_id VARCHAR(120) NOT NULL, version BIGINT UNSIGNED NOT NULL DEFAULT 0,
      state_json JSON NOT NULL, state_hash CHAR(64) NOT NULL, updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY(tenant_id,aggregate_id), KEY idx_projection_tenant(tenant_id,updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_command_bus (
      command_id VARCHAR(100) NOT NULL, tenant_id VARCHAR(80) NOT NULL, aggregate_id VARCHAR(120) NULL,
      command_type VARCHAR(100) NOT NULL, idempotency_key VARCHAR(191) NOT NULL, status ENUM('RECEIVED','AUTHORIZED','EXECUTED','REJECTED') NOT NULL DEFAULT 'RECEIVED',
      payload_json JSON NOT NULL, result_json JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY(command_id), UNIQUE KEY uq_command_idem(tenant_id,idempotency_key), KEY idx_command_queue(tenant_id,status,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_kernel_cells (
      cell_id VARCHAR(120) NOT NULL, tenant_id VARCHAR(80) NOT NULL, workload ENUM('CORE','SALES','TELEPHONY','FULFILLMENT','AI') NOT NULL,
      status ENUM('ACTIVE','DRAINING','OFFLINE') NOT NULL DEFAULT 'ACTIVE', capacity INT UNSIGNED NOT NULL DEFAULT 10, active_jobs INT UNSIGNED NOT NULL DEFAULT 0,
      heartbeat_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY(cell_id), UNIQUE KEY uq_kernel_cell(tenant_id,workload), KEY idx_kernel_cells(status,workload)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_kernel_governance (
      action_id VARCHAR(100) NOT NULL, tenant_id VARCHAR(80) NOT NULL, action_type VARCHAR(100) NOT NULL,
      stage ENUM('OBSERVE','DIAGNOSE','RECOMMEND','APPROVE','EXECUTE','VERIFY','ROLLBACK') NOT NULL,
      previous_stage VARCHAR(20) NULL, payload_json JSON NOT NULL, result_json JSON NOT NULL,
      actor_id VARCHAR(120) NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY(action_id), KEY idx_kernel_governance(tenant_id,created_at), KEY idx_kernel_stage(stage)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    return true;
  }

  async function nextSequence(conn, tenantId, aggregateId) {
    const [rows] = await conn.query('SELECT COALESCE(MAX(sequence_no),0)+1 AS next_no FROM sbc_state_events WHERE tenant_id=? AND aggregate_id=? FOR UPDATE',[tenantId,aggregateId]);
    return Number(rows[0]?.next_no || 1);
  }

  function reduce(current, event) {
    const next = {...(current||{}), lastEventType:event.eventType, lastEventAt:event.createdAt};
    if (event.payload && typeof event.payload === 'object') Object.assign(next, event.payload);
    return next;
  }

  async function appendEvent({tenantId,aggregateId,eventType,payload={},idempotencyKey}) {
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable');
    tenantId=String(tenantId||'').trim(); aggregateId=String(aggregateId||'').trim(); eventType=String(eventType||'').trim(); idempotencyKey=String(idempotencyKey||'').trim();
    if(!tenantId||!aggregateId||!eventType||!idempotencyKey) throw new Error('tenant_id_aggregate_id_event_type_idempotency_key_required');
    // A bounded retry is reserved for sequence-key collisions. Each attempt gets
    // a fresh connection/transaction; idempotency replays are returned, never re-applied.
    for(let attempt=0;attempt<3;attempt++) {
      const conn=await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [existing]=await conn.query('SELECT event_id,sequence_no,event_hash,payload_json,created_at FROM sbc_state_events WHERE tenant_id=? AND idempotency_key=? LIMIT 1',[tenantId,idempotencyKey]);
        if(existing[0]) { await conn.commit(); return {ok:true,replayed:true,event:existing[0]}; }
        // Materialize a mutex row for first-use aggregates, then lock it before
        // allocating sequence numbers. This closes the empty-MAX() race.
        await conn.query('INSERT IGNORE INTO sbc_state_projections(tenant_id,aggregate_id,version,state_json,state_hash) VALUES(?,?,0,?,?)',[tenantId,aggregateId,safeJson({}),sha({})]);
        const [proj]=await conn.query('SELECT version,state_json FROM sbc_state_projections WHERE tenant_id=? AND aggregate_id=? FOR UPDATE',[tenantId,aggregateId]);
        const sequenceNo=await nextSequence(conn,tenantId,aggregateId);
        const eventId=uuid('evt'); const createdAt=new Date();
        const packet={eventId,tenantId,aggregateId,eventType,sequenceNo,payload}; const eventHash=sha(packet);
        await conn.query('INSERT INTO sbc_state_events(event_id,tenant_id,aggregate_id,event_type,idempotency_key,sequence_no,payload_json,event_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?)',[eventId,tenantId,aggregateId,eventType,idempotencyKey,sequenceNo,safeJson(payload),eventHash,createdAt]);
        const current=proj[0]?JSON.parse(proj[0].state_json||'{}'):{};
        const state=reduce(current,{eventType,payload,createdAt:createdAt.toISOString()});
        const version=Number(proj[0]?.version||0)+1; const stateHash=sha(state);
        await conn.query(`INSERT INTO sbc_state_projections(tenant_id,aggregate_id,version,state_json,state_hash) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE version=VALUES(version),state_json=VALUES(state_json),state_hash=VALUES(state_hash),updated_at=CURRENT_TIMESTAMP(6)`,[tenantId,aggregateId,version,safeJson(state),stateHash]);
        await conn.commit(); projectionCache.set(`${tenantId}:${aggregateId}`,{version,state,stateHash}); dirty.delete(`${tenantId}:${aggregateId}`);
        return {ok:true,replayed:false,event:{eventId,sequenceNo,eventHash,createdAt:createdAt.toISOString()},projection:{version,stateHash,state}};
      } catch(e) {
        await conn.rollback().catch(()=>{});
        if(e?.code==='ER_DUP_ENTRY'||e?.errno===1062) {
          const [rows]=await pool.query('SELECT event_id,sequence_no,event_hash,payload_json,created_at FROM sbc_state_events WHERE tenant_id=? AND idempotency_key=? LIMIT 1',[tenantId,idempotencyKey]);
          if(rows[0]) return {ok:true,replayed:true,event:rows[0]};
          const isSequenceCollision=String(e.message||'').includes('uq_state_event_sequence') || String(e.message||'').includes('sequence');
          if(isSequenceCollision && attempt<2) { logger.warn?.(`[SBC STATE] sequence collision retry ${attempt+1}/2`,{tenantId,aggregateId}); continue; }
        }
        throw e;
      } finally { conn.release(); }
    }
    throw new Error('STATE_SEQUENCE_RETRY_EXHAUSTED');
  }

  async function getProjection(tenantId,aggregateId,{fresh=false}={}) {
    const key=`${tenantId}:${aggregateId}`; if(!fresh && projectionCache.has(key)) return projectionCache.get(key);
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable');
    const [rows]=await pool.query('SELECT version,state_json,state_hash,updated_at FROM sbc_state_projections WHERE tenant_id=? AND aggregate_id=? LIMIT 1',[tenantId,aggregateId]);
    if(!rows[0]) return null; const out={version:Number(rows[0].version),state:JSON.parse(rows[0].state_json||'{}'),stateHash:rows[0].state_hash,updatedAt:rows[0].updated_at}; projectionCache.set(key,out); return out;
  }

  async function timeline(tenantId,aggregateId,limit=50) {
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable');
    const [rows]=await pool.query('SELECT event_id,event_type,idempotency_key,sequence_no,payload_json,event_hash,created_at FROM sbc_state_events WHERE tenant_id=? AND aggregate_id=? ORDER BY sequence_no DESC LIMIT ?',[tenantId,aggregateId,Math.max(1,Math.min(200,Number(limit)||50))]); return rows;
  }

  async function command({tenantId,aggregateId=null,commandType,payload={},idempotencyKey,authorized=false}) {
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable');
    if(!tenantId||!commandType||!idempotencyKey) throw new Error('tenant_id_command_type_idempotency_key_required');
    const commandId=uuid('cmd');
    try { await pool.query('INSERT INTO sbc_command_bus(command_id,tenant_id,aggregate_id,command_type,idempotency_key,status,payload_json,result_json) VALUES(?,?,?,?,?, ?,?,?)',[commandId,tenantId,aggregateId,commandType,idempotencyKey,authorized?'AUTHORIZED':'RECEIVED',safeJson(payload),safeJson({})]); }
    catch(e){ if(e?.code==='ER_DUP_ENTRY'||e?.errno===1062){const [r]=await pool.query('SELECT command_id,status,result_json FROM sbc_command_bus WHERE tenant_id=? AND idempotency_key=? LIMIT 1',[tenantId,idempotencyKey]); return {ok:true,replayed:true,...r[0]};} throw e; }
    return {ok:true,replayed:false,commandId,status:authorized?'AUTHORIZED':'RECEIVED'};
  }

  async function setGovernance({tenantId,actionId,actionType,stage='OBSERVE',previousStage=null,payload={},result={},actorId='system'}) {
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable');
    if(!GOVERNANCE_STAGES.includes(stage)) throw new Error('invalid_governance_stage');
    if(previousStage && TRANSITIONS[previousStage]!==stage && !(stage==='ROLLBACK' && TERMINAL.has(previousStage))) throw new Error('invalid_governance_transition');
    const id=actionId||uuid('kim');
    await pool.query('INSERT INTO sbc_kernel_governance(action_id,tenant_id,action_type,stage,previous_stage,payload_json,result_json,actor_id) VALUES(?,?,?,?,?,?,?,?)',[id,tenantId,actionType,stage,previousStage,safeJson(payload),safeJson(result),String(actorId)]);
    return {ok:true,actionId:id,stage,nextStage:TRANSITIONS[stage]};
  }

  async function heartbeatCell({tenantId,workload,capacity=10,status='ACTIVE',activeJobs=0}) {
    if(!WORKLOADS.includes(workload)) throw new Error('invalid_workload');
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable'); const cellId=`cell_${tenantId}_${workload.toLowerCase()}`;
    await pool.query(`INSERT INTO sbc_kernel_cells(cell_id,tenant_id,workload,status,capacity,active_jobs,heartbeat_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE status=VALUES(status),capacity=VALUES(capacity),active_jobs=VALUES(active_jobs),heartbeat_at=CURRENT_TIMESTAMP(6)`,[cellId,tenantId,workload,status,Math.max(1,Number(capacity)||10),Math.max(0,Number(activeJobs)||0)]);
    return {cellId,tenantId,workload,status,capacity:Math.max(1,Number(capacity)||10),activeJobs:Math.max(0,Number(activeJobs)||0)};
  }

  async function cells(tenantId) { const pool=getPool(); if(!pool) throw new Error('mysql_unavailable'); const [rows]=await pool.query('SELECT cell_id,tenant_id,workload,status,capacity,active_jobs,heartbeat_at FROM sbc_kernel_cells WHERE tenant_id=? ORDER BY workload',[tenantId]); return rows; }

  async function rebuildProjection(tenantId,aggregateId) {
    const pool=getPool(); if(!pool) throw new Error('mysql_unavailable'); const [events]=await pool.query('SELECT event_type,payload_json,created_at FROM sbc_state_events WHERE tenant_id=? AND aggregate_id=? ORDER BY sequence_no ASC',[tenantId,aggregateId]);
    let state={}; for(const e of events) state=reduce(state,{eventType:e.event_type,payload:JSON.parse(e.payload_json||'{}'),createdAt:e.created_at}); const version=events.length; const stateHash=sha(state);
    await pool.query('INSERT INTO sbc_state_projections(tenant_id,aggregate_id,version,state_json,state_hash) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE version=VALUES(version),state_json=VALUES(state_json),state_hash=VALUES(state_hash),updated_at=CURRENT_TIMESTAMP(6)',[tenantId,aggregateId,version,safeJson(state),stateHash]); projectionCache.set(`${tenantId}:${aggregateId}`,{version,state,stateHash}); return {version,stateHash,state};
  }
  return {VERSION,GOVERNANCE_STAGES,WORKLOADS,TRANSITIONS,ensure,appendEvent,getProjection,timeline,command,setGovernance,heartbeatCell,cells,rebuildProjection};
}
module.exports={VERSION,GOVERNANCE_STAGES,WORKLOADS,TRANSITIONS,createStateKernel};
