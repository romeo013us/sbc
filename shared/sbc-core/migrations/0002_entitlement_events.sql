CREATE TABLE sbc_core_entitlement_events (
 tenant_ref VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 event_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 entitlement_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 action ENUM('grant','revoke','suspend') NOT NULL,
 decision_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 PRIMARY KEY (tenant_ref,event_key,entitlement_key),
 FOREIGN KEY (tenant_ref,event_key) REFERENCES sbc_core_transactions_ledger(tenant_ref,event_key)
) ENGINE=InnoDB;
