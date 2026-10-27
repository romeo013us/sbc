-- SBC V64.2 — Kevin predictive capital intelligence + executive briefing
-- Intelligence-only tables. No payment authorization or capital movement is represented.
CREATE TABLE IF NOT EXISTS sbc_kevin_capital_forecasts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  forecast_date DATE NOT NULL,
  horizon_days SMALLINT UNSIGNED NOT NULL,
  forecast_json LONGTEXT NOT NULL,
  status VARCHAR(48) NOT NULL DEFAULT 'STAGED_FOR_ROMEO_REVIEW',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_kevin_capital_forecast_day (tenant_id, forecast_date, horizon_days),
  KEY idx_kevin_capital_forecast_created (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_kevin_runtime_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  proposal_id VARCHAR(191) NOT NULL,
  idempotency_key CHAR(64) NOT NULL,
  action_type VARCHAR(120) NOT NULL,
  target_action_suite VARCHAR(191) NOT NULL DEFAULT '',
  autonomy_band VARCHAR(16) NOT NULL,
  status VARCHAR(40) NOT NULL,
  result_json LONGTEXT NULL,
  previous_hash CHAR(64) NOT NULL,
  entry_hash CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY(id),
  UNIQUE KEY uq_kevin_runtime_idem(tenant_id,idempotency_key),
  KEY idx_kevin_runtime_status(created_at,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_kim_executive_briefs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL DEFAULT 1,
  brief_date DATE NOT NULL,
  window_start DATETIME NOT NULL,
  window_end DATETIME NOT NULL,
  brief_json LONGTEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'GENERATED',
  created_at DATETIME NOT NULL,
  PRIMARY KEY(id),
  UNIQUE KEY uq_kim_brief_day (tenant_id, brief_date),
  KEY idx_kim_brief_window (tenant_id, window_start, window_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
