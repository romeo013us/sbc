-- Apply to backed-up staging after existing workforce migrations. No automatic DDL.
CREATE TABLE IF NOT EXISTS sbc_am_base_payroll_v2 (
 tenant_id BIGINT NOT NULL, manager_id VARCHAR(120) NOT NULL, period_index TINYINT UNSIGNED NOT NULL,
 tier VARCHAR(16) NOT NULL, period_start CHAR(10) NOT NULL, period_end CHAR(10) NOT NULL,
 training_minutes INT UNSIGNED NOT NULL, other_paid_minutes INT UNSIGNED NOT NULL,
 hourly_cents INT UNSIGNED NOT NULL, base_pay_cents BIGINT UNSIGNED NOT NULL,
 evidence_hash CHAR(64) NOT NULL, approved_by VARCHAR(120) NOT NULL,
 approved_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 status VARCHAR(40) NOT NULL DEFAULT 'APPROVED', payment_hash CHAR(64) NULL,
 paid_by VARCHAR(120) NULL, paid_at DATETIME(3) NULL,
 PRIMARY KEY (tenant_id,manager_id,period_index),
 UNIQUE KEY uq_sbc_base_pay_reference (tenant_id,payment_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
