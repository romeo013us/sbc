-- Apply only to backed-up writable staging with owner approval. No automatic DDL.
CREATE TABLE IF NOT EXISTS sbc_am_award_v2 (
 tenant_id BIGINT NOT NULL, manager_id VARCHAR(120) NOT NULL, award_code VARCHAR(40) NOT NULL,
 period_key VARCHAR(16) NOT NULL, month_key CHAR(7) NOT NULL, week_start CHAR(10) NOT NULL,
 awarded_by VARCHAR(120) NOT NULL, awarded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (tenant_id,manager_id,award_code,period_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
