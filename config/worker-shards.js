'use strict';

/**
 * V58.3 worker shard policy.
 * Environment variables may override these values without requiring new
 * GoDaddy secrets. These are operational configuration knobs.
 */
const SHARDS = Object.freeze({
  'slot-1-core': {
    role: 'command-center-core',
    concurrency: 2,
    eventTypes: ['lead.verified','checkout.paid','appointment.callback']
  },
  'slot-2-enrichment': {
    role: 'prospect-enrichment',
    concurrency: 1,
    eventTypes: ['lead.enrichment']
  },
  'slot-3-telephony': {
    role: 'twilio-telemetry',
    concurrency: 1,
    eventTypes: ['twilio.call.status','twilio.sms.status']
  },
  'slot-4-fulfillment': {
    role: 'print-fulfillment',
    concurrency: 1,
    eventTypes: ['fulfillment.create','fulfillment.update']
  }
});

function resolveShard(env=process.env) {
  const name=env.SBC_WORKER_SHARD || 'slot-1-core';
  const cfg=SHARDS[name];
  if(!cfg) throw new Error(`Unknown SBC_WORKER_SHARD: ${name}`);
  return {
    name,
    ...cfg,
    concurrency: Math.max(1, Math.min(10, Number(env.SBC_WORKER_CONCURRENCY || cfg.concurrency))),
    pollMs: Math.max(250, Number(env.SBC_WORKER_POLL_MS || 1000)),
    workerId: env.SBC_WORKER_ID || `${name}-${process.pid}`
  };
}

module.exports={SHARDS,resolveShard};
