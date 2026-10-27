-- SBC V57.1 — Automatic Lead → Sale execution ledger.
CREATE TABLE IF NOT EXISTS sbc_sale_execution (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  lead_id VARCHAR(120) NOT NULL,
  state VARCHAR(40) NOT NULL,
  package_name VARCHAR(160) NULL,
  price DECIMAL(12,2) NULL,
  channel VARCHAR(30) NULL,
  purpose VARCHAR(60) NULL,
  owner_approval_required TINYINT(1) NOT NULL DEFAULT 0,
  block_reason VARCHAR(255) NULL,
  proposal_id VARCHAR(120) NULL,
  checkout_id VARCHAR(120) NULL,
  order_id VARCHAR(120) NULL,
  idempotency_key CHAR(64) NOT NULL,
  payload_json LONGTEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_sale_execution(tenant_id,lead_id,idempotency_key),
  KEY idx_sale_execution_queue(tenant_id,state,updated_at),
  KEY idx_sale_execution_lead(tenant_id,lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
