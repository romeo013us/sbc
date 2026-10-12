-- SBC OS: read-only production database reconciliation audit
-- Version: 1.0.0
-- SAFETY: SELECT statements only. No DDL, DML, locks, migrations, or data export.
-- Run in the correct SBC database in phpMyAdmin. Review the selected database name first.
-- This report returns aggregate counts and tenant/status distributions only; no customer PII.
-- IMPORTANT: Preview and Published share the same database. Do not import the schema export.

-- 1) Confirm the database context and whether core tables exist.
SELECT DATABASE() AS selected_database, NOW() AS checked_at;

SELECT table_name, table_rows AS estimated_rows
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN (
    'sbc_customers',
    'sbc_orders',
    'sbc_renewals',
    'sbc_lead_mesh',
    'sbc_idempotency_keys',
    'sbc_request_idempotency',
    'sbc_checkout_event_ledger',
    'sbc_checkout_webhook_inbox'
  )
ORDER BY table_name;

-- 2) Exact row counts for core entities. These are counts, not a recovery decision.
SELECT 'sbc_customers' AS table_name, COUNT(*) AS row_count FROM sbc_customers
UNION ALL
SELECT 'sbc_orders', COUNT(*) FROM sbc_orders
UNION ALL
SELECT 'sbc_renewals', COUNT(*) FROM sbc_renewals
UNION ALL
SELECT 'sbc_lead_mesh', COUNT(*) FROM sbc_lead_mesh
UNION ALL
SELECT 'sbc_idempotency_keys', COUNT(*) FROM sbc_idempotency_keys
UNION ALL
SELECT 'sbc_request_idempotency', COUNT(*) FROM sbc_request_idempotency
UNION ALL
SELECT 'sbc_checkout_event_ledger', COUNT(*) FROM sbc_checkout_event_ledger
UNION ALL
SELECT 'sbc_checkout_webhook_inbox', COUNT(*) FROM sbc_checkout_webhook_inbox;

-- 3) Tenant distribution for the core business entities.
-- Tenant ID values are shown only as IDs with counts; no customer-level rows.
SELECT 'sbc_customers' AS table_name, CAST(tenant_id AS CHAR) AS tenant_id, COUNT(*) AS row_count
FROM sbc_customers GROUP BY tenant_id
UNION ALL
SELECT 'sbc_orders', CAST(tenant_id AS CHAR), COUNT(*)
FROM sbc_orders GROUP BY tenant_id
UNION ALL
SELECT 'sbc_renewals', CAST(tenant_id AS CHAR), COUNT(*)
FROM sbc_renewals GROUP BY tenant_id
ORDER BY table_name, tenant_id;

-- 4) Idempotency / webhook aggregate state. Do not interpret counts alone as proof
-- of replay safety; application code and uniqueness constraints must also be reviewed.
SELECT 'sbc_idempotency_keys' AS table_name, CAST(status AS CHAR) AS state, COUNT(*) AS row_count
FROM sbc_idempotency_keys GROUP BY status
UNION ALL
SELECT 'sbc_request_idempotency', CAST(status AS CHAR), COUNT(*)
FROM sbc_request_idempotency GROUP BY status
UNION ALL
SELECT 'sbc_checkout_event_ledger', CAST(status AS CHAR), COUNT(*)
FROM sbc_checkout_event_ledger GROUP BY status
UNION ALL
SELECT 'sbc_checkout_webhook_inbox', CAST(status AS CHAR), COUNT(*)
FROM sbc_checkout_webhook_inbox GROUP BY status
ORDER BY table_name, state;

-- 5) Check global event-ledger idempotency-key collisions in the existing data.
-- The unique index may prevent duplicates already; this query is still read-only.
SELECT COUNT(*) AS duplicate_idempotency_key_groups
FROM (
  SELECT idempotency_key
  FROM sbc_checkout_event_ledger
  GROUP BY idempotency_key
  HAVING COUNT(*) > 1
) AS duplicate_keys;

-- Interpretation guardrails:
-- * This is a snapshot, not a restore, migration, or production-readiness sign-off.
-- * Do not lower any authoritative customer baseline based on these counts.
-- * Do not fabricate missing records or infer that lead-mesh rows are customer rows.
-- * Keep the recovery/emergency gate engaged until the authoritative source and row
--   provenance are reconciled and separately approved by the owner.
