-- SBC V58.2 Storefront Checkout -> Revenue Ledger -> Agent Bus
-- Idempotent payment ingestion; no refunds or financial mutations are performed here.

CREATE TABLE IF NOT EXISTS sbc_checkout_event_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  idempotency_key CHAR(64) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  provider_event_id VARCHAR(191) NOT NULL,
  order_id VARCHAR(191) NULL,
  customer_id VARCHAR(191) NULL,
  lead_id VARCHAR(191) NULL,
  sku VARCHAR(191) NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  payload_json JSON NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'RECEIVED',
  revenue_event_id BIGINT UNSIGNED NULL,
  agent_event_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_checkout_idempotency (idempotency_key),
  KEY idx_checkout_order (order_id),
  KEY idx_checkout_customer (customer_id),
  KEY idx_checkout_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_revenue_event_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  checkout_ledger_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  order_id VARCHAR(191) NULL,
  customer_id VARCHAR(191) NULL,
  lead_id VARCHAR(191) NULL,
  sku VARCHAR(191) NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  idempotency_key CHAR(64) NOT NULL,
  payload_json JSON NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_revenue_idempotency (idempotency_key),
  KEY idx_revenue_order (order_id),
  KEY idx_revenue_customer (customer_id),
  KEY idx_revenue_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add only the columns used by the V58.2 handler if the existing V57/V58 event bus exists.
-- These ALTERs are intentionally omitted because the V58.1 Agent OS migration already
-- establishes the event-bus contract used by the worker. The checkout handler inserts
-- only the existing contract fields.

CREATE TABLE IF NOT EXISTS sbc_checkout_sku_guard (
  sku VARCHAR(191) NOT NULL,
  vendor_baseline_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  notes VARCHAR(500) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
