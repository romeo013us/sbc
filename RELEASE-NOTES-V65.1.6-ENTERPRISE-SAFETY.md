# SBC OS V65.1.6 — Tenant Context, Recovery Integrity & Reconciliation

## Included
- Bumped authoritative release identity to V65.1.6 and updated browser shell cache keys.
- Bound authenticated, server-derived tenant identity to Node.js AsyncLocalStorage for async request propagation. The context helper rejects malformed tenant IDs and does not trust tenant headers.
- Added a hash-bearing tenant audit ledger writer and additive SQL schema for tenant audit events, integrity snapshots, and deduplicated webhook inbox events.
- Added a fail-closed state reconciliation guard. A mismatch or unavailable source attempts to engage a durable lock; it never repairs data or unlocks automatically.
- Added a read-only lead reconciliation report that scans packaged CSV worksheets against a SQL dump for possible text matches. It does not generate recovery SQL and cannot declare a record missing/recovered from text search alone.
- Updated the checkout fulfillment worker to scope task lookups and inserts by tenant ID. The additive migration adds the tenant column and index to the existing fulfillment task table.
- Corrected the recovery-isolation test's stale release identity assertion and aligned its recovery guard check with the actual startup guard implementation.

## Safety boundaries
- No customer rows are inserted, deleted, or rewritten by this release.
- No recovery lock is disabled and no payment configuration is changed.
- The five-record discrepancy remains unresolved until an authoritative pre-incident data snapshot is found and reconciled against a fresh production export.
- The tenant context is request-context propagation, not a proof that every existing SQL query is tenant-filtered. Route/query enforcement must be verified during technical acceptance.
- Migration execution on the live database has not been performed in this artifact build. Test on an isolated database clone before production deployment.

## Runtime
- Node.js 22.x
- GoDaddy/Airo start command: `npm start` (`node server.js`)
