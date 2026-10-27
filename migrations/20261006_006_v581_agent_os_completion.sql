-- SBC V58.1 Agent Operating System completion
CREATE TABLE IF NOT EXISTS sbc_global_settings (
  setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
  setting_value VARCHAR(128) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO sbc_global_settings(setting_key,setting_value)
VALUES('global_emergency_kill_switch','1')
ON DUPLICATE KEY UPDATE setting_key=VALUES(setting_key);

CREATE TABLE IF NOT EXISTS sbc_lead_consent_registry (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL,
  contact_id VARCHAR(191) NULL,
  phone VARCHAR(32) NOT NULL,
  has_marketing_consent TINYINT(1) NOT NULL DEFAULT 0,
  opt_in_timestamp DATETIME NULL,
  consent_source VARCHAR(64) NULL,
  consent_text TEXT NULL,
  suppressed TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_consent_tenant_phone(tenant_id,phone),
  KEY idx_consent_phone(phone),
  KEY idx_consent_tenant(tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sbc_lead_quarantine (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL,
  raw_payload JSON NULL,
  quarantine_reason VARCHAR(191) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_quarantine_tenant(tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

