-- SBC V55.19.0 — durable workforce identities, lead drafts, and structured lead intelligence.
-- Runtime startup also creates these tables defensively for older installations.
CREATE TABLE IF NOT EXISTS sbc_workforce_users (
  id VARCHAR(80) PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  username VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT '',
  email VARCHAR(255) NOT NULL DEFAULT '',
  role VARCHAR(60) NOT NULL DEFAULT 'caller',
  active TINYINT(1) NOT NULL DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  password_hash TEXT NOT NULL,
  expires_at DATE NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_workforce_username(username),
  INDEX idx_workforce_role(role),
  INDEX idx_workforce_active(active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_lead_drafts (
  user_id VARCHAR(80) PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  draft_json LONGTEXT NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_lead_draft_tenant(tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The runtime owns this additive column migration. It uses INFORMATION_SCHEMA.COLUMNS
-- before issuing a plain ALTER TABLE ADD COLUMN, which is compatible with the MySQL
-- deployment used by SBC. Keeping DDL out of this migration prevents duplicate-column
-- and unsupported IF NOT EXISTS syntax from blocking the entire migration transaction.
-- Runtime migration: sbc_customers.lead_intelligence_json LONGTEXT NULL
