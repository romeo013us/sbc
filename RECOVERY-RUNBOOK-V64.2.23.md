# SBC OS V64.2.25 — Sovereign Data Recovery Runbook

## Current posture

- Recovery Guard remains authoritative until the production MySQL CRM core is restored.
- No startup seed/reset/promotion pipeline is permitted while `MYSQL_RECOVERY_REQUIRED=true`.
- `sbc_lead_mesh` is auxiliary recovery evidence, not authoritative CRM.
- Financial mutations remain blocked.
- This release adds owner-only, read-only recovery controls; it does not import or promote data.

## 1. Find the authoritative snapshot

Owner-only endpoint:

`GET /api/owner/recovery/backup-candidates`

The application scans only its bounded backup locations and reports candidate `.sql`, `.sql.gz`, and `.sql.zip` files. It does not execute them.

## 2. Preflight the snapshot before import

Run:

`node scripts/recovery-authority-audit.js /path/to/sbc-backup.sql`

The audit calculates SHA-256 and checks for the five core CRM tables:

- `sbc_customers`
- `sbc_quotes`
- `sbc_orders`
- `sbc_renewals`
- `sbc_activities`

Exit code `0` means the file is structurally recognized as an authoritative candidate. It does **not** mean the backup is approved for production restore.

## 3. Disposable restore drill

Use the existing `mysql-restore-drill.js` only with a separate disposable MySQL target and `SBC_RESTORE_CONFIRM=YES`.

Never point the restore drill at the production database.

## 4. Production restore

Restore the verified historical snapshot through the database administration path/cPanel/phpMyAdmin or an approved database operator. Do not use the application startup path as a restore mechanism.

After restore, restart SBC and inspect:

`GET /api/owner/recovery/status`

`GET /api/owner/recovery/provenance`

`GET /api/owner/recovery/exit-check`

## 5. Lead provenance audit

The actual `sbc_lead_mesh` schema currently contains `status`, `phone_normalized`, `email`, and `updated_at`; it does **not** establish the `verification_status` / `lead_score` columns assumed by an earlier proposed query.

Use:

`node scripts/lead-mesh-provenance-audit.js`

The audit is SELECT-only. It reports status distribution, E.164 phone compliance, email syntax, 24-hour freshness, and a promotion-readiness count. It never writes to `sbc_customers`.

## 6. Recovery exit

Do not manually clear the recovery flag.

The application must observe an authoritative restored CRM state and clear its own recovery predicate through its normal startup/recovery evaluation.

If the exit check says `workersAllowedToResume=false`, keep all mutation workers suspended.

## 7. Graduated restart

Resume in this order:

1. Read-only telemetry/reporting.
2. Kim briefing/read-only intelligence.
3. Revenue intelligence/dry-run.
4. Outreach preparation.
5. Transactional/payment operations only after owner approval and independent verification.

Do not run Revenue PLAY or create a Square test transaction as part of recovery validation.
