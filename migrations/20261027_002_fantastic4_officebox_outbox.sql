-- SBC Fantastic 4 paid handoff outbox; manual, owner-approved schema migration only.
-- NEVER run from GoDaddy Preview. Never apply during automatic startup.
-- Back up/restore production MySQL and verify existing CRM customer counts first.
CREATE TABLE IF NOT EXISTS sbc_office_box_outbox (
  event_id VARCHAR(80) NOT NULL,
  order_id VARCHAR(120) NOT NULL,
  customer_id VARCHAR(120) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  payload_json JSON NOT NULL,
  status ENUM('PENDING','IN_FLIGHT','DELIVERED','DEAD') NOT NULL DEFAULT 'PENDING',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_owner VARCHAR(64) NULL,
  lease_until DATETIME NULL,
  last_http_status SMALLINT UNSIGNED NULL,
  last_error_code VARCHAR(64) NULL,
  acked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(event_id),
  KEY idx_officebox_due(status,next_attempt_at),
  KEY idx_officebox_leases(status,lease_until),
  KEY idx_officebox_order(order_id,customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
