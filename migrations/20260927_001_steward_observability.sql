CREATE TABLE IF NOT EXISTS sbc_observability_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  timestamp_utc DATETIME(3) NOT NULL,
  trace_id CHAR(32) NOT NULL,
  span_id CHAR(16) NOT NULL DEFAULT '',
  component VARCHAR(80) NOT NULL,
  event VARCHAR(160) NOT NULL,
  level VARCHAR(20) NOT NULL,
  version VARCHAR(40) NOT NULL DEFAULT '',
  context_json LONGTEXT NULL,
  PRIMARY KEY(id),
  INDEX idx_obs_trace(trace_id),
  INDEX idx_obs_event_time(event,timestamp_utc),
  INDEX idx_obs_component_time(component,timestamp_utc),
  INDEX idx_obs_level_time(level,timestamp_utc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sbc_kim_steward_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  audit_id VARCHAR(100) NOT NULL,
  actor VARCHAR(80) NOT NULL,
  action VARCHAR(100) NOT NULL,
  target VARCHAR(255) NOT NULL DEFAULT '',
  reason TEXT,
  trace_id CHAR(32) NOT NULL DEFAULT '',
  snapshot_id VARCHAR(120) NOT NULL DEFAULT '',
  before_sha256 CHAR(64) NOT NULL DEFAULT '',
  after_sha256 CHAR(64) NOT NULL DEFAULT '',
  result VARCHAR(30) NOT NULL DEFAULT 'success',
  meta_json LONGTEXT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY(id),
  UNIQUE KEY uq_steward_audit_id(audit_id),
  INDEX idx_steward_trace(trace_id),
  INDEX idx_steward_action_time(action,created_at),
  INDEX idx_steward_target(target)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
