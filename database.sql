CREATE TABLE IF NOT EXISTS sbc_workspace (id INT PRIMARY KEY, payload LONGTEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_settings (setting_key VARCHAR(80) PRIMARY KEY, setting_value TEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_customers (id VARCHAR(80) PRIMARY KEY,business_name VARCHAR(255) NOT NULL DEFAULT '',contact_name VARCHAR(255) NOT NULL DEFAULT '',phone VARCHAR(80) NOT NULL DEFAULT '',email VARCHAR(255) NOT NULL DEFAULT '',status VARCHAR(40) NOT NULL DEFAULT 'Lead',source VARCHAR(100) NOT NULL DEFAULT 'Walk-in',follow_up DATE NULL,notes TEXT,account_notes_json LONGTEXT NULL,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,INDEX idx_customer_status(status),INDEX idx_customer_followup(follow_up));
CREATE TABLE IF NOT EXISTS sbc_quotes (id VARCHAR(80) PRIMARY KEY,quote_number VARCHAR(80) NOT NULL,customer_id VARCHAR(80) NOT NULL DEFAULT '',customer_name VARCHAR(255) NOT NULL DEFAULT '',status VARCHAR(40) NOT NULL DEFAULT 'Draft',valid_until DATE NULL,notes TEXT,items_json LONGTEXT NOT NULL,subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,discount DECIMAL(12,2) NOT NULL DEFAULT 0,tax_rate DECIMAL(7,3) NOT NULL DEFAULT 0,tax DECIMAL(12,2) NOT NULL DEFAULT 0,total DECIMAL(12,2) NOT NULL DEFAULT 0,payment_url TEXT,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,UNIQUE KEY uq_quote_number(quote_number));
CREATE TABLE IF NOT EXISTS sbc_orders (id VARCHAR(80) PRIMARY KEY,customer_id VARCHAR(80) NOT NULL DEFAULT '',customer_name VARCHAR(255) NOT NULL DEFAULT '',product VARCHAR(255) NOT NULL DEFAULT '',quantity DECIMAL(12,2) NOT NULL DEFAULT 1,status VARCHAR(40) NOT NULL DEFAULT 'New',cost DECIMAL(12,2) NOT NULL DEFAULT 0,price DECIMAL(12,2) NOT NULL DEFAULT 0,notes TEXT,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL);
CREATE TABLE IF NOT EXISTS sbc_renewals (id VARCHAR(80) PRIMARY KEY,customer_id VARCHAR(80) NOT NULL DEFAULT '',customer_name VARCHAR(255) NOT NULL DEFAULT '',service VARCHAR(255) NOT NULL DEFAULT '',due_date DATE NOT NULL,amount DECIMAL(12,2) NOT NULL DEFAULT 0,status VARCHAR(40) NOT NULL DEFAULT 'Upcoming',notes TEXT,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL);
CREATE TABLE IF NOT EXISTS sbc_activities (id VARCHAR(80) PRIMARY KEY,activity_type VARCHAR(40) NOT NULL,message VARCHAR(500) NOT NULL,meta_json TEXT,created_at DATETIME NOT NULL,INDEX idx_activity_created(created_at));

-- V27.2.0: Square payment state and webhook events are persisted inside sbc_workspace payload so legacy/file and MySQL modes share the same application model.

-- V27.6.0 Operations Hardening: append-only audit ledger.
CREATE TABLE IF NOT EXISTS sbc_audit_log (
  id VARCHAR(80) PRIMARY KEY,
  user_id VARCHAR(80) NOT NULL DEFAULT '',
  user_name VARCHAR(255) NOT NULL DEFAULT '',
  role VARCHAR(60) NOT NULL DEFAULT '',
  event_type VARCHAR(100) NOT NULL DEFAULT '',
  message VARCHAR(1000) NOT NULL DEFAULT '',
  meta_json TEXT,
  created_at DATETIME NOT NULL,
  INDEX idx_audit_created(created_at),
  INDEX idx_audit_user(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- V30.1 automation foundation: relational mirror tables for fulfillment and instant demos.
CREATE TABLE IF NOT EXISTS sbc_fulfillment_jobs (
  id VARCHAR(80) PRIMARY KEY, order_id VARCHAR(80) NOT NULL, customer_id VARCHAR(80) NOT NULL DEFAULT '',
  customer_name VARCHAR(255) NOT NULL DEFAULT '', product VARCHAR(255) NOT NULL DEFAULT '', quantity DECIMAL(12,2) NOT NULL DEFAULT 1,
  vendor VARCHAR(60) NOT NULL DEFAULT 'internal', status VARCHAR(60) NOT NULL DEFAULT 'ready', vendor_status VARCHAR(80) NOT NULL DEFAULT '',
  vendor_order_number VARCHAR(160) NOT NULL DEFAULT '', tracking_number VARCHAR(160) NOT NULL DEFAULT '', cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  requirements_json LONGTEXT, attempts INT NOT NULL DEFAULT 0, last_error TEXT, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
  INDEX idx_fulfillment_order(order_id), INDEX idx_fulfillment_status(status), INDEX idx_fulfillment_vendor(vendor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_website_demos (
  id VARCHAR(80) PRIMARY KEY, customer_id VARCHAR(80) NOT NULL, slug VARCHAR(120) NOT NULL, url TEXT, deploy_status VARCHAR(60) NOT NULL DEFAULT 'ready',
  html LONGTEXT NOT NULL, metadata_json LONGTEXT, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_demo_slug(slug), INDEX idx_demo_customer(customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- V30.3 Enterprise Architecture Foundation
CREATE TABLE IF NOT EXISTS sbc_tenants (id BIGINT PRIMARY KEY,name VARCHAR(255) NOT NULL,slug VARCHAR(120) NOT NULL UNIQUE,status VARCHAR(40) NOT NULL DEFAULT 'active',owner_user_id VARCHAR(80) NOT NULL DEFAULT '',created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_event_outbox (id VARCHAR(100) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,event_type VARCHAR(120) NOT NULL,payload_json LONGTEXT NOT NULL,status VARCHAR(40) NOT NULL DEFAULT 'PENDING',attempts INT NOT NULL DEFAULT 0,next_attempt_at DATETIME NULL,last_error TEXT,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,INDEX idx_outbox_status(status),INDEX idx_outbox_next(next_attempt_at),INDEX idx_outbox_tenant(tenant_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_schema_migrations (version VARCHAR(80) PRIMARY KEY,checksum VARCHAR(128) NOT NULL,applied_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_secret_vault (id VARCHAR(100) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,secret_name VARCHAR(120) NOT NULL,secret_ciphertext LONGTEXT NOT NULL,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,UNIQUE KEY uq_vault_tenant_name(tenant_id,secret_name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_architecture_events (id VARCHAR(100) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,level VARCHAR(20) NOT NULL,event_type VARCHAR(120) NOT NULL,payload_json LONGTEXT,created_at DATETIME NOT NULL,INDEX idx_arch_created(created_at),INDEX idx_arch_tenant(tenant_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Expand-only tenant columns. Existing rows remain in tenant 1.
ALTER TABLE sbc_customers ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 1;
ALTER TABLE sbc_quotes ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 1;
ALTER TABLE sbc_orders ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 1;
ALTER TABLE sbc_renewals ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 1;
ALTER TABLE sbc_activities ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 1;
ALTER TABLE sbc_audit_log ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 1;
ALTER TABLE sbc_sessions ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 1;
ALTER TABLE sbc_fulfillment_jobs ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 1;
ALTER TABLE sbc_website_demos ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS sbc_demo_templates (id VARCHAR(100) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,slug VARCHAR(120) NOT NULL,template_id VARCHAR(120) NOT NULL,layout_code VARCHAR(40) NOT NULL DEFAULT 'A',metadata_json LONGTEXT NOT NULL,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,UNIQUE KEY uq_demo_template_tenant_slug(tenant_id,slug),INDEX idx_demo_template_tenant(tenant_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- V30.7 Global Autonomy Advanced Foundation
CREATE TABLE IF NOT EXISTS sbc_global_region_health (region_code VARCHAR(80) PRIMARY KEY,status VARCHAR(40) NOT NULL DEFAULT 'UNKNOWN',latency_ms DECIMAL(12,3) NULL,last_checked_at DATETIME NULL,metadata_json LONGTEXT,updated_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_vendor_contracts (id VARCHAR(100) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,vendor VARCHAR(100) NOT NULL,contract_version VARCHAR(80) NOT NULL,schema_json LONGTEXT NOT NULL,status VARCHAR(40) NOT NULL DEFAULT 'active',created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,UNIQUE KEY uq_vendor_contract(tenant_id,vendor,contract_version)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_tenant_crypto_policies (tenant_id BIGINT PRIMARY KEY,mode VARCHAR(80) NOT NULL DEFAULT 'application-aes-256-gcm',provider VARCHAR(120) NOT NULL DEFAULT '',key_reference VARCHAR(255) NOT NULL DEFAULT '',updated_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_graph_entities (id VARCHAR(100) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,entity_type VARCHAR(80) NOT NULL,entity_ref VARCHAR(120) NOT NULL,attributes_json LONGTEXT,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,UNIQUE KEY uq_graph_entity(tenant_id,entity_type,entity_ref),INDEX idx_graph_entity_tenant(tenant_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_graph_edges (id VARCHAR(100) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,from_entity_id VARCHAR(100) NOT NULL,to_entity_id VARCHAR(100) NOT NULL,relation_type VARCHAR(100) NOT NULL,weight DECIMAL(18,8) NOT NULL DEFAULT 1,metadata_json LONGTEXT,created_at DATETIME NOT NULL,INDEX idx_graph_edge_tenant(tenant_id),INDEX idx_graph_edge_from(from_entity_id),INDEX idx_graph_edge_to(to_entity_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_microtasks (id VARCHAR(100) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,task_type VARCHAR(100) NOT NULL,status VARCHAR(40) NOT NULL DEFAULT 'QUEUED',isolation_provider VARCHAR(100) NOT NULL DEFAULT 'none',payload_hash CHAR(64) NOT NULL,created_at DATETIME NOT NULL,started_at DATETIME NULL,finished_at DATETIME NULL,result_json LONGTEXT,error_text TEXT,INDEX idx_microtask_status(status),INDEX idx_microtask_tenant(tenant_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_backpressure_state (stream_key VARCHAR(180) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,depth BIGINT NOT NULL DEFAULT 0,rate_limit DECIMAL(18,6) NOT NULL DEFAULT 0,mode VARCHAR(40) NOT NULL DEFAULT 'NORMAL',updated_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_runtime_patches (id VARCHAR(100) PRIMARY KEY,version VARCHAR(80) NOT NULL,status VARCHAR(40) NOT NULL DEFAULT 'DISABLED',artifact_hash CHAR(64) NOT NULL,approved_by VARCHAR(100) NOT NULL DEFAULT '',created_at DATETIME NOT NULL,activated_at DATETIME NULL,disabled_at DATETIME NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_formal_specs (id VARCHAR(100) PRIMARY KEY,spec_name VARCHAR(160) NOT NULL,version VARCHAR(80) NOT NULL,spec_hash CHAR(64) NOT NULL,verification_status VARCHAR(40) NOT NULL DEFAULT 'UNVERIFIED',evidence_uri TEXT,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,UNIQUE KEY uq_formal_spec(spec_name,version)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_ebpf_policies (id VARCHAR(100) PRIMARY KEY,policy_name VARCHAR(160) NOT NULL,program_hash CHAR(64) NOT NULL,status VARCHAR(40) NOT NULL DEFAULT 'DISABLED',host_requirement VARCHAR(255) NOT NULL DEFAULT 'Linux kernel eBPF support',created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,UNIQUE KEY uq_ebpf_policy(policy_name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_consensus_proposals (id VARCHAR(100) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,proposal_type VARCHAR(120) NOT NULL,payload_json LONGTEXT NOT NULL,status VARCHAR(40) NOT NULL DEFAULT 'PROPOSED',quorum INT NOT NULL DEFAULT 1,votes_json LONGTEXT NOT NULL,proposal_hash CHAR(64) NOT NULL,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,INDEX idx_consensus_status(status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- V30.7 Global Autonomy Advanced Foundation
CREATE TABLE IF NOT EXISTS sbc_global_region_health (region_code VARCHAR(80) PRIMARY KEY,status VARCHAR(40) NOT NULL DEFAULT 'UNKNOWN',latency_ms DECIMAL(12,3) NULL,last_checked_at DATETIME NULL,metadata_json LONGTEXT,updated_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_vendor_contracts (id VARCHAR(100) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,vendor VARCHAR(100) NOT NULL,contract_version VARCHAR(80) NOT NULL,schema_json LONGTEXT NOT NULL,status VARCHAR(40) NOT NULL DEFAULT 'active',created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,UNIQUE KEY uq_vendor_contract(tenant_id,vendor,contract_version)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_tenant_crypto_policies (tenant_id BIGINT PRIMARY KEY,mode VARCHAR(80) NOT NULL DEFAULT 'application-aes-256-gcm',provider VARCHAR(120) NOT NULL DEFAULT '',key_reference VARCHAR(255) NOT NULL DEFAULT '',updated_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_graph_entities (id VARCHAR(100) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,entity_type VARCHAR(80) NOT NULL,entity_ref VARCHAR(120) NOT NULL,attributes_json LONGTEXT,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,UNIQUE KEY uq_graph_entity(tenant_id,entity_type,entity_ref),INDEX idx_graph_entity_tenant(tenant_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_graph_edges (id VARCHAR(100) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,from_entity_id VARCHAR(100) NOT NULL,to_entity_id VARCHAR(100) NOT NULL,relation_type VARCHAR(100) NOT NULL,weight DECIMAL(18,8) NOT NULL DEFAULT 1,metadata_json LONGTEXT,created_at DATETIME NOT NULL,INDEX idx_graph_edge_tenant(tenant_id),INDEX idx_graph_edge_from(from_entity_id),INDEX idx_graph_edge_to(to_entity_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_microtasks (id VARCHAR(100) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,task_type VARCHAR(100) NOT NULL,status VARCHAR(40) NOT NULL DEFAULT 'QUEUED',isolation_provider VARCHAR(100) NOT NULL DEFAULT 'none',payload_hash CHAR(64) NOT NULL,created_at DATETIME NOT NULL,started_at DATETIME NULL,finished_at DATETIME NULL,result_json LONGTEXT,error_text TEXT,INDEX idx_microtask_status(status),INDEX idx_microtask_tenant(tenant_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_backpressure_state (stream_key VARCHAR(180) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,depth BIGINT NOT NULL DEFAULT 0,rate_limit DECIMAL(18,6) NOT NULL DEFAULT 0,mode VARCHAR(40) NOT NULL DEFAULT 'NORMAL',updated_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_runtime_patches (id VARCHAR(100) PRIMARY KEY,version VARCHAR(80) NOT NULL,status VARCHAR(40) NOT NULL DEFAULT 'DISABLED',artifact_hash CHAR(64) NOT NULL,approved_by VARCHAR(100) NOT NULL DEFAULT '',created_at DATETIME NOT NULL,activated_at DATETIME NULL,disabled_at DATETIME NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_formal_specs (id VARCHAR(100) PRIMARY KEY,spec_name VARCHAR(160) NOT NULL,version VARCHAR(80) NOT NULL,spec_hash CHAR(64) NOT NULL,verification_status VARCHAR(40) NOT NULL DEFAULT 'UNVERIFIED',evidence_uri TEXT,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,UNIQUE KEY uq_formal_spec(spec_name,version)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_ebpf_policies (id VARCHAR(100) PRIMARY KEY,policy_name VARCHAR(160) NOT NULL,program_hash CHAR(64) NOT NULL,status VARCHAR(40) NOT NULL DEFAULT 'DISABLED',host_requirement VARCHAR(255) NOT NULL DEFAULT 'Linux kernel eBPF support',created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,UNIQUE KEY uq_ebpf_policy(policy_name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_consensus_proposals (id VARCHAR(100) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,proposal_type VARCHAR(120) NOT NULL,payload_json LONGTEXT NOT NULL,status VARCHAR(40) NOT NULL DEFAULT 'PROPOSED',quorum INT NOT NULL DEFAULT 1,votes_json LONGTEXT NOT NULL,proposal_hash CHAR(64) NOT NULL,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,INDEX idx_consensus_status(status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- V32.1.1 granular RBAC: one canonical schema used by the runtime.
CREATE TABLE IF NOT EXISTS sbc_roles (role_key VARCHAR(60) PRIMARY KEY,display_name VARCHAR(120) NOT NULL,is_system TINYINT(1) NOT NULL DEFAULT 1,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sbc_role_permissions (role_key VARCHAR(60) NOT NULL,resource_key VARCHAR(100) NOT NULL,permission_level VARCHAR(40) NOT NULL,PRIMARY KEY(role_key,resource_key),CONSTRAINT fk_sbc_role_permissions_role FOREIGN KEY(role_key) REFERENCES sbc_roles(role_key) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO sbc_roles(role_key,display_name,is_system) VALUES ('owner','Owner',1),('manager','Manager',1),('caller','Sales / Caller',1),('lead_researcher','Lead Researcher',1),('fulfillment','Fulfillment',1);
