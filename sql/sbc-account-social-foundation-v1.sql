-- SBC account ownership + multi-client social system. STAGING FIRST.
-- Never auto-apply during boot. Back up DB and verify on staging.
-- No changes to existing CRM, payments, HR, or marketing content tables.
CREATE TABLE IF NOT EXISTS sbc_account_ownership_v1 (
 tenant_id BIGINT NOT NULL, customer_id VARCHAR(120) NOT NULL,
 manager_id VARCHAR(120) NOT NULL, assigned_by VARCHAR(120) NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 PRIMARY KEY (tenant_id,customer_id), KEY idx_am_manager (tenant_id,manager_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_account_interactions_v1 (
 tenant_id BIGINT NOT NULL, id CHAR(36) NOT NULL,
 customer_id VARCHAR(120) NOT NULL, kind VARCHAR(30) NOT NULL,
 summary TEXT NOT NULL, created_by VARCHAR(120) NOT NULL,
 created_at DATETIME(3) NOT NULL,
 PRIMARY KEY (tenant_id,id),KEY idx_am_timeline(tenant_id,customer_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_social_channels_v1 (
 tenant_id BIGINT NOT NULL,id CHAR(36) NOT NULL,customer_id VARCHAR(120) NOT NULL,
 platform VARCHAR(30) NOT NULL,provider_account_id VARCHAR(200) NOT NULL,
 secret_ref VARCHAR(200) NOT NULL,status VARCHAR(30) NOT NULL,
 created_at DATETIME(3) NOT NULL,verified_at DATETIME(3) NULL,
 PRIMARY KEY(tenant_id,id),KEY idx_social_client(tenant_id,customer_id,platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_social_posts_v1 (
 tenant_id BIGINT NOT NULL,id CHAR(36) NOT NULL,customer_id VARCHAR(120) NOT NULL,
 channel_id CHAR(36) NOT NULL,platform VARCHAR(30) NOT NULL,
 body TEXT NOT NULL,media_url VARCHAR(2048) NOT NULL DEFAULT '',
 cta_url VARCHAR(2048) NOT NULL DEFAULT '',status VARCHAR(30) NOT NULL,
 approved_at DATETIME(3) NULL,approved_by VARCHAR(120) NULL,
 scheduled_at DATETIME(3) NULL,remote_id VARCHAR(255) NULL,
 created_by VARCHAR(120) NOT NULL,created_at DATETIME(3) NOT NULL,
 published_at DATETIME(3) NULL,attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 failure_code VARCHAR(100) NULL,
 PRIMARY KEY(tenant_id,id),KEY idx_social_due(tenant_id,status,scheduled_at),
 KEY idx_social_client_posts(tenant_id,customer_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_account_social_audit_v1 (
 tenant_id BIGINT NOT NULL,id CHAR(36) NOT NULL,actor_id VARCHAR(120) NOT NULL,
 actor_role VARCHAR(60) NOT NULL,action VARCHAR(100) NOT NULL,
 entity_id VARCHAR(120) NOT NULL,created_at DATETIME(3) NOT NULL,
 PRIMARY KEY(tenant_id,id),KEY idx_am_audit(tenant_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
