'use strict';

const { createMysqlPool } = require('../config/mysql-pool');
const AgentShardRuntime = require('./agent-shard-runtime');
const ShardJobDispatcher = require('./shard-job-dispatcher');
const { resolveShard } = require('../config/worker-shards');
const CheckoutEventWorker = require('./checkout-event-worker');

async function main() {
  const cfg=resolveShard();
  const pool=createMysqlPool();
  const checkoutWorker=new CheckoutEventWorker({pool});
  const dispatcher=new ShardJobDispatcher({
    handlers: {
      'lead.verified': async job => ({ status:'accepted', event:job.event_type }),
      'checkout.paid': async job => checkoutWorker.process(job),
      'appointment.callback': async job => ({ status:'accepted', event:job.event_type }),
      'lead.enrichment': async job => ({ status:'accepted', event:job.event_type }),
      'twilio.call.status': async job => ({ status:'accepted', event:job.event_type }),
      'twilio.sms.status': async job => ({ status:'accepted', event:job.event_type }),
      'fulfillment.create': async job => { throw new Error('FULFILLMENT_CREATE_NOT_WIRED_TO_CANONICAL_WORK_ORDER:' + String(job.event_type)); },
      'fulfillment.update': async job => { throw new Error('FULFILLMENT_UPDATE_NOT_WIRED_TO_VERIFIED_STATUS_HANDLER:' + String(job.event_type)); }
    }
  });

  const runtime=new AgentShardRuntime({
    pool,
    shard:cfg.name,
    workerId:cfg.workerId,
    pollMs:cfg.pollMs,
    concurrency:cfg.concurrency,
    handler:(job,context)=>dispatcher.dispatch(job,context)
  });

  const shutdown=async(signal)=>{
    console.log(`[${cfg.name}] received ${signal}; draining workers`);
    try { await runtime.stop({timeoutMs:30000}); }
    finally { await pool.end(); process.exit(0); }
  };

  process.once('SIGTERM',()=>shutdown('SIGTERM'));
  process.once('SIGINT',()=>shutdown('SIGINT'));

  runtime.start();
  console.log(`[${cfg.name}] started worker=${cfg.workerId} concurrency=${cfg.concurrency} pollMs=${cfg.pollMs}`);
}

main().catch(error=>{
  console.error('[SBC SHARD FATAL]',error);
  process.exit(1);
});
