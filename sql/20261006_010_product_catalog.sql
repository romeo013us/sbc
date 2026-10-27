-- SBC V14.0.2 / V58.3
-- Static Product Pricing / Economic Guard Matrix
-- Migration: 20261006_010_product_catalog.sql
--
-- Purpose:
--   1. Provide tenant-isolated vendor-cost data for StorefrontCheckoutEventHandler.
--   2. Make zero/unconfigured vendor cost impossible to treat as a valid economic target.
--   3. Support deterministic SKU lookup under checkout concurrency.
--
-- IMPORTANT:
--   Actual vendor_cost values are intentionally NOT fabricated here.
--   Populate them from the authoritative SBC reseller/vendor price matrix.

START TRANSACTION;

CREATE TABLE IF NOT EXISTS sbc_product_catalog (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenant_id VARCHAR(128) NOT NULL,
    sku VARCHAR(191) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_type VARCHAR(64) NOT NULL DEFAULT 'service',

    vendor_cost DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    retail_price DECIMAL(12,4) NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',

    active TINYINT(1) NOT NULL DEFAULT 1,
    economic_status ENUM('UNCONFIGURED','ACTIVE','DISABLED') NOT NULL DEFAULT 'UNCONFIGURED',

    metadata JSON NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_sbc_product_catalog_tenant_sku (tenant_id, sku),
    KEY idx_sbc_product_catalog_tenant_active (tenant_id, active),
    KEY idx_sbc_product_catalog_tenant_economic (tenant_id, economic_status),

    CONSTRAINT chk_sbc_product_catalog_vendor_cost
        CHECK (vendor_cost >= 0),

    CONSTRAINT chk_sbc_product_catalog_retail_price
        CHECK (retail_price IS NULL OR retail_price >= 0)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- Existing rows with a positive vendor cost become economically active.
UPDATE sbc_product_catalog
SET economic_status = CASE
    WHEN active = 0 THEN 'DISABLED'
    WHEN vendor_cost > 0 THEN 'ACTIVE'
    ELSE 'UNCONFIGURED'
END;

-- Safe seed template.
-- Replace the values below with authoritative vendor costs before activation.
-- The zero-cost state intentionally remains blocked by the checkout handler.
--
-- INSERT INTO sbc_product_catalog
--     (tenant_id, sku, product_name, product_type, vendor_cost, retail_price, economic_status)
-- VALUES
--     ('SBC', 'REPLACE_SKU', 'REPLACE PRODUCT NAME', 'service', 0.0000, NULL, 'UNCONFIGURED')
-- ON DUPLICATE KEY UPDATE
--     product_name = VALUES(product_name),
--     product_type = VALUES(product_type),
--     vendor_cost = VALUES(vendor_cost),
--     retail_price = VALUES(retail_price),
--     economic_status = CASE
--         WHEN VALUES(vendor_cost) > 0 AND active = 1 THEN 'ACTIVE'
--         WHEN active = 0 THEN 'DISABLED'
--         ELSE 'UNCONFIGURED'
--     END,
--     updated_at = CURRENT_TIMESTAMP;

COMMIT;
