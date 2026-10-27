-- SBC V65.1.6 additive enterprise safety structures.
-- Does not restore, seed, delete, or rewrite customer records.
CREATE TABLE IF NOT EXISTS sbc_tenant_audit_ledger (
  audit_id CHAR(36) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL,
  actor_id VARCHAR(191) NOT NULL,
  actor_role VARCHAR(80) NOT NULL,
  action VARCHAR(191) NOT NULL,
  resource_type VARCHAR(120) NOT NULL,
  resource_id VARCHAR(191) NULL,
  request_id VARCHAR(191) NOT NULL,
  outcome ENUM('ALLOW','DENY','ERROR') NOT NULL,
  reason_code VARCHAR(120) NULL,
  evidence_hash CHAR(64) NOT NULL,
  metadata_json JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (audit_id),
  KEY idx_tenant_audit_time (tenant_id, created_at),
  KEY idx_tenant_audit_request (tenant_id, request_id),
  KEY idx_tenant_audit_resource (tenant_id, resource_type, resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sbc_state_integrity_snapshots (
  snapshot_id CHAR(36) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL,
  scope_key VARCHAR(120) NOT NULL,
  authoritative_row_count BIGINT UNSIGNED NOT NULL,
  projection_row_count BIGINT UNSIGNED NOT NULL,
  authoritative_hash CHAR(64) NOT NULL,
  projection_hash CHAR(64) NOT NULL,
  status ENUM('MATCH','MISMATCH','SOURCE_UNAVAILABLE') NOT NULL,
  lock_engaged TINYINT(1) NOT NULL DEFAULT 1,
  reason_code VARCHAR(120) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (snapshot_id),
  KEY idx_state_integrity_tenant (tenant_id, scope_key, created_at),
  KEY idx_state_integrity_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sbc_checkout_webhook_inbox (
  inbox_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(128) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  provider_event_id VARCHAR(191) NOT NULL,
  event_type VARCHAR(120) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  payload_json JSON NOT NULL,
  status ENUM('RECEIVED','PROCESSING','PROCESSED','RETRY','QUARANTINED') NOT NULL DEFAULT 'RECEIVED',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  last_error VARCHAR(500) NULL,
  received_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  processed_at DATETIME(6) NULL,
  PRIMARY KEY (inbox_id),
  UNIQUE KEY uq_webhook_tenant_provider_event (tenant_id, provider, provider_event_id),
  KEY idx_webhook_work (status, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fulfillment tenant column/index are reconciled via information_schema in server.js so a partial DDL run is restart-safe.
