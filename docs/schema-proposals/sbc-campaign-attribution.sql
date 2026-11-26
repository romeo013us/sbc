-- PROPOSAL ONLY: do not execute in production.
CREATE TABLE sbc_core_campaign_registry (
 tenant_ref VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 channel ENUM('facebook','instagram','linkedin','google_business') NOT NULL,
 campaign_slug VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 asset_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 provider_post_ref VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 published_at DATETIME(3) NOT NULL,
 PRIMARY KEY (tenant_ref,channel,campaign_slug,asset_sha256),
 UNIQUE KEY uq_campaign_post (tenant_ref,channel,provider_post_ref)
) ENGINE=InnoDB;
CREATE TABLE sbc_core_campaign_ledger_attributions (
 tenant_ref VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 event_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 channel ENUM('facebook','instagram','linkedin','google_business') NOT NULL,
 campaign_slug VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 asset_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 provider ENUM('square','stripe') NOT NULL,
 environment ENUM('production','sandbox') NOT NULL,
 account_id VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payment_id VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 attributed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (tenant_ref,event_key),
 UNIQUE KEY uq_attributed_payment (provider,environment,account_id,payment_id),
 FOREIGN KEY (tenant_ref,event_key) REFERENCES sbc_core_transactions_ledger(tenant_ref,event_key),
 FOREIGN KEY (tenant_ref,channel,campaign_slug,asset_sha256) REFERENCES sbc_core_campaign_registry(tenant_ref,channel,campaign_slug,asset_sha256),
 CHECK (environment='production')
) ENGINE=InnoDB;
-- Do not duplicate amount or currency; join immutable ledger evidence.
-- Capture kind, provider/account match, verified checkout and provider identity
-- require a trusted transactional writer not yet implemented.
