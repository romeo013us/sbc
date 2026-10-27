-- SBC V60.3 Experience OS
-- Additive schema; no autonomous financial mutation and no source-code mutation.
CREATE TABLE IF NOT EXISTS sbc_experience_profiles (
  tenant_id VARCHAR(80) NOT NULL, profile_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  metadata_json JSON NOT NULL, custom_fields_json JSON NOT NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY(tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_customer_timeline (
  timeline_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, tenant_id VARCHAR(80) NOT NULL,
  event_type VARCHAR(80) NOT NULL, actor_role VARCHAR(40) NOT NULL DEFAULT 'system', payload_json JSON NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY(timeline_id),
  KEY idx_timeline_tenant_time(tenant_id,created_at), KEY idx_timeline_type(tenant_id,event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_role_work_queue (
  task_id VARCHAR(100) NOT NULL, tenant_id VARCHAR(80) NOT NULL, role_id VARCHAR(40) NOT NULL,
  queue_type VARCHAR(60) NOT NULL, priority INT NOT NULL DEFAULT 50,
  status ENUM('OPEN','CLAIMED','DONE','BLOCKED') NOT NULL DEFAULT 'OPEN', title VARCHAR(255) NOT NULL,
  payload_json JSON NOT NULL, due_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY(task_id), KEY idx_queue_role(role_id,status,priority), KEY idx_queue_tenant(tenant_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_logical_cells (
  cell_id VARCHAR(100) NOT NULL, tenant_id VARCHAR(80) NOT NULL, workload VARCHAR(60) NOT NULL,
  status ENUM('ACTIVE','DRAINING','OFFLINE') NOT NULL DEFAULT 'ACTIVE', capacity INT NOT NULL DEFAULT 10,
  active_jobs INT NOT NULL DEFAULT 0, heartbeat_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY(cell_id), UNIQUE KEY uq_cell_tenant_workload(tenant_id,workload), KEY idx_cell_status(status,workload)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_kim_governance (
  action_id VARCHAR(100) NOT NULL, tenant_id VARCHAR(80) NOT NULL, action_type VARCHAR(100) NOT NULL,
  stage ENUM('OBSERVE','DIAGNOSE','RECOMMEND','APPROVE','EXECUTE','VERIFY','ROLLBACK') NOT NULL,
  payload_json JSON NOT NULL, result_json JSON NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY(action_id), KEY idx_kim_tenant_time(tenant_id,created_at), KEY idx_kim_stage(stage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
