-- Explicit operator migration; apply only to authorized backed-up writable staging before enabling collection.
-- Public aggregate evidence only; no customer data or provider credentials.
CREATE TABLE IF NOT EXISTS sbc_public_market_evidence (slot_ms BIGINT UNSIGNED PRIMARY KEY, completed_ms BIGINT UNSIGNED NOT NULL, next_ms BIGINT UNSIGNED NOT NULL, outcome VARCHAR(16) NOT NULL, evidence_json MEDIUMTEXT NOT NULL, degraded INT UNSIGNED NOT NULL, KEY market_completed(completed_ms)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
