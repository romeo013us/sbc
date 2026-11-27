CREATE TABLE sbc_core_marketing_analytics (
 tenant_id BIGINT UNSIGNED NOT NULL,
 channel ENUM('facebook','instagram','linkedin','google_business') NOT NULL,
 provider_post_ref VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 measured_at DATETIME(3) NOT NULL,
 impressions BIGINT UNSIGNED NULL,
 reactions BIGINT UNSIGNED NULL,
 comments BIGINT UNSIGNED NULL,
 shares BIGINT UNSIGNED NULL,
 clicks BIGINT UNSIGNED NULL,
 observed_at DATETIME(3) NOT NULL,
 PRIMARY KEY (tenant_id,channel,provider_post_ref,measured_at),
 FOREIGN KEY (tenant_id,channel,provider_post_ref) REFERENCES sbc_core_marketing_publication_receipts(tenant_id,channel,provider_post_ref),
 CHECK (measured_at<=observed_at),
 CHECK (impressions IS NOT NULL OR reactions IS NOT NULL OR comments IS NOT NULL OR shares IS NOT NULL OR clicks IS NOT NULL)
) ENGINE=InnoDB;
