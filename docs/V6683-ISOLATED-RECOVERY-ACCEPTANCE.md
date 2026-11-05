# SBC V66.83 — isolated recovery acceptance gate

## What this proves
The CI job boots a disposable MySQL 8 server with an isolated source schema and an **empty** destination schema. It creates synthetic multi-tenant rows in **seven** logical tables:
- sbc_customers, sbc_quotes, sbc_orders, sbc_renewals, sbc_activities
- sbc_financial_vault_locks, sbc_lead_mesh

It runs the existing SBC logical-backup exporter to write SQL, restores that SQL through the hardened restore utility under a schema-scoped user, and compares every row count and SHA-256 digest of sorted rows in both schemas. It also confirms tenant counts, rejects unsafe destination/SQL arguments, and refuses to overwrite a nonempty target.

**It does NOT use any production records. A synthetic restore PASS does not certify recovery of SBC's actual GoDaddy database or Square payment reconciliation.**

## Safeguards
- The restore utility only permits 127.0.0.1:3306, schema sbc_ci_restore_target, user sbc_ci_restore, both explicit confirmations. It refuses ambiguous DB_HOST/DB_NAME/MYSQL_HOST/MYSQL_DATABASE values.
- SQL import requires SBC's generated logical-backup header and five core tables, rejects supported classes of cross-schema statements, and caps input at 128 MiB.
- **MySQL user privileges must be limited to the disposable destination**. SQL text inspection is defense-in-depth, not a sandbox. Do not use root and do not use a loopback tunnel to production.
- It refuses an already populated target. The synthetic job uses distinct local source and destination schemas; no Square or vendors are connected.
- No backup file is uploaded to GitHub. CI output contains only non-PII counts/digests.

## Next production-data acceptance drill (not automated by this PR)
1. Obtain a consistent, encrypted production MySQL snapshot via the approved database admin path. Use database-native snapshot/dump facilities appropriate to its actual schema. Never upload the raw snapshot to GitHub, chat, CI artifacts, or a public ZIP.
2. Record source timestamp, table inventory, row counts and stable cryptographic digests for the same database snapshot. Ensure critical payment and order identifiers are covered, not just aggregate counts.
3. Have the database administrator provision **a truly separate MySQL host**, private destination schema and limited restore account. Restore with an approved database-native method appropriate for its size; this 128 MiB SBC SQL drill is not a general-purpose production restore engine.
4. Reconcile each table's counts/digests, foreign keys, tenant boundaries, owner/Lorna access, and paid order / Square mapping; avoid sending webhooks or vendor purchase requests.
5. Record RPO (age of snapshot), RTO (measured end-to-end restore time), encryption/access controls, and failure/retry findings. Clean the test database after approval.

## Deployment
The PR changes only scripts and CI; no production SQL is run and no GoDaddy Published application is changed. The V66.82 live system should remain stable.

## Important limitations
Existing scripts/mysql-backup.js is a logical export helper and has **not** been established to produce an ACID-consistent snapshot under concurrent live writes. Use vetted MySQL tooling or a stopped-write snapshot for a production recovery guarantee. A table-count pass alone is not sufficient; this PR checks row digests in CI, but real data recovery remains pending.
