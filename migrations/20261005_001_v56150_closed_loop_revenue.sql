CREATE TABLE IF NOT EXISTS sbc_revenue_funnel_events (
  id VARCHAR(120) PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  customer_id VARCHAR(100) NOT NULL DEFAULT '',
  event_type VARCHAR(100) NOT NULL,
  idempotency_key VARCHAR(180) NOT NULL DEFAULT '',
  metadata_json LONGTEXT,
  occurred_at DATETIME NOT NULL,
  UNIQUE KEY uq_revenue_funnel_idem(tenant_id,idempotency_key),
  INDEX idx_revenue_funnel_event(tenant_id,event_type,occurred_at),
  INDEX idx_revenue_funnel_customer(tenant_id,customer_id,occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_autopilot_outreach (
  id VARCHAR(120) PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  customer_id VARCHAR(100) NOT NULL,
  channel VARCHAR(30) NOT NULL,
  subject VARCHAR(255) NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'HELD_NO_CONSENT',
  reason VARCHAR(180) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_autopilot_outreach(tenant_id,customer_id,channel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_affiliate_accounts (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  affiliate_code VARCHAR(80) NOT NULL,
  customer_id VARCHAR(100) NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  rate DECIMAL(6,4) NOT NULL DEFAULT 0.1000,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_affiliate_code(tenant_id,affiliate_code),
  INDEX idx_affiliate_customer(tenant_id,customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_affiliate_referrals (
  id VARCHAR(120) PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  affiliate_id VARCHAR(100) NOT NULL,
  customer_id VARCHAR(100) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
  commission_cents BIGINT NOT NULL DEFAULT 0,
  metadata_json LONGTEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_affiliate_referral(tenant_id,affiliate_id,customer_id),
  INDEX idx_affiliate_referral_status(tenant_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_affiliate_ledger (
  id VARCHAR(120) PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  affiliate_id VARCHAR(100) NOT NULL,
  customer_id VARCHAR(100) NOT NULL DEFAULT '',
  order_id VARCHAR(100) NOT NULL DEFAULT '',
  entry_type VARCHAR(40) NOT NULL,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  idempotency_key VARCHAR(180) NOT NULL,
  metadata_json LONGTEXT,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_affiliate_ledger_idem(tenant_id,idempotency_key),
  INDEX idx_affiliate_ledger(tenant_id,affiliate_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_revenue_alerts (
  id VARCHAR(120) PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
  alert_type VARCHAR(80) NOT NULL,
  message VARCHAR(1000) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  metadata_json LONGTEXT,
  created_at DATETIME NOT NULL,
  resolved_at DATETIME NULL,
  INDEX idx_revenue_alerts(tenant_id,status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
