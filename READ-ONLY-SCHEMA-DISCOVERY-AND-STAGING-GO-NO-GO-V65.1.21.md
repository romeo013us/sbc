# SBC OS V65.1.21 — Schema Discovery & Staging Go/No-Go

## Important status boundary

This document is a runbook, not a report of live database results. No query in this package has been executed against GoDaddy production. The source bundle's `server.js` and `database.sql` define the core CRM tables without `tenant_id`; production may differ and must be inspected directly. Do not infer production counts from repository files or historical snapshots.

Production stays on V65.1.10 with the recovery guard locked. Do not run DDL, backfill tenant values, unlock recovery, send outbound messages, or execute payment/refund operations as part of discovery.

## 1. Read-only phpMyAdmin discovery

Select the intended database in phpMyAdmin and run the statements one at a time. Save/export the actual result grids, with hostnames or other sensitive infrastructure identifiers redacted before sharing.

### A. Database identity and table inventory

```sql
SELECT DATABASE() AS selected_database, @@hostname AS database_host, @@read_only AS read_only_mode;

SELECT TABLE_NAME, TABLE_ROWS
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME;
```

`TABLE_ROWS` can be approximate for InnoDB. Use exact `COUNT(*)` only after confirming a table exists.

### B. Tenant columns and relevant schema

```sql
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (COLUMN_NAME = 'tenant_id'
       OR TABLE_NAME IN ('sbc_customers','sbc_orders','sbc_renewals',
                         'sbc_idempotency_keys','sbc_checkout_event_ledger',
                         'sbc_ops_webhook_ledger'))
ORDER BY TABLE_NAME, ORDINAL_POSITION;
```

### C. Index and uniqueness inventory

```sql
SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE,
       GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS indexed_columns
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('sbc_customers','sbc_orders','sbc_renewals',
                     'sbc_idempotency_keys','sbc_checkout_event_ledger',
                     'sbc_ops_webhook_ledger')
GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
ORDER BY TABLE_NAME, INDEX_NAME;
```

### D. Exact core counts — only for tables confirmed in A/B

Run each query separately. If a table is absent, do not run its count query.

```sql
SELECT COUNT(*) AS customer_count FROM sbc_customers;
SELECT COUNT(*) AS order_count FROM sbc_orders;
SELECT COUNT(*) AS renewal_count FROM sbc_renewals;
```

For each confirmed tenant-scoped table only:

```sql
SELECT tenant_id, COUNT(*) AS row_count
FROM <confirmed_table_with_tenant_id>
GROUP BY tenant_id
ORDER BY tenant_id;
```

Replace the placeholder with a real table name that Query B confirmed; do not run the placeholder literally. Do not assign `tenant_id = 1` unless an owner-approved mapping proves every affected row belongs to that tenant.

### E. Full DDL for whichever ledger table actually exists

Run only the matching statement for each table returned by the table inventory:

```sql
SHOW CREATE TABLE sbc_idempotency_keys;
SHOW CREATE TABLE sbc_checkout_event_ledger;
SHOW CREATE TABLE sbc_ops_webhook_ledger;
```

If a table is absent, omit its `SHOW CREATE TABLE` statement. These three names are not interchangeable.

## 2. Staging prerequisites

Before any migration:

- Create a distinct staging database and a distinct database user with privileges only on staging.
- Use a separate app folder/subdomain and separate configuration. Confirm its DB hostname/schema identity at runtime.
- Restore a scrubbed copy of a verified backup. Do not use production credentials for staging.
- Use Square sandbox credentials; disable Twilio SMS, outbound email, live checkout, refunds, and all real financial side effects.
- Record the backup checksum, restore time, source version, and row counts before testing.

## 3. V65.1.21 webhook regression coverage

The package runs a deterministic mock-MySQL test: 20 concurrent deliveries of the same event result in one successful claimant, later processed replay is suppressed, and a simulated crash/recovery/retry reaches `PROCESSED`. It also checks the legacy `event_hash` migration predicate and verifies that the persisted job replay-list check follows the durable ledger claim.

This test does not connect to MySQL or prove production cluster behavior. On staging, also test database restart, duplicate key collisions, owner recovery after the five-minute stale-claim window, malformed provider event IDs, signature verification, and provider-side idempotency/reconciliation.

## 4. Proxy trust

V65.1.21 accepts an optional explicit integer `SBC_TRUST_PROXY` from 0 through 4. When unset, it uses a bounded one-hop default to avoid requiring another GoDaddy environment slot. Invalid overrides fail closed. Client IP handling still requires verification against GoDaddy proxy topology before relying on IP-based security controls.

## 5. Go/no-go gates

Do not cut over until all are evidenced:

1. Schema inventory and exact row counts match the intended database.
2. Tenant mapping and authorization paths are reviewed; no automatic default/backfill is used.
3. Webhook concurrency, crash/recovery, replay, and external idempotency checks pass on staging.
4. MFA is enrolled and required for sensitive owner actions.
5. Staging cannot write to production; live messaging/payment routes are disabled.
6. 15-minute smoke run and 72-hour shadow plan complete with logs, error rate, latency, queue age, duplicate rate, and rollback evidence.
7. A fresh backup is verified and rollback steps rehearsed.
8. Owner explicitly approves production cutover and any recovery-guard change.

Passing source tests is not production certification. This package does not deploy itself, execute database DDL, restore production, send messages, charge/refund payments, or unlock recovery.
