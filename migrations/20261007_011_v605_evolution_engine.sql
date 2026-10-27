-- SBC V60.5.0 Evolution Engine
-- Governed autonomous capability discovery/staging. No production code mutation.
CREATE TABLE IF NOT EXISTS sbc_evolution_capabilities (
  capability_id VARCHAR(120) PRIMARY KEY, tenant_id VARCHAR(80) NOT NULL,
  name VARCHAR(180) NOT NULL, domain VARCHAR(80) NOT NULL,
  status ENUM('DISCOVERED','STAGED','ACTIVE','DEPRECATED') NOT NULL DEFAULT 'DISCOVERED',
  version VARCHAR(40) NOT NULL, contract_json JSON NOT NULL, evidence_json JSON NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_evo_cap_tenant(tenant_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_evolution_proposals (
  proposal_id VARCHAR(120) PRIMARY KEY, tenant_id VARCHAR(80) NOT NULL,
  intent_text TEXT NOT NULL, stage VARCHAR(40) NOT NULL,
  risk ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL,
  plan_json JSON NOT NULL, diff_json JSON NOT NULL, security_json JSON NOT NULL,
  simulation_json JSON NOT NULL, approval_required TINYINT(1) NOT NULL DEFAULT 1,
  approved_by VARCHAR(120) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_evo_prop_tenant(tenant_id,stage,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_evolution_runs (
  run_id VARCHAR(120) PRIMARY KEY, proposal_id VARCHAR(120) NULL, tenant_id VARCHAR(80) NOT NULL,
  stage VARCHAR(40) NOT NULL, event_json JSON NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_evo_runs(tenant_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_evolution_checkpoints (
  checkpoint_id VARCHAR(120) PRIMARY KEY, proposal_id VARCHAR(120) NOT NULL, tenant_id VARCHAR(80) NOT NULL,
  artifact_hash CHAR(64) NOT NULL, rollback_manifest_json JSON NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_evo_checkpoint(tenant_id,proposal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
