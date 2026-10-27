-- SBC Money Machine 2.0 — durable agent control primitives.
CREATE TABLE IF NOT EXISTS sbc_lead_consent_registry (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  contact_id VARCHAR(120) NULL,
  phone VARCHAR(40) NOT NULL,
  has_marketing_consent TINYINT(1) NOT NULL DEFAULT 0,
  opt_in_timestamp DATETIME NULL,
  consent_source VARCHAR(120) NULL,
  consent_text VARCHAR(1000) NULL,
  suppressed TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_consent_phone (tenant_id,phone),
  KEY idx_consent_contact (tenant_id,contact_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_agent_event_bus (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  aggregate_type VARCHAR(80) NULL,
  aggregate_id VARCHAR(120) NULL,
  source_agent VARCHAR(100) NULL,
  payload JSON NULL,
  idempotency_key CHAR(64) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  priority INT NOT NULL DEFAULT 5,
  error_log TEXT NULL,
  created_at DATETIME NOT NULL,
  processed_at DATETIME NULL,
  UNIQUE KEY uq_agent_event_idem (idempotency_key),
  KEY idx_agent_queue (status,priority,id),
  KEY idx_agent_aggregate (aggregate_type,aggregate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_call_state_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  event_id BIGINT NOT NULL,
  state_from VARCHAR(40) NOT NULL,
  state_to VARCHAR(40) NOT NULL,
  telemetry_json JSON NULL,
  created_at DATETIME NOT NULL,
  KEY idx_call_state (tenant_id,event_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_money_machine_actions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  lead_id VARCHAR(120) NOT NULL,
  action VARCHAR(80) NOT NULL,
  priority VARCHAR(20) NOT NULL,
  reason VARCHAR(500) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  idempotency_key CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_money_action (tenant_id,idempotency_key),
  KEY idx_money_queue (tenant_id,status,priority,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
