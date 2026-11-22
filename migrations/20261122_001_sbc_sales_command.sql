-- SBC Sales Command V1, tenant-scoped, owner-gated compensation bookkeeping.
-- Apply only to a backed-up writable STAGING MySQL database first.
-- Production rollout requires an approved migration and GoDaddy release artifact.
-- No payment initiation or vendor purchasing is implemented by these tables.
CREATE TABLE IF NOT EXISTS sbc_sales_credit_v1 (
 tenant_id BIGINT NOT NULL,
 order_id VARCHAR(120) NOT NULL,
 customer_id VARCHAR(120) NOT NULL,
 manager_id VARCHAR(120) NOT NULL,
 source VARCHAR(30) NOT NULL,
 gross_cents BIGINT NOT NULL,
 direct_cost_cents BIGINT NOT NULL,
 labor_cents BIGINT NOT NULL DEFAULT 0,
 processing_cents BIGINT NOT NULL DEFAULT 0,
 refund_cents BIGINT NOT NULL DEFAULT 0,
 captured_at DATETIME(3) NOT NULL,
 square_payment_hash CHAR(64) NOT NULL,
 owner_actor VARCHAR(120) NOT NULL,
 owner_evidence VARCHAR(500) NOT NULL,
 recorded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (tenant_id, order_id),
 KEY idx_sbc_sales_credit_manager_month (tenant_id,manager_id,captured_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_commission_terms_v1 (
 tenant_id BIGINT NOT NULL,
 manager_id VARCHAR(120) NOT NULL,
 month_key CHAR(7) NOT NULL,
 tier VARCHAR(16) NOT NULL,
 agreement_reference VARCHAR(180) NOT NULL,
 confirmed_by VARCHAR(120) NOT NULL,
 confirmed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (tenant_id,manager_id,month_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_commission_statement_v1 (
 tenant_id BIGINT NOT NULL,
 manager_id VARCHAR(120) NOT NULL,
 month_key CHAR(7) NOT NULL,
 tier VARCHAR(16) NOT NULL,
 quota_cents BIGINT NOT NULL,
 revenue_cents BIGINT NOT NULL,
 profit_cents BIGINT NOT NULL,
 commission_cents BIGINT NOT NULL,
 status VARCHAR(18) NOT NULL DEFAULT 'DRAFT',
 created_by VARCHAR(120) NOT NULL,
 closed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 approved_by VARCHAR(120) NULL,
 approved_at DATETIME(3) NULL,
 paid_by VARCHAR(120) NULL,
 paid_at DATETIME(3) NULL,
 external_payment_reference VARCHAR(180) NULL,
 PRIMARY KEY (tenant_id,manager_id,month_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_commission_audit_v1 (
 id CHAR(36) NOT NULL,
 tenant_id BIGINT NOT NULL,
 manager_id VARCHAR(120) NOT NULL,
 month_key CHAR(7) NOT NULL,
 action VARCHAR(40) NOT NULL,
 actor_id VARCHAR(120) NOT NULL,
 detail_json TEXT NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (id),
 KEY idx_sbc_comm_audit_tenant (tenant_id,manager_id,month_key,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
