-- SBC V60.1.2: worker/socket hardening marker.
-- Managed-MySQL compatible: no conditional ALTER syntax.
CREATE TABLE IF NOT EXISTS sbc_worker_socket_health (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  worker_id VARCHAR(120) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'HEALTHY',
  last_error VARCHAR(500) NULL,
  checked_at DATETIME NOT NULL,
  recovered_at DATETIME NULL,
  attempts INT NOT NULL DEFAULT 0,
  KEY idx_worker_socket_health (tenant_id,worker_id,checked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
