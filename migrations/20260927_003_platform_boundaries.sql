CREATE TABLE IF NOT EXISTS sbc_platform_tenants (
  tenant_id BIGINT NOT NULL,
  customer_id VARCHAR(100) NOT NULL,
  business_name VARCHAR(180) NOT NULL,
  environment VARCHAR(40) NOT NULL DEFAULT 'office-box',
  status VARCHAR(30) NOT NULL DEFAULT 'PLANNED',
  package_name VARCHAR(120) NOT NULL DEFAULT '',
  provisioning_plan_id VARCHAR(100) NOT NULL DEFAULT '',
  capabilities_json LONGTEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (tenant_id),
  UNIQUE KEY uq_platform_customer(customer_id),
  INDEX idx_platform_status(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_platform_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id VARCHAR(100) NOT NULL,
  tenant_id BIGINT NOT NULL,
  customer_id VARCHAR(100) NOT NULL DEFAULT '',
  event_type VARCHAR(100) NOT NULL,
  source VARCHAR(80) NOT NULL DEFAULT 'command-center',
  payload_json LONGTEXT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY(id),
  UNIQUE KEY uq_platform_event(event_id),
  INDEX idx_platform_event_tenant(tenant_id,created_at),
  INDEX idx_platform_event_type(event_type,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
