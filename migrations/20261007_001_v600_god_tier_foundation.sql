-- SBC V60.0.0 GOD-TIER FOUNDATION
-- Durable event fabric, dead-letter queue and operational SLO evidence.
-- No new environment secrets required.
CREATE TABLE IF NOT EXISTS sbc_god_events (
  event_id VARCHAR(120) NOT NULL,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  event_type VARCHAR(120) NOT NULL,
  aggregate_type VARCHAR(80) NOT NULL DEFAULT 'system',
  aggregate_id VARCHAR(191) NOT NULL DEFAULT '',
  idempotency_key VARCHAR(191) NOT NULL,
  payload_json LONGTEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  available_at DATETIME NOT NULL,
  locked_at DATETIME NULL,
  processed_at DATETIME NULL,
  last_error VARCHAR(1000) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY(event_id),
  UNIQUE KEY uq_god_event_idem(tenant_id,idempotency_key),
  KEY idx_god_event_ready(status,available_at,created_at),
  KEY idx_god_event_aggregate(tenant_id,aggregate_type,aggregate_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_god_event_dead_letters (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id VARCHAR(120) NOT NULL,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  event_type VARCHAR(120) NOT NULL,
  payload_json LONGTEXT NOT NULL,
  attempts INT NOT NULL,
  error_message VARCHAR(1000) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY(id), UNIQUE KEY uq_god_dl_event(event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_slo_evidence (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  metric_name VARCHAR(80) NOT NULL,
  value_decimal DECIMAL(18,8) NOT NULL,
  target_decimal DECIMAL(18,8) NOT NULL,
  passed TINYINT(1) NOT NULL,
  recorded_at DATETIME NOT NULL,
  PRIMARY KEY(id), KEY idx_slo(metric_name,recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
