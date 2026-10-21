-- SBC v65.2 staging foundation. Apply only through the approved published-writer
-- migration process after a verified backup. No automatic startup DDL.
-- Intentionally unpartitioned until the exact MySQL version and unique-key rules
-- are verified against staging.
CREATE TABLE IF NOT EXISTS sbc_event_ledger_v652 (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  payload_json LONGTEXT NOT NULL,
  ingested_at_ms BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sbc_event_ledger_v652_event_hash (event_hash),
  KEY ix_sbc_event_ledger_v652_tenant_time (tenant_id, ingested_at_ms),
  KEY ix_sbc_event_ledger_v652_tenant_type_time (tenant_id, event_type, ingested_at_ms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sbc_patch_proposals_v652 (
  proposal_id VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  target_relative_path VARCHAR(512) NOT NULL,
  baseline_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  proposed_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  status ENUM('PENDING_OWNER_REVIEW','APPROVED','REJECTED','EXPIRED') NOT NULL DEFAULT 'PENDING_OWNER_REVIEW',
  created_at_ms BIGINT UNSIGNED NOT NULL,
  reviewed_at_ms BIGINT UNSIGNED NULL,
  reviewed_by VARCHAR(255) NULL,
  PRIMARY KEY (proposal_id),
  KEY ix_sbc_patch_proposals_v652_status_time (status, created_at_ms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
