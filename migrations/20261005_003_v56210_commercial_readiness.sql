CREATE TABLE IF NOT EXISTS sbc_v56210_acquisition_spend (
  id VARCHAR(120) PRIMARY KEY, tenant_id BIGINT NOT NULL, channel VARCHAR(80) NOT NULL,
  amount DECIMAL(14,2) NOT NULL, month_key VARCHAR(7) NOT NULL,
  reference_id VARCHAR(120) NOT NULL DEFAULT '', metadata_json LONGTEXT,
  created_at DATETIME NOT NULL, INDEX idx_spend(tenant_id,month_key,channel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_v56210_usage_ledger (
  id VARCHAR(120) PRIMARY KEY, tenant_id BIGINT NOT NULL, customer_id VARCHAR(120) NOT NULL,
  plan_name VARCHAR(40) NOT NULL, metric VARCHAR(80) NOT NULL, month_key VARCHAR(7) NOT NULL,
  quantity INT NOT NULL DEFAULT 0, limit_value INT NOT NULL DEFAULT 0, overage_quantity INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'METERED', metadata_json LONGTEXT,
  created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_usage(tenant_id,customer_id,metric,month_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_v56210_commercial_snapshots (
  id VARCHAR(120) PRIMARY KEY, tenant_id BIGINT NOT NULL, month_key VARCHAR(7) NOT NULL,
  gross_mrr DECIMAL(14,2) NOT NULL DEFAULT 0, net_mrr DECIMAL(14,2) NOT NULL DEFAULT 0,
  arr DECIMAL(14,2) NOT NULL DEFAULT 0, acquisition_spend DECIMAL(14,2) NOT NULL DEFAULT 0,
  paid_customers INT NOT NULL DEFAULT 0, paid_orders INT NOT NULL DEFAULT 0,
  aov DECIMAL(14,2) NOT NULL DEFAULT 0, cac DECIMAL(14,2) NOT NULL DEFAULT 0,
  expansion_mrr DECIMAL(14,2) NOT NULL DEFAULT 0, created_at DATETIME NOT NULL,
  UNIQUE KEY uq_commercial_snapshot(tenant_id,month_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_v56210_plan_assignments (
  tenant_id BIGINT NOT NULL, customer_id VARCHAR(120) NOT NULL, plan_name VARCHAR(40) NOT NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'system', updated_at DATETIME NOT NULL,
  PRIMARY KEY(tenant_id,customer_id), INDEX idx_plan(tenant_id,plan_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
