-- V60.4 State Kernel: durable event authority, projections, commands, cells, governance.
CREATE TABLE IF NOT EXISTS sbc_state_events (
 event_id VARCHAR(100) NOT NULL, tenant_id VARCHAR(80) NOT NULL, aggregate_id VARCHAR(120) NOT NULL,
 event_type VARCHAR(100) NOT NULL, idempotency_key VARCHAR(191) NOT NULL, sequence_no BIGINT UNSIGNED NOT NULL,
 payload_json JSON NOT NULL, event_hash CHAR(64) NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(event_id), UNIQUE KEY uq_state_event_idem(tenant_id,idempotency_key), UNIQUE KEY uq_state_event_sequence(tenant_id,aggregate_id,sequence_no),
 KEY idx_state_timeline(tenant_id,aggregate_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_state_projections (
 tenant_id VARCHAR(80) NOT NULL, aggregate_id VARCHAR(120) NOT NULL, version BIGINT UNSIGNED NOT NULL DEFAULT 0,
 state_json JSON NOT NULL, state_hash CHAR(64) NOT NULL, updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(tenant_id,aggregate_id), KEY idx_projection_tenant(tenant_id,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_command_bus (
 command_id VARCHAR(100) NOT NULL, tenant_id VARCHAR(80) NOT NULL, aggregate_id VARCHAR(120) NULL,
 command_type VARCHAR(100) NOT NULL, idempotency_key VARCHAR(191) NOT NULL, status ENUM('RECEIVED','AUTHORIZED','EXECUTED','REJECTED') NOT NULL DEFAULT 'RECEIVED',
 payload_json JSON NOT NULL, result_json JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(command_id), UNIQUE KEY uq_command_idem(tenant_id,idempotency_key), KEY idx_command_queue(tenant_id,status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_kernel_cells (
 cell_id VARCHAR(120) NOT NULL, tenant_id VARCHAR(80) NOT NULL, workload ENUM('CORE','SALES','TELEPHONY','FULFILLMENT','AI') NOT NULL,
 status ENUM('ACTIVE','DRAINING','OFFLINE') NOT NULL DEFAULT 'ACTIVE', capacity INT UNSIGNED NOT NULL DEFAULT 10, active_jobs INT UNSIGNED NOT NULL DEFAULT 0,
 heartbeat_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY(cell_id), UNIQUE KEY uq_kernel_cell(tenant_id,workload), KEY idx_kernel_cells(status,workload)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_kernel_governance (
 action_id VARCHAR(100) NOT NULL, tenant_id VARCHAR(80) NOT NULL, action_type VARCHAR(100) NOT NULL,
 stage ENUM('OBSERVE','DIAGNOSE','RECOMMEND','APPROVE','EXECUTE','VERIFY','ROLLBACK') NOT NULL, previous_stage VARCHAR(20) NULL,
 payload_json JSON NOT NULL, result_json JSON NOT NULL, actor_id VARCHAR(120) NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(action_id), KEY idx_kernel_governance(tenant_id,created_at), KEY idx_kernel_stage(stage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
