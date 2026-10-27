-- SBC V60.2 Commercial OS foundation. Financial truth is append-only ledger; balances are projections only.
CREATE TABLE IF NOT EXISTS sbc_commercial_plans (
  plan_id VARCHAR(64) NOT NULL, name VARCHAR(120) NOT NULL, monthly_cents BIGINT NOT NULL DEFAULT 0,
  setup_cents BIGINT NOT NULL DEFAULT 0, description VARCHAR(500) NOT NULL, features_json JSON NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY(plan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_saas_tenants (
  tenant_id VARCHAR(80) NOT NULL, business_name VARCHAR(255) NOT NULL, plan_id VARCHAR(64) NOT NULL,
  status ENUM('PROVISIONING','ACTIVE','SUSPENDED','CANCELLED') NOT NULL DEFAULT 'PROVISIONING', idempotency_key VARCHAR(191) NOT NULL,
  metadata_json JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY(tenant_id), UNIQUE KEY uq_tenant_idem(idempotency_key), KEY idx_tenant_plan(status,plan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_commercial_ledger (
  ledger_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, tenant_id VARCHAR(80) NOT NULL, event_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(80) NOT NULL, units BIGINT NOT NULL DEFAULT 0, amount_cents BIGINT NOT NULL DEFAULT 0,
  metadata_json JSON NOT NULL, action_hash CHAR(64) NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY(ledger_id), UNIQUE KEY uq_ledger_event(event_id), KEY idx_ledger_timeline(tenant_id,created_at), KEY idx_ledger_type(tenant_id,event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_onboarding_runs (
  onboarding_id VARCHAR(100) NOT NULL, tenant_id VARCHAR(80) NOT NULL, status ENUM('STARTED','READY','BLOCKED') NOT NULL DEFAULT 'STARTED',
  steps_json JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY(onboarding_id), UNIQUE KEY uq_onboard_tenant(tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_customer_health (
  tenant_id VARCHAR(80) NOT NULL, health_score DECIMAL(5,2) NOT NULL DEFAULT 100, status ENUM('HEALTHY','WATCH','AT_RISK') NOT NULL DEFAULT 'HEALTHY',
  adoption_score DECIMAL(5,2) NOT NULL DEFAULT 0, engagement_score DECIMAL(5,2) NOT NULL DEFAULT 0, payment_score DECIMAL(5,2) NOT NULL DEFAULT 100,
  blockers_json JSON NOT NULL, computed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY(tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
