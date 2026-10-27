CREATE TABLE IF NOT EXISTS sbc_acquisition_opportunities (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  customer_id VARCHAR(80) NOT NULL,
  score INT NOT NULL DEFAULT 0,
  tier VARCHAR(30) NOT NULL DEFAULT 'REVIEW',
  status VARCHAR(40) NOT NULL DEFAULT 'RESEARCH',
  analysis_json LONGTEXT,
  demo_id VARCHAR(100) NOT NULL DEFAULT '',
  demo_url TEXT,
  outreach_draft_count INT NOT NULL DEFAULT 0,
  last_action VARCHAR(100) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_acq_customer(customer_id),
  INDEX idx_acq_tier(tier),
  INDEX idx_acq_status(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_acquisition_outreach (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  opportunity_id VARCHAR(100) NOT NULL,
  customer_id VARCHAR(80) NOT NULL,
  channel VARCHAR(30) NOT NULL,
  subject VARCHAR(255) NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  created_at DATETIME NOT NULL,
  INDEX idx_acq_outreach_customer(customer_id),
  INDEX idx_acq_outreach_status(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
