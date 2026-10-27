'use strict';

function registerWorkerHealth(app, { pool }) {
  app.get('/api/ops/worker-health', async (req,res)=>{
    try {
      const [rows]=await pool.query(`
        SELECT shard_name, role_name, enabled, max_concurrency, updated_at
          FROM sbc_compute_worker_shards
         ORDER BY shard_name
      `);
      const [pending]=await pool.query(`
        SELECT status, COUNT(*) AS count
          FROM sbc_agent_event_bus
         GROUP BY status
      `);
      res.json({
        ok:true,
        workers:rows,
        event_bus:pending,
        timestamp:new Date().toISOString()
      });
    } catch(e) {
      res.status(503).json({ok:false,error:'worker_health_unavailable'});
    }
  });
}

module.exports={registerWorkerHealth};
