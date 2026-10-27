-- SBC V58.3 durable checkout fulfillment task table.
CREATE TABLE IF NOT EXISTS sbc_fulfillment_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  checkout_ledger_id BIGINT UNSIGNED NOT NULL,
  order_id VARCHAR(191) NULL,
  customer_id VARCHAR(191) NULL,
  lead_id VARCHAR(191) NULL,
  sku VARCHAR(191) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fulfillment_checkout (checkout_ledger_id),
  KEY idx_fulfillment_status (status, created_at),
  KEY idx_fulfillment_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
