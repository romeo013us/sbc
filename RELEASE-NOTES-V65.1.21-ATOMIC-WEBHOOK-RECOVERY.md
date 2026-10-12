# SBC OS V65.1.21 — Atomic Webhook Recovery & Schema Discovery

## Fixed in this release
- Corrected a V65.1.20 legacy ledger migration predicate that compared `provider_event_id` with itself. The migration now detects `event_hash` and only renames it when `provider_event_id` is absent.
- Reordered webhook processing so the database claim is checked before the persisted job replay list. When a previous attempt durably saved the job state but crashed before marking the SQL ledger processed, a post-recovery replay can reconcile the ledger rather than leaving a claimed event stuck.
- Added a mock-MySQL regression test for 20 concurrent duplicate deliveries, processed-event replay, and a crash/owner-recovery/retry sequence.
- Included a SELECT-only schema discovery script for the actual target database and index inventory.
- Preserved the V65.1.20 strict tenant guard, proxy trust fail-closed configuration, owner MFA gates, Kevin governance, owner veto, and locked recovery behavior.

## Important architecture boundary
Fulfillment job state remains persisted through the existing `megaSave()` data store, while the webhook inbox ledger is MySQL. They are separate persistence systems, so this is not a single ACID transaction spanning both stores. The design uses a durable inbox, monotonic job transitions, a persisted replay marker, and explicit recovery after a stale claim. It does not claim mathematically exactly-once external effects. Provider idempotency keys and reconciliation are still required for side effects outside the database.

## Database and production status
- No live GoDaddy database was queried or modified while producing this package.
- Core table tenant columns, row counts, tenant distribution, actual live ledger table, indexes, and the actual proxy hop count remain unverified until read-only phpMyAdmin output is supplied.
- Do not add tenant columns or backfill `tenant_id=1` without verifying ownership and application read/write paths.
- Do not configure a guessed proxy hop count. Reuse an existing environment slot; the 50-slot limit remains.
- Production recovery remains locked on the V65.1.10 baseline. No production deployment, restore, payment, refund, outbound message, or unlock was performed.

## Tests
`npm run test:all` runs root build verification (which applies the overlays and runs the new webhook regression), persistent-state tests, and V65.1.19 phase regression tests. Live staging and GoDaddy validation remain separate release gates.
