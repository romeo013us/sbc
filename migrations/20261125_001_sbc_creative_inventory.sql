-- Manual migration only. Do not run at import or in Preview.
CREATE TABLE IF NOT EXISTS sbc_creative_inventory_lock_v1 (
 tenant_id BIGINT NOT NULL PRIMARY KEY
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS sbc_creative_inventory_v1 (
 tenant_id BIGINT NOT NULL, sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 dhash CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 slot_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 scheduled_at CHAR(24) NOT NULL, service VARCHAR(32) NOT NULL,
 caption VARCHAR(1000) NOT NULL, width SMALLINT NOT NULL, height SMALLINT NOT NULL,
 png MEDIUMBLOB NOT NULL, state ENUM('DRAFT','APPROVED','REVOKED') NOT NULL,
 approved_by VARCHAR(120) NULL, approved_at DATETIME(3) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(tenant_id,sha256), UNIQUE KEY uq_creative_slot(tenant_id,slot_key),
 KEY ix_creative_time(tenant_id,scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_creative_claim_v1 (
 tenant_id BIGINT NOT NULL, day_et CHAR(10) NOT NULL, platform VARCHAR(16) NOT NULL, slot CHAR(2) NOT NULL,
 asset_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 scheduled_at CHAR(24) NOT NULL, claimed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(tenant_id,day_et,platform,slot),
 CONSTRAINT fk_creative_claim_asset FOREIGN KEY(tenant_id,asset_sha256)
 REFERENCES sbc_creative_inventory_v1(tenant_id,sha256)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
