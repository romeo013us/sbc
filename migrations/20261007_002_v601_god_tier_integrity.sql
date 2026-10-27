-- SBC V60.1.0 GOD-TIER INTEGRITY HARDENING
-- Immutable event ledger is separated from the mutable worker queue.
-- No new environment secrets required.
CREATE TABLE IF NOT EXISTS sbc_god_event_ledger (
  ledger_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id VARCHAR(120) NOT NULL,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  event_type VARCHAR(120) NOT NULL,
  aggregate_type VARCHAR(80) NOT NULL DEFAULT 'system',
  aggregate_id VARCHAR(191) NOT NULL DEFAULT '',
  idempotency_key VARCHAR(191) NOT NULL,
  payload_json LONGTEXT NOT NULL,
  event_hash CHAR(64) NOT NULL,
  origin_shard VARCHAR(64) NOT NULL DEFAULT 'core',
  recorded_at DATETIME(6) NOT NULL,
  PRIMARY KEY(ledger_id),
  UNIQUE KEY uq_god_ledger_event(event_id),
  UNIQUE KEY uq_god_ledger_idem(tenant_id,idempotency_key),
  KEY idx_god_ledger_timeline(tenant_id,recorded_at),
  KEY idx_god_ledger_shard(origin_shard,recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
