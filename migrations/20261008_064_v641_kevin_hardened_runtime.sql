-- SBC V64.1 HARDENED KEVIN RUNTIME
-- Durable deterministic idempotency + append-only hash-chained execution evidence.
-- No new environment secrets required.
CREATE TABLE IF NOT EXISTS sbc_kevin_runtime_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  proposal_id VARCHAR(191) NOT NULL,
  idempotency_key CHAR(64) NOT NULL,
  action_type VARCHAR(120) NOT NULL,
  target_action_suite VARCHAR(191) NOT NULL DEFAULT '',
  autonomy_band VARCHAR(16) NOT NULL,
  status VARCHAR(40) NOT NULL,
  result_json LONGTEXT NULL,
  previous_hash CHAR(64) NOT NULL,
  entry_hash CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY(id),
  UNIQUE KEY uq_kevin_runtime_idem(tenant_id,idempotency_key),
  KEY idx_kevin_runtime_status(created_at,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
