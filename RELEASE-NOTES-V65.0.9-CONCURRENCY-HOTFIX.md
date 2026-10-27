# SBC Business Command Center V65.0.9 — Concurrency Hotfix

## Scope
- Wrap agent queue selection and status transition in one explicit MySQL transaction using a dedicated pool connection.
- Retain `FOR UPDATE SKIP LOCKED` and conditional `status='pending'` update so concurrent workers cannot claim the same pending event row.
- Make the standalone worker fail closed while recovery is required; the default is locked. It performs no queue database operation unless the runtime is explicitly configured with recovery clear.
- Serialize state sequence allocation per `(tenant_id, aggregate_id)` by materializing/locking the projection row before computing `MAX(sequence_no)+1`.
- Add a bounded retry for duplicate sequence-key collisions. Existing idempotency replay handling remains in place.
- Keep recovery lock and the verified pre-corruption CRM baseline unchanged. This release does not restore customer records, clear recovery mode, or start outreach.

## Validation performed locally
- Worker concurrency/recovery test: PASS (mock database; fail-closed recovery, transaction boundaries, one-winner concurrent claim).
- State kernel regression test: PASS.
- Owner lead regression: PASS (18 cold records, owner verification still required; no outreach).
- Lorna batch regression: PASS (29 cold records, owner verification required).
- Notifications UI regression: PASS (7/7).
- Schema/log regression: PASS (7/7).
- Recovery write-gate regression: PASS (8/8).
- Release integrity regression: PASS.
- JavaScript syntax checks: PASS.
- ZIP integrity: validated separately after packaging.

## Limitations
- This is not a production database concurrency test. No live MySQL connection or cPanel runtime was available.
- The standalone worker's recovery gate defaults to locked. Do not enable it until authoritative database reconciliation is independently complete.
- Database recovery remains outstanding; this package does not fabricate or restore missing records.
