-- SBC V58.3 HARDENING CONTROLS
-- Reuses existing secrets/configuration. No new environment secret required.

CREATE TABLE IF NOT EXISTS sbc_compliance_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(191) NOT NULL,
  channel VARCHAR(32) NOT NULL,
  purpose VARCHAR(64) NOT NULL,
  recipient_hash CHAR(64) NOT NULL,
  opt_in_proof_hash CHAR(64) NULL,
  decision VARCHAR(32) NOT NULL,
  reason VARCHAR(255) NULL,
  event_id VARCHAR(191) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_compliance_event (tenant_id, event_id),
  KEY idx_compliance_recipient (tenant_id, recipient_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_telemetry_dedupe (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(191) NOT NULL,
  twilio_call_sid VARCHAR(191) NOT NULL,
  call_state VARCHAR(64) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_twilio_state (tenant_id, twilio_call_sid, call_state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_sku_price_manifest (
  sku VARCHAR(191) NOT NULL,
  sell_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  vendor_baseline_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  immutable_version CHAR(64) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_financial_audit_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source_event_id VARCHAR(191) NOT NULL,
  entry_type VARCHAR(64) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  payload_hash CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_financial_audit_event (source_event_id, entry_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_compute_worker_shards (
  shard_name VARCHAR(64) NOT NULL,
  role_name VARCHAR(128) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  max_concurrency INT NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (shard_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO sbc_global_settings (setting_key, setting_value)
VALUES ('global_emergency_kill_switch', '1')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO sbc_compute_worker_shards (shard_name, role_name, enabled, max_concurrency)
VALUES
 ('slot-1-core','command-center-core',1,4),
 ('slot-2-enrichment','prospect-enrichment',1,2),
 ('slot-3-telephony','twilio-telemetry',1,2),
 ('slot-4-fulfillment','print-fulfillment',1,2)
ON DUPLICATE KEY UPDATE role_name=VALUES(role_name);
