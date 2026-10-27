'use strict';

const crypto = require('crypto');

/**
 * V64.3.3 durable worker integrity gate.
 *
 * Queue ownership is row-locked and idempotent. External side effects are
 * never blindly replayed after an ambiguous timeout: an IN_FLIGHT operation
 * becomes HOLD_FOR_RECONCILIATION until its provider result is known.
 */
class AgentWorkerACIDGate {
  constructor({ pool, leaseSeconds = 120, now = () => new Date() } = {}) {
    if (!pool) throw new Error('AgentWorkerACIDGate requires pool');
    this.pool = pool;
    this.leaseSeconds = Math.max(30, Number(leaseSeconds) || 120);
    this.now = now;
  }

  static operationKey({tenantId='0', action, aggregateId='', payload={}}={}) {
    return crypto.createHash('sha256').update(JSON.stringify({tenantId:String(tenantId),action:String(action||''),aggregateId:String(aggregateId||''),payload})).digest('hex');
  }

  async claimNext(workerId) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [rows] = await c.query(
        `SELECT * FROM sbc_agent_event_bus
          WHERE status = 'PENDING'
             OR (status = 'PROCESSING' AND lease_until < NOW())
          ORDER BY priority ASC, id ASC
          LIMIT 1 FOR UPDATE SKIP LOCKED`
      );
      if (!rows.length) { await c.rollback(); return null; }
      const job = rows[0];
      await c.query(
        `UPDATE sbc_agent_event_bus SET status='PROCESSING', worker_id=?,
                lease_until=DATE_ADD(NOW(), INTERVAL ? SECOND),
                started_at=COALESCE(started_at,NOW()),
                attempt_count=COALESCE(attempt_count,0)+1
          WHERE id=?`, [workerId,this.leaseSeconds,job.id]
      );
      await c.commit();
      return {...job,status:'PROCESSING',worker_id:workerId};
    } catch(e) { try{await c.rollback();}catch(_){} throw e; }
    finally { c.release(); }
  }

  async beginExternalOperation({tenantId,action,aggregateId,payload={}}={}) {
    const idempotencyKey = AgentWorkerACIDGate.operationKey({tenantId,action,aggregateId,payload});
    const [existing] = await this.pool.execute(
      `SELECT status,provider_reference,result_json FROM sbc_agent_operation_ledger WHERE idempotency_key=? LIMIT 1`,
      [idempotencyKey]
    );
    if (existing.length) {
      const row=existing[0];
      if (row.status==='COMPLETED') return {allowed:false,status:'ALREADY_COMPLETED',idempotencyKey,providerReference:row.provider_reference,result:row.result_json};
      if (row.status==='IN_FLIGHT' || row.status==='HOLD_FOR_RECONCILIATION') return {allowed:false,status:'HOLD_FOR_RECONCILIATION',idempotencyKey};
    }
    try {
      await this.pool.execute(
        `INSERT INTO sbc_agent_operation_ledger
          (idempotency_key,tenant_id,action,aggregate_id,payload_json,status,created_at,updated_at)
         VALUES(?,?,?,?,?,'IN_FLIGHT',UTC_TIMESTAMP(),UTC_TIMESTAMP())`,
        [idempotencyKey,String(tenantId||'0'),String(action||''),String(aggregateId||''),JSON.stringify(payload)]
      );
      return {allowed:true,status:'AUTHORIZED',idempotencyKey};
    } catch(e) {
      if(e.code==='ER_DUP_ENTRY') return {allowed:false,status:'HOLD_FOR_RECONCILIATION',idempotencyKey};
      throw e;
    }
  }

  async completeExternalOperation(idempotencyKey,{providerReference=null,result=null}={}) {
    await this.pool.execute(
      `UPDATE sbc_agent_operation_ledger SET status='COMPLETED',provider_reference=?,result_json=?,updated_at=UTC_TIMESTAMP() WHERE idempotency_key=? AND status='IN_FLIGHT'`,
      [providerReference,JSON.stringify(result),idempotencyKey]
    );
    return {status:'COMPLETED',idempotencyKey};
  }

  async holdExternalOperation(idempotencyKey,reason='AMBIGUOUS_PROVIDER_RESULT') {
    await this.pool.execute(
      `UPDATE sbc_agent_operation_ledger SET status='HOLD_FOR_RECONCILIATION',last_error=?,updated_at=UTC_TIMESTAMP() WHERE idempotency_key=? AND status='IN_FLIGHT'`,
      [String(reason).slice(0,1000),idempotencyKey]
    );
    return {status:'HOLD_FOR_RECONCILIATION',idempotencyKey};
  }

  async complete(jobId,workerId,result=null) {
    return this.#finish(jobId,workerId,'COMPLETED',{result_json:JSON.stringify(result)});
  }
  async fail(jobId,workerId,errorMessage) {
    return this.#finish(jobId,workerId,'PENDING',{last_error:String(errorMessage||'worker_failed').slice(0,1000)});
  }
  async #finish(jobId,workerId,status,fields) {
    const c=await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [rows]=await c.query(`SELECT id,status,worker_id FROM sbc_agent_event_bus WHERE id=? LIMIT 1 FOR UPDATE`,[jobId]);
      if(!rows.length){await c.rollback();return {status:'MISSING'};}
      if(rows[0].worker_id!==workerId || rows[0].status!=='PROCESSING'){await c.rollback();return {status:'LEASE_LOST'};}
      const sets=[]; const vals=[];
      for(const [k,v] of Object.entries(fields)){sets.push(`${k}=?`);vals.push(v);}
      sets.push(`status=?`,`lease_until=NULL`); vals.push(status,jobId,workerId);
      await c.query(`UPDATE sbc_agent_event_bus SET ${sets.join(',')} WHERE id=? AND worker_id=?`,vals);
      await c.commit();
      return {status};
    } catch(e){try{await c.rollback();}catch(_){}throw e;} finally{c.release();}
  }
}
module.exports = { AgentWorkerACIDGate };
