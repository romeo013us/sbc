-- SBC V58.3 WORKER SCALING
-- V58.3 worker scaling schema.
-- IMPORTANT: the production MySQL service does not support the MySQL-8-style
-- `ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` forms used by an
-- earlier release. The runtime migration reconciler applies these changes
-- idempotently through information_schema checks. This SQL file remains as
-- the canonical schema declaration/documentation for the migration ledger.

-- Runtime reconciliation is performed by server.js for portability across
-- managed MySQL versions. Do not replace this with unsupported conditional DDL.

CREATE TABLE IF NOT EXISTS sbc_worker_runtime_metrics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  shard_name VARCHAR(64) NOT NULL,
  worker_id VARCHAR(191) NOT NULL,
  jobs_claimed BIGINT NOT NULL DEFAULT 0,
  jobs_completed BIGINT NOT NULL DEFAULT 0,
  jobs_failed BIGINT NOT NULL DEFAULT 0,
  last_heartbeat DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_worker_identity (shard_name, worker_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
