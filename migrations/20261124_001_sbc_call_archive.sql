-- Additive archive schema with no deletion or migration of real call records.
-- Authoritative writer activation and retention approval are separate gates.
CREATE TABLE IF NOT EXISTS sbc_call_attempt_archive_v1 (
 tenant_id BIGINT NOT NULL,
 log_id VARCHAR(120) COLLATE utf8mb4_bin NOT NULL,
 actor_id VARCHAR(120) COLLATE utf8mb4_bin NOT NULL,
 customer_id VARCHAR(120) COLLATE utf8mb4_bin NOT NULL,
 manual_dial TINYINT(1) NOT NULL,
 session_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 number_digits VARCHAR(20) NOT NULL,
 status VARCHAR(32) NOT NULL,
 outcome VARCHAR(80) NOT NULL,
 occurred_ms BIGINT NULL,
 source_updated_ms BIGINT NULL,
 latest_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload_json LONGTEXT NOT NULL,
 PRIMARY KEY (tenant_id,log_id),
 UNIQUE KEY uq_sbc_call_archive_session (tenant_id,session_key),
 KEY idx_sbc_call_archive_time (tenant_id,occurred_ms,log_id),
 KEY idx_sbc_call_archive_actor (tenant_id,actor_id,occurred_ms,log_id),
 KEY idx_sbc_call_archive_account (tenant_id,customer_id,occurred_ms,log_id),
 KEY idx_sbc_call_archive_number (tenant_id,number_digits,occurred_ms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_call_attempt_revision_v1 (
 revision_id BIGINT NOT NULL AUTO_INCREMENT,
 tenant_id BIGINT NOT NULL,
 log_id VARCHAR(120) COLLATE utf8mb4_bin NOT NULL,
 revision_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload_json LONGTEXT NOT NULL,
 recorded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (revision_id),
 UNIQUE KEY uq_sbc_call_revision (tenant_id,log_id,revision_hash),
 CONSTRAINT fk_sbc_call_revision_attempt FOREIGN KEY (tenant_id,log_id)
 REFERENCES sbc_call_attempt_archive_v1(tenant_id,log_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
