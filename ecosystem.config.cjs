module.exports = {
  apps: [
    {
      name: 'sbc-command-center',
      script: './server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      exp_backoff_restart_delay: 100,
      time: true,
      env_production: { NODE_ENV: 'production' }
    },
    {
      name: 'sbc-worker-core',
      script: './workers/run-shard.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env_production: { NODE_ENV: 'production', SBC_WORKER_SHARD: 'slot-1-core', SBC_WORKER_CONCURRENCY: '4' }
    },
    {
      name: 'sbc-worker-enrichment',
      script: './workers/run-shard.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env_production: { NODE_ENV: 'production', SBC_WORKER_SHARD: 'slot-2-enrichment', SBC_WORKER_CONCURRENCY: '2' }
    },
    {
      name: 'sbc-worker-telephony',
      script: './workers/run-shard.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env_production: { NODE_ENV: 'production', SBC_WORKER_SHARD: 'slot-3-telephony', SBC_WORKER_CONCURRENCY: '2' }
    },
    {
      name: 'sbc-worker-fulfillment',
      script: './workers/run-shard.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env_production: { NODE_ENV: 'production', SBC_WORKER_SHARD: 'slot-4-fulfillment', SBC_WORKER_CONCURRENCY: '2' }
    }
  ]
};
