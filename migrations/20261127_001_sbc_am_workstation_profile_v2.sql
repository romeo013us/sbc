-- Apply in backed-up writable staging with explicit owner approval before rollout. No automatic DDL.
CREATE TABLE IF NOT EXISTS sbc_am_workstation_profile_v2 (
 tenant_id BIGINT NOT NULL,
 manager_id VARCHAR(120) NOT NULL,
 tier VARCHAR(16) NOT NULL,
 revision INT UNSIGNED NOT NULL,
 updated_by VARCHAR(120) NOT NULL,
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (tenant_id,manager_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
