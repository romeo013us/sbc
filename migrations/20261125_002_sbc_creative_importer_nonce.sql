-- Explicit operator-approved migration, never automatic at boot.
CREATE TABLE IF NOT EXISTS sbc_creative_importer_nonce_v1 (
 tenant_id BIGINT NOT NULL,
 nonce CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 expires_ms BIGINT NOT NULL,
 PRIMARY KEY(tenant_id,nonce),
 KEY ix_creative_nonce_expiry(tenant_id,expires_ms)
) ENGINE=InnoDB;
