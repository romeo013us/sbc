-- Apply to backed-up writable staging first; no automatic DDL.
CREATE TABLE IF NOT EXISTS sbc_am_trial_cohort_v2 (
 tenant_id BIGINT NOT NULL, cohort_id CHAR(36) NOT NULL, start_day CHAR(10) NOT NULL, end_day CHAR(10) NOT NULL,
 reserve_cents BIGINT NOT NULL, planned_base_cents BIGINT NOT NULL, created_by VARCHAR(120) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (tenant_id,cohort_id), UNIQUE KEY uq_sbc_trial_start (tenant_id,start_day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_am_trial_member_v2 (
 tenant_id BIGINT NOT NULL, manager_id VARCHAR(120) NOT NULL, cohort_id CHAR(36) NOT NULL,
 tier VARCHAR(16) NOT NULL, agreement_hash CHAR(64) NOT NULL,
 PRIMARY KEY (tenant_id,manager_id), KEY idx_sbc_trial_cohort (tenant_id,cohort_id),
 CONSTRAINT fk_sbc_trial_cohort_v2 FOREIGN KEY (tenant_id,cohort_id) REFERENCES sbc_am_trial_cohort_v2 (tenant_id,cohort_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
