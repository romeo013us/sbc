-- SBC OS V65.1.21 READ-ONLY schema discovery. Safe to run in phpMyAdmin.
-- This file contains SELECT statements only. Do not infer live results from repository DDL.
SELECT DATABASE() AS selected_database, @@hostname AS database_host, @@read_only AS read_only_mode;
SELECT TABLE_NAME, TABLE_ROWS
FROM information_schema.TABLES
WHERE TABLE_SCHEMA=DATABASE()
ORDER BY TABLE_NAME;
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE()
  AND (COLUMN_NAME='tenant_id' OR TABLE_NAME IN ('sbc_customers','sbc_orders','sbc_renewals','sbc_idempotency_keys','sbc_checkout_event_ledger','sbc_ops_webhook_ledger'))
ORDER BY TABLE_NAME, ORDINAL_POSITION;
SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS indexed_columns
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA=DATABASE()
  AND TABLE_NAME IN ('sbc_customers','sbc_orders','sbc_renewals','sbc_idempotency_keys','sbc_checkout_event_ledger','sbc_ops_webhook_ledger')
GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
ORDER BY TABLE_NAME, INDEX_NAME;
-- After confirming table existence, run exact COUNT(*) separately for each confirmed core table.
-- No schema changes, data backfill, or production unlock is performed by this preflight.
