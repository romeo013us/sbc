# SBC OS V64.2.16 — Atomic Persistence & Data Safety

## Structural fixes
- Partial-shrink shield: blocks core saves when authoritative MySQL data would shrink by more than 10%.
- Empty-source shield: blocks any non-empty authoritative core from being overwritten by an empty in-memory model.
- Optimistic persistence epoch: rejects stale concurrent save models with `STALE_MODEL_REFUSED`.
- Row-level `INSERT ... ON DUPLICATE KEY UPDATE` for customers, quotes, orders, renewals, activities, and fulfillment jobs.
- Removed generic destructive `DELETE + rewrite` behavior from normal persistence.
- Explicit customer/quote/order/renewal deletion now uses a soft `Deleted` state before persistence.
- Read path excludes soft-deleted core rows.
- File-level pre-write recovery snapshots retained to the latest three; no production DDL is used for snapshotting.
- Legacy V8.2 startup lead reset is permanently disabled.

## Safety
- No database restore, seed, or recovery import is performed by this release.
- No new GoDaddy secrets are required.
- Financial mutation controls and owner veto remain unchanged.

## Verification
- Added `scripts/v64216-persistence-safety-test.js` covering empty, partial, threshold, and empty-baseline cases.
