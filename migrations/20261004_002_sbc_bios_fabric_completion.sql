-- SBC BI-OS Global Business Intelligence Fabric
-- Safe, additive, evidence-first schema. No customer PII is required in the global layer.
CREATE TABLE IF NOT EXISTS global_industry_benchmarks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  industry_type VARCHAR(120) NOT NULL,
  observed_vulnerability VARCHAR(160) NOT NULL,
  proven_solution_sku VARCHAR(120),
  confidence_score DECIMAL(5,4) NOT NULL DEFAULT 0.50,
  typical_bottleneck VARCHAR(500),
  evidence_count INT NOT NULL DEFAULT 0,
  source_name VARCHAR(200),
  evidence_uri VARCHAR(1000),
  verified_at DATETIME NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_gib_industry_vulnerability (industry_type, observed_vulnerability),
  INDEX idx_gib_confidence (confidence_score),
  INDEX idx_gib_verified (verified_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sbc_authorized_catalog (
  sku VARCHAR(120) PRIMARY KEY,
  item_name VARCHAR(200) NOT NULL,
  category VARCHAR(80) NOT NULL,
  setup_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  recurring_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  wholesale_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  eligibility_tier INT NOT NULL DEFAULT 1,
  description TEXT NULL,
  metadata_json JSON NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sac_category_status (category, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS past_conversions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  lead_id BIGINT NULL,
  industry_vertical VARCHAR(120) NOT NULL,
  primary_objection_handled VARCHAR(200) NULL,
  recommended_sku VARCHAR(120) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OBSERVED',
  final_yield DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  evidence_source VARCHAR(80) NOT NULL DEFAULT 'SBC_OBSERVED',
  converted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pc_industry_status (industry_vertical, status),
  INDEX idx_pc_sku (recommended_sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS self_healing_queue (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  lead_id BIGINT NULL,
  action_type VARCHAR(80) NOT NULL,
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
  last_error_code VARCHAR(120) NULL,
  last_attempt DATETIME NULL,
  recovered_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_shq_status_attempt (status, last_attempt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Global graph: scalable entity metadata without copying private customer records.
CREATE TABLE IF NOT EXISTS global_business_entities (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  external_key VARCHAR(255) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  industry_type VARCHAR(120) NULL,
  region_code VARCHAR(80) NULL,
  size_band VARCHAR(50) NULL,
  attributes_json JSON NULL,
  source_name VARCHAR(200) NOT NULL,
  evidence_uri VARCHAR(1000) NULL,
  verified_at DATETIME NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_gbe_external_source (external_key, source_name),
  INDEX idx_gbe_industry_region (industry_type, region_code),
  INDEX idx_gbe_type (entity_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS global_business_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT NULL,
  event_type VARCHAR(100) NOT NULL,
  industry_type VARCHAR(120) NULL,
  event_payload JSON NULL,
  outcome VARCHAR(120) NULL,
  source_name VARCHAR(200) NOT NULL,
  evidence_uri VARCHAR(1000) NULL,
  observed_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_gbe_event_industry (event_type, industry_type, observed_at),
  INDEX idx_gbe_entity_time (entity_id, observed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS global_solution_patterns (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  industry_type VARCHAR(120) NOT NULL,
  problem_code VARCHAR(160) NOT NULL,
  solution_class VARCHAR(160) NOT NULL,
  solution_sku VARCHAR(120) NULL,
  observed_outcome VARCHAR(120) NULL,
  confidence_score DECIMAL(5,4) NOT NULL DEFAULT 0.50,
  evidence_count INT NOT NULL DEFAULT 0,
  source_name VARCHAR(200) NOT NULL,
  evidence_uri VARCHAR(1000) NULL,
  verified_at DATETIME NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_gsp_problem (industry_type, problem_code, confidence_score),
  INDEX idx_gsp_solution (solution_sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS global_knowledge_evidence (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  evidence_key VARCHAR(255) NOT NULL,
  evidence_type VARCHAR(60) NOT NULL,
  subject_type VARCHAR(60) NOT NULL,
  subject_key VARCHAR(255) NOT NULL,
  claim_text TEXT NOT NULL,
  confidence_score DECIMAL(5,4) NOT NULL DEFAULT 0.50,
  source_name VARCHAR(200) NOT NULL,
  evidence_uri VARCHAR(1000) NULL,
  observed_at DATETIME NULL,
  expires_at DATETIME NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_gke_key (evidence_key),
  INDEX idx_gke_subject (subject_type, subject_key),
  INDEX idx_gke_confidence (confidence_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
