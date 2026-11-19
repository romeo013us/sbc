-- SBC Customer Design Request Center V1
-- ADDITIVE, tenant-scoped, single-use creative brief storage for website and business card inquiries.
-- Apply only to the verified production MySQL writer AFTER a verified backup.
-- Do not execute DDL on preview/startup, and do not copy customer requests across tenants.
CREATE TABLE IF NOT EXISTS sbc_customer_design_briefs_v1 (
 id VARCHAR(80) NOT NULL,
 tenant_id BIGINT NOT NULL,
 customer_id VARCHAR(120) NOT NULL,
 kind VARCHAR(32) NOT NULL,
 token_hash CHAR(64) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
 requested_by VARCHAR(120) NOT NULL,
 answers_json JSON NULL,
 created_at DATETIME(3) NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 submitted_at DATETIME(3) NULL,
 reviewed_at DATETIME(3) NULL,
 PRIMARY KEY(tenant_id,id),
 UNIQUE KEY uq_sbc_customer_brief_token(token_hash),
 KEY ix_sbc_customer_brief_account(tenant_id,customer_id,created_at),
 KEY ix_sbc_customer_brief_status(tenant_id,status,expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
