-- SBC V57.0 Revenue OS: durable control-plane primitives.
CREATE TABLE IF NOT EXISTS sbc_revenue_lead_scores (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  lead_id VARCHAR(120) NOT NULL,
  score INT NOT NULL DEFAULT 0,
  tier VARCHAR(20) NOT NULL DEFAULT 'COLD',
  signals_json LONGTEXT NULL,
  reasons_json LONGTEXT NULL,
  model_version VARCHAR(60) NOT NULL,
  calculated_at DATETIME NOT NULL,
  UNIQUE KEY uq_revenue_lead_score (tenant_id,lead_id),
  KEY idx_revenue_score (tenant_id,score,tier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_revenue_events (
  event_id VARCHAR(120) PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  lead_id VARCHAR(120) NULL,
  event_type VARCHAR(80) NOT NULL,
  state_from VARCHAR(30) NULL,
  state_to VARCHAR(30) NULL,
  payload_json LONGTEXT NULL,
  idempotency_key CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_revenue_event_idem (tenant_id,idempotency_key),
  KEY idx_revenue_event_lead (tenant_id,lead_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_revenue_tasks (
  task_id VARCHAR(120) PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  lead_id VARCHAR(120) NULL,
  action VARCHAR(80) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  due_at DATETIME NULL,
  payload_json LONGTEXT NULL,
  idempotency_key CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_revenue_task_idem (tenant_id,idempotency_key),
  KEY idx_revenue_task_queue (tenant_id,status,priority,due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_revenue_control (
  tenant_id BIGINT PRIMARY KEY,
  global_kill TINYINT(1) NOT NULL DEFAULT 0,
  outbound_kill TINYINT(1) NOT NULL DEFAULT 0,
  sales_kill TINYINT(1) NOT NULL DEFAULT 0,
  fulfillment_kill TINYINT(1) NOT NULL DEFAULT 0,
  updated_by VARCHAR(120) NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_revenue_touch_suppression (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  contact_id VARCHAR(120) NOT NULL,
  channel VARCHAR(30) NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  opt_in_proof VARCHAR(500) NULL,
  suppressed TINYINT(1) NOT NULL DEFAULT 0,
  source VARCHAR(120) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_touch_policy (tenant_id,contact_id,channel,purpose),
  KEY idx_touch_contact (tenant_id,contact_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
