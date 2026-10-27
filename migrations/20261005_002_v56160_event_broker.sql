CREATE TABLE IF NOT EXISTS sbc_revenue_state_machine (
  tenant_id BIGINT NOT NULL DEFAULT 1,
  entity_type VARCHAR(40) NOT NULL,
  entity_id VARCHAR(120) NOT NULL,
  state VARCHAR(60) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  last_event_id VARCHAR(120) NOT NULL DEFAULT '',
  metadata_json LONGTEXT,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (tenant_id,entity_type,entity_id),
  INDEX idx_state(tenant_id,state,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_revenue_event_jobs (
  id VARCHAR(120) PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  event_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id VARCHAR(120) NOT NULL,
  payload_json LONGTEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at DATETIME NULL,
  last_error TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_event_idem(tenant_id,event_type,entity_id),
  INDEX idx_event_jobs(status,next_attempt_at,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
