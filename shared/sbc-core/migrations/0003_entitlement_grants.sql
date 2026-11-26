CREATE TABLE sbc_core_entitlement_grants (
 tenant_ref VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 entitlement_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 last_event_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 state ENUM('active','revoked','suspended') NOT NULL,
 PRIMARY KEY (tenant_ref,entitlement_key),
 FOREIGN KEY (tenant_ref,last_event_key,entitlement_key) REFERENCES sbc_core_entitlement_events(tenant_ref,event_key,entitlement_key)
) ENGINE=InnoDB;
