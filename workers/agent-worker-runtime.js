'use strict';

/**
 * SBC V65.1.0: transaction-safe agent queue claim.
 * Recovery remains fail-closed by default. The runtime will not claim or mutate
 * queue rows unless a caller explicitly supplies recoveryRequired() => false.
 */
class AgentWorkerRuntime {
  constructor(poolProvider, { recoveryRequired = () => true, workerId = `worker-${process.pid}` } = {}) {
    this.poolProvider = poolProvider;
    this.recoveryRequired = recoveryRequired;
    this.workerId = String(workerId || `worker-${process.pid}`);
  }

  async claimNextTask(db) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [settings] = await connection.execute(
        "SELECT setting_value FROM sbc_global_settings WHERE setting_key='global_emergency_kill_switch' LIMIT 1"
      );
      if (settings.length && Number(settings[0].setting_value) === 0) {
        await connection.rollback();
        return { status: 'SYSTEM_DISABLED' };
      }

      const [tasks] = await connection.execute(
        `SELECT * FROM sbc_agent_event_bus
         WHERE status='pending' ORDER BY priority ASC,id ASC LIMIT 1 FOR UPDATE SKIP LOCKED`
      );
      if (!tasks.length) {
        await connection.commit();
        return { status: 'IDLE' };
      }

      const task = tasks[0];
      const [updated] = await connection.execute(
        "UPDATE sbc_agent_event_bus SET status='processing' WHERE id=? AND status='pending'",
        [task.id]
      );
      if (updated && typeof updated.affectedRows === 'number' && updated.affectedRows !== 1) {
        await connection.rollback();
        return { status: 'CLAIM_LOST' };
      }
      await connection.commit();
      return { status: 'CLAIMED', task };
    } catch (error) {
      try { await connection.rollback(); } catch (_) {}
      throw error;
    } finally {
      connection.release();
    }
  }

  async executeNextWorkerTask() {
    if (this.recoveryRequired()) return { status: 'RECOVERY_LOCKED', readOnly: true };
    const db = this.poolProvider?.();
    if (!db) return { status: 'NO_DATABASE' };

    const claim = await this.claimNextTask(db);
    if (claim.status !== 'CLAIMED') return claim;
    const activeJob = claim.task;
    let payload = {};
    try {
      payload = typeof activeJob.payload === 'string' ? JSON.parse(activeJob.payload) : (activeJob.payload || {});
    } catch (_) {
      await db.execute("UPDATE sbc_agent_event_bus SET status='failed',error_log=? WHERE id=?",
        ['INVALID_JSON_PAYLOAD', activeJob.id]);
      return { status: 'FAILED', error: 'INVALID_JSON_PAYLOAD', taskId: activeJob.id };
    }

    if (['checkout.ready', 'quote.generate'].includes(activeJob.event_type)) {
      const baseCost = Number(payload.vendor_cost || 0);
      if (!(baseCost > 0)) {
        await db.execute(
          "UPDATE sbc_agent_event_bus SET status='frozen',error_log=? WHERE id=? AND status='processing'",
          ['ECONOMIC_GATE_BLOCK: SKU vendor baseline remains unconfigured or zero.', activeJob.id]
        );
        return { status: 'FROZEN', taskId: activeJob.id };
      }
    }

    try {
      await db.execute(
        "UPDATE sbc_agent_event_bus SET status='completed',processed_at=UTC_TIMESTAMP() WHERE id=? AND status='processing'",
        [activeJob.id]
      );
      return { status: 'SUCCESS', taskId: activeJob.id };
    } catch (error) {
      await db.execute(
        "UPDATE sbc_agent_event_bus SET status='failed',error_log=? WHERE id=? AND status='processing'",
        [String(error.message || 'worker_failed').slice(0, 1000), activeJob.id]
      );
      return { status: 'FAILED', error: error.message, taskId: activeJob.id };
    }
  }
}

if (require.main === module) {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE || 5)
  });
  // Standalone worker is intentionally locked unless explicitly enabled after
  // authoritative recovery has been independently verified by the owner.
  const recoveryRequired = () => !['0', 'false', 'no'].includes(String(process.env.SBC_RECOVERY_REQUIRED || 'true').toLowerCase());
  const runtime = new AgentWorkerRuntime(() => pool, { recoveryRequired });
  const loop = async () => {
    try { await runtime.executeNextWorkerTask(); }
    catch (error) { console.error('[WORKER]', error.message); }
    setTimeout(loop, 1000);
  };
  loop();
}

module.exports = { AgentWorkerRuntime };
