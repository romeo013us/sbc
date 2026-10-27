-- V64.3.3 unattended operations governance primitives.
CREATE TABLE IF NOT EXISTS sbc_agent_operation_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  idempotency_key CHAR(64) NOT NULL,
  tenant_id VARCHAR(120) NOT NULL,
  action VARCHAR(120) NOT NULL,
  aggregate_id VARCHAR(120) NULL,
  payload_json JSON NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'IN_FLIGHT',
  provider_reference VARCHAR(200) NULL,
  result_json JSON NULL,
  last_error VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_agent_operation_idem (idempotency_key),
  KEY idx_agent_operation_status (status,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_outreach_volume_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  day_key DATE NOT NULL,
  hour_window BIGINT NOT NULL,
  channel VARCHAR(30) NOT NULL,
  count_24h INT NOT NULL DEFAULT 0,
  count_day INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_outreach_window (tenant_id,day_key,hour_window,channel),
  KEY idx_outreach_day (tenant_id,day_key,channel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_dependency_health (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  dependency_name VARCHAR(60) NOT NULL,
  status VARCHAR(30) NOT NULL,
  last_error VARCHAR(1000) NULL,
  checked_at DATETIME NOT NULL,
  UNIQUE KEY uq_dependency_name (dependency_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
