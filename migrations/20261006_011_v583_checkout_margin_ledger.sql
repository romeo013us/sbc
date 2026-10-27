-- SBC V58.3 checkout economic ledger hardening.
-- Adds tenant + economic snapshot fields to the existing checkout ledger.
-- Vendor cost is captured at acceptance time so later catalog changes cannot
-- rewrite the economics of an already accepted checkout.

ALTER TABLE sbc_checkout_event_ledger
  ADD COLUMN tenant_id VARCHAR(128) NULL AFTER id,
  ADD COLUMN vendor_cost DECIMAL(12,4) NULL AFTER currency,
  ADD COLUMN contribution_margin DECIMAL(12,4) NULL AFTER vendor_cost,
  ADD COLUMN margin_pct DECIMAL(10,6) NULL AFTER contribution_margin;

CREATE INDEX idx_checkout_tenant_status
  ON sbc_checkout_event_ledger (tenant_id, status, created_at);

CREATE INDEX idx_checkout_tenant_sku
  ON sbc_checkout_event_ledger (tenant_id, sku, created_at);
