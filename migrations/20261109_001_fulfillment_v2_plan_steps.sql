-- Fulfillment V2 stageable child-step ledger; deploy migration before enabling
-- SBC_FULFILLMENT_V2_PLAN_STEPS=true. Existing checkout and work orders unchanged.
CREATE TABLE IF NOT EXISTS sbc_fulfillment_plan_steps (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 tenant_id BIGINT UNSIGNED NOT NULL,
 checkout_ledger_id BIGINT UNSIGNED NOT NULL,
 order_id VARCHAR(191) NOT NULL,
 sku VARCHAR(191) NOT NULL,
 step_key VARCHAR(191) NOT NULL,
 plan_hash CHAR(64) NOT NULL,
 service_code VARCHAR(80) NOT NULL,
 line_number SMALLINT UNSIGNED NOT NULL,
 quantity INT UNSIGNED NOT NULL,
 lane VARCHAR(32) NOT NULL,
 description VARCHAR(255) NOT NULL,
 depends_on_json JSON NOT NULL,
 status VARCHAR(40) NOT NULL,
 evidence_json JSON NULL,
 completed_by VARCHAR(120) NULL,
 completed_at DATETIME NULL,
 created_at DATETIME NOT NULL,
 updated_at DATETIME NOT NULL,
 PRIMARY KEY(id),
 UNIQUE KEY uq_sbc_fulfillment_v2_checkout_step (tenant_id,checkout_ledger_id,step_key),
 KEY idx_sbc_fulfillment_v2_next (tenant_id,status,created_at),
 KEY idx_sbc_fulfillment_v2_order (tenant_id,order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
