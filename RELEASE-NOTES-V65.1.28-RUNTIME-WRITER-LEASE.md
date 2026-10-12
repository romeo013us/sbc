# SBC OS V65.1.28 — Exclusive Runtime Writer Lease

The Oct 11–12 GoDaddy logs show repeated `STALE_MODEL_REFUSED` events as the database epoch advances beyond a process snapshot, plus repeated restarts and MySQL session-store timeouts. Logs still show V65.1.18, so the later Preview/Published role gate is not yet running.

## Fix
- Acquire a process-lifetime MySQL named writer lease before schema reconciliation, migration, seed, repair, or automation startup in Published.
- If another process owns the lease, fail closed into recovery-safe/read-only diagnostics; do not start startup mutations.
- Verify lease ownership on every relational snapshot write and periodically on the pinned lease connection.
- Retain the per-write persistence lock and epoch compare-and-swap. Never reset epoch or force stale snapshots through.
- Preview defaults to readonly; only `SBC_RUNTIME_ROLE=writer` attempts the writer lease.

## Rollout
Set Preview to `SBC_RUNTIME_ROLE=readonly` and Published to `SBC_RUNTIME_ROLE=writer`; merge/release candidate; Update Preview from GitHub and verify build; publish only after build passes. Confirm logs show V65.1.28 and `process writer lease acquired`, with stale epoch and session-store timeout storms stopped. Keep recovery and financial gates locked pending separate authoritative review.

## Validation
Local build and regression suite passed; patched generated `server.js` syntax check passed. GoDaddy runtime is not yet verified. No live database was changed, restored, or unlocked.
