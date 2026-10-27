# SBC OS V60.1.0 — God-Tier Integrity Hardening

## What changed
- Separated the immutable event ledger from the mutable worker queue.
- Added transactional ledger+queue publication when a MySQL connection transaction is available.
- Added event hash, tenant/idempotency uniqueness, shard/timeline indexes.
- Hardened circuit-breaker half-open behavior so only one probe is admitted.
- Hardened timeout helper to accept a task function and avoid creating the timer before the task is scheduled.
- Added combined Scenario A/B/C release suite.
- Updated production identity to 60.1.0.

## Verification
- Scenario A: 1,000 synthetic event publications through the in-memory transactional harness — PASS.
- Scenario B: circuit opening/recovery and timeout containment — PASS.
- Scenario C: ledger/index audit — PASS.
- JavaScript syntax audit: 0 failures.
- JSON audit: 47 files, 0 failures.
- Security static checks: PASS.
- Federation validation: PASS.
- Secret audit: PASS.

## Engineering accuracy
The test harness throughput result is a synthetic local benchmark, not a claim of production microsecond latency or database throughput. Real GoDaddy/MySQL performance must be measured in the deployed environment.
