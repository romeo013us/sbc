CREATE TABLE sbc_core_financial_outbox (
 tenant_ref VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 event_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 topic VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload_json JSON NOT NULL,
 correlation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 status ENUM('pending','leased','delivered','dead_letter') NOT NULL DEFAULT 'pending',
 attempts INT UNSIGNED NOT NULL DEFAULT 0,
 next_attempt_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 lease_token CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 lease_until DATETIME(3) NULL,
 PRIMARY KEY (tenant_ref,event_key,topic),
 KEY idx_due (status,next_attempt_at),
 FOREIGN KEY (tenant_ref,event_key) REFERENCES sbc_core_transactions_ledger(tenant_ref,event_key)
) ENGINE=InnoDB;
