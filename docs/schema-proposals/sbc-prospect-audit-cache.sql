CREATE TABLE sbc_core_prospect_audit_snapshots (
 tenant_ref VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 lead_id VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 target_url VARCHAR(1000) NOT NULL,
 http_status SMALLINT UNSIGNED NOT NULL,
 checked_at DATETIME(3) NOT NULL,
 html_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 signals_json JSON NOT NULL,
 PRIMARY KEY (tenant_ref,lead_id,checked_at,html_sha256),
 CHECK (http_status=200)
) ENGINE=InnoDB;
