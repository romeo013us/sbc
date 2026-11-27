-- PROPOSAL ONLY. Do not execute on the live database.
CREATE TABLE sbc_core_marketing_inventory (
 tenant_id BIGINT UNSIGNED NOT NULL,
 slug VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 format ENUM('square','landscape','portrait') NOT NULL,
 revision INT UNSIGNED NOT NULL,
 job_id VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 source_asset_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 logo_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 review_version INT UNSIGNED NOT NULL,
 final_approved_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 final_approved_actor VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NULL,
 final_approved_at DATETIME(3) NULL,
 recorded_at DATETIME(3) NOT NULL,
 PRIMARY KEY (tenant_id,slug,format,revision),
 UNIQUE KEY uq_marketing_revision_digest (tenant_id,slug,format,revision,sha256),
 CHECK (tenant_id>0 AND revision>0 AND review_version>0),
 CHECK ((final_approved_sha256 IS NULL AND final_approved_actor IS NULL AND final_approved_at IS NULL) OR (final_approved_sha256 IS NOT NULL AND final_approved_sha256=sha256 AND final_approved_actor IS NOT NULL AND final_approved_at IS NOT NULL))
) ENGINE=InnoDB;

CREATE TABLE sbc_core_marketing_readbacks (
 tenant_id BIGINT UNSIGNED NOT NULL,
 slug VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 format ENUM('square','landscape','portrait') NOT NULL,
 revision INT UNSIGNED NOT NULL,
 sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 verified_at DATETIME(3) NOT NULL,
 manifest_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 PRIMARY KEY (tenant_id,slug,format,revision,verified_at),
 FOREIGN KEY (tenant_id,slug,format,revision,sha256) REFERENCES sbc_core_marketing_inventory(tenant_id,slug,format,revision,sha256)
) ENGINE=InnoDB;

CREATE TABLE sbc_core_marketing_source_history (
 tenant_id BIGINT UNSIGNED NOT NULL,
 channel ENUM('facebook','instagram','linkedin','google_business') NOT NULL,
 provider_post_ref VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 source_asset_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 observed_at DATETIME(3) NOT NULL,
 PRIMARY KEY (tenant_id,channel,provider_post_ref),
 KEY ix_marketing_source (tenant_id,source_asset_id),
 KEY ix_marketing_digest (tenant_id,sha256)
) ENGINE=InnoDB;
