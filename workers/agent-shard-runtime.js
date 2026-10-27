'use strict';

const crypto = require('crypto');
const { AgentWorkerACIDGate } = (() => {
  const Gate = require('./AgentWorkerACIDGate');
  return { AgentWorkerACIDGate: Gate };
})();

/**
 * V58.3 FULL CONCURRENCY RUNTIME
 *
 * One process = one shard role.
 * Database row locks are the source of truth for work ownership.
 * Workers never rely on process-local state for correctness.
 */
class AgentShardRuntime {
  constructor({
    pool,
    shard = process.env.SBC_WORKER_SHARD || 'slot-1-core',
    workerId = process.env.SBC_WORKER_ID || `${shard}-${process.pid}`,
    pollMs = Number(process.env.SBC_WORKER_POLL_MS || 1000),
    concurrency = Number(process.env.SBC_WORKER_CONCURRENCY || 1),
    leaseSeconds = Number(process.env.SBC_WORKER_LEASE_SECONDS || 120),
    handler = async () => ({ ok: true })
  } = {}) {
    if (!pool) throw new Error('AgentShardRuntime requires pool');
    this.pool = pool;
    this.shard = shard;
    this.workerId = workerId;
    this.pollMs = Math.max(250, pollMs);
    this.concurrency = Math.max(1, Math.min(4, concurrency));
    this.maxFailures = Math.max(1, Math.min(20, Number(process.env.SBC_SHARD_MAX_FAILURES || 5)));
    this.consecutiveFailures = 0;
    this.leaseSeconds = Math.max(30, leaseSeconds);
    this.handler = handler;
    this.running = false;
    this.active = 0;
    this.gate = new AgentWorkerACIDGate({ pool, leaseSeconds });
    this.timers = new Set();
  }

  async isShardEnabled() {
    const [rows] = await this.pool.query(
      `SELECT enabled, max_concurrency
         FROM sbc_compute_worker_shards
        WHERE shard_name = ?
        LIMIT 1`,
      [this.shard]
    );
    if (!rows.length) return true;
    if (Number(rows[0].enabled) !== 1) return false;
    this.concurrency = Math.max(1, Math.min(4, Number(rows[0].max_concurrency) || this.concurrency));
    return true;
  }

  async tick() {
    if (!this.running || this.active >= this.concurrency) return;
    if (!(await this.isShardEnabled())) return;

    const job = await this.gate.claimNext(this.workerId);
    if (!job) return;

    this.active++;
    Promise.resolve()
      .then(() => this.handler(job, {
        shard: this.shard,
        workerId: this.workerId
      }))
      .then(result => { this.consecutiveFailures = 0; return this.gate.complete(job.id, this.workerId, result); })
      .catch(async error => {
        this.consecutiveFailures++;
        const message = error?.message || String(error);
        if(this.consecutiveFailures >= this.maxFailures){
          try { await this.gate.fail(job.id, this.workerId, `SHARD_QUARANTINED:${message}`); }
          finally { this.running = false; }
        } else {
          await this.gate.fail(job.id, this.workerId, message);
        }
      })
      .finally(() => { this.active--; });
  }

  start() {
    if (this.running) return this;
    this.running = true;
    const loop = async () => {
      if (!this.running) return;
      try { await this.tick(); }
      catch (error) { console.error(`[${this.shard}] worker tick`, error); }
      const t = setTimeout(loop, this.pollMs);
      this.timers.add(t);
    };
    loop();
    return this;
  }

  async stop({ timeoutMs = 30000 } = {}) {
    this.running = false;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();

    const start = Date.now();
    while (this.active > 0 && Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, 100));
    }
    return { active: this.active, drained: this.active === 0 };
  }
}

module.exports = AgentShardRuntime;
