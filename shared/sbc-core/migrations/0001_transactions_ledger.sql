CREATE TABLE sbc_core_transactions_ledger (
 event_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 evidence_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 tenant_ref VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 provider ENUM('square','stripe') NOT NULL,
 environment ENUM('production','sandbox') NOT NULL,
 account_id VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 event_id VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 kind ENUM('capture','refund','dispute') NOT NULL,
 amount_minor BIGINT UNSIGNED NOT NULL,
 currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 occurred_at DATETIME(3) NOT NULL,
 recorded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_tenant_event (tenant_ref,event_key),
 UNIQUE KEY uq_provider_event (provider,environment,account_id,event_id),
 CHECK (amount_minor > 0)
) ENGINE=InnoDB;
