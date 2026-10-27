-- SBC V56.13.5 — Super-Brain Intelligence Fabric
-- Evidence-backed memory only. No synthetic history is inserted.
CREATE TABLE IF NOT EXISTS sbc_brain_memory (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  brain VARCHAR(80) NOT NULL,
  memory_type VARCHAR(80) NOT NULL,
  subject_key VARCHAR(180) NOT NULL,
  payload_json LONGTEXT NOT NULL,
  evidence_source VARCHAR(120) NOT NULL DEFAULT 'SBC_OBSERVED',
  confidence DECIMAL(5,4) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_brain_memory(tenant_id,brain,memory_type,subject_key),
  INDEX idx_brain_memory_brain(tenant_id,brain),
  INDEX idx_brain_memory_updated(updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_brain_outcomes (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  source_event_id VARCHAR(180) NOT NULL,
  industry VARCHAR(160) NOT NULL DEFAULT 'unknown',
  need_code VARCHAR(100) NOT NULL DEFAULT '',
  product_sku VARCHAR(160) NOT NULL DEFAULT '',
  outcome VARCHAR(60) NOT NULL,
  revenue DECIMAL(14,2) NOT NULL DEFAULT 0,
  recurring_revenue DECIMAL(14,2) NOT NULL DEFAULT 0,
  evidence_json LONGTEXT,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_brain_outcome_event(tenant_id,source_event_id),
  INDEX idx_brain_outcome_industry(tenant_id,industry),
  INDEX idx_brain_outcome_product(tenant_id,product_sku),
  INDEX idx_brain_outcome_need(tenant_id,need_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_brain_external_benchmarks (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  industry VARCHAR(160) NOT NULL,
  metric VARCHAR(160) NOT NULL,
  value DECIMAL(18,6) NULL,
  unit VARCHAR(60) NOT NULL DEFAULT '',
  source_name VARCHAR(255) NOT NULL,
  evidence_uri TEXT,
  evidence_hash CHAR(64) NOT NULL DEFAULT '',
  verified_at DATETIME NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_external_benchmark(tenant_id,industry,metric,source_name),
  INDEX idx_external_benchmark_industry(tenant_id,industry),
  INDEX idx_external_benchmark_active(active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_brain_recovery_memory (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  failure_code VARCHAR(160) NOT NULL,
  recovery_action VARCHAR(255) NOT NULL,
  success_count INT NOT NULL DEFAULT 0,
  failure_count INT NOT NULL DEFAULT 0,
  source_event_id VARCHAR(180) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_recovery_memory(tenant_id,failure_code,recovery_action),
  INDEX idx_recovery_failure(tenant_id,failure_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
