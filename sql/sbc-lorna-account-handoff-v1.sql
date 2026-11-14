-- Optional, ADDITIVE staging migration for SBC Lead Research -> Account Manager.
-- NEVER auto-run on application startup or on a read-only GoDaddy Preview.
-- Requires sbc_account_ownership_v1 (from sbc-account-social-foundation-v1.sql).
-- No modifications to existing sbc_customers or worker, checkout, HR, or fulfillment tables.
CREATE TABLE IF NOT EXISTS sbc_lead_handoffs_v1 (
 tenant_id BIGINT NOT NULL,id CHAR(36) NOT NULL,customer_id VARCHAR(120) NOT NULL,
 researcher_id VARCHAR(120) NOT NULL,manager_id VARCHAR(120) NULL,
 status VARCHAR(40) NOT NULL,summary TEXT NOT NULL,
 retry_not_before DATETIME(3) NULL,
 created_at DATETIME(3) NOT NULL,updated_at DATETIME(3) NOT NULL,
 PRIMARY KEY(tenant_id,id),UNIQUE KEY uq_sbc_handoff_customer(tenant_id,customer_id),
 KEY idx_sbc_handoff_status(tenant_id,status,updated_at),
 KEY idx_sbc_handoff_manager(tenant_id,manager_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_research_feedback_v1 (
 tenant_id BIGINT NOT NULL,id CHAR(36) NOT NULL,handoff_id CHAR(36) NOT NULL,
 customer_id VARCHAR(120) NOT NULL,researcher_id VARCHAR(120) NOT NULL,
 manager_id VARCHAR(120) NOT NULL,issue VARCHAR(40) NOT NULL,reason TEXT NOT NULL,
 status VARCHAR(40) NOT NULL,created_at DATETIME(3) NOT NULL,
 resolved_at DATETIME(3) NULL,retry_not_before DATETIME(3) NULL,
 resolution_action VARCHAR(40) NULL,resolution_note TEXT NULL,evidence_url VARCHAR(1500) NULL,
 PRIMARY KEY(tenant_id,id),
 KEY idx_sbc_feedback_researcher(tenant_id,researcher_id,status,created_at),
 KEY idx_sbc_feedback_handoff(tenant_id,handoff_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_lead_handoff_audit_v1 (
 tenant_id BIGINT NOT NULL,id CHAR(36) NOT NULL,actor_id VARCHAR(120) NOT NULL,
 actor_role VARCHAR(60) NOT NULL,action VARCHAR(100) NOT NULL,entity_id VARCHAR(120) NOT NULL,
 created_at DATETIME(3) NOT NULL,PRIMARY KEY(tenant_id,id),
 KEY idx_sbc_handoff_audit(tenant_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
