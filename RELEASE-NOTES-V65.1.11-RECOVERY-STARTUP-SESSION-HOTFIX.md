# SBC OS V65.1.11 — Recovery Startup Gate & Session Availability Hotfix

## Scope
- Prevent `saveData()` and `writeRelational()` from starting relational snapshot writes before the authoritative MySQL recovery census has completed.
- Keep all writes blocked when recovery is required. This release does not lower the 248-customer verified baseline, fabricate records, or promote the read-only `sbc_lead_mesh` projection.
- Bound durable MySQL session lookup to the existing 5-second session-store timeout.
- Distinguish a session-store outage/timeout from a genuinely missing or expired session: temporary lookup failures return HTTP 503 `SESSION_STORE_UNAVAILABLE`, rather than being mislabeled as HTTP 401. No authentication bypass is added.
- Update the frontend release/cache identity to V65.1.11 and preserve the session-overlay sign-out fix.

## Validation
- `npm run test:all` — PASS.
- `npm run predeploy:open-gate` — PASS.
- New targeted V65.1.11 recovery/session checks — 6/6 PASS.
- Session overlay regression — 3/3 PASS.
- Lead workspace integration — PASS using a fake MySQL connection; not a production database test.
- ZIP integrity and static syntax checks must pass before delivery.

## Important limitations
- This package has not been deployed by this build process and has not been tested against the live GoDaddy runtime or production MySQL.
- The authoritative customer count remains 243 against the verified baseline of at least 248. Recovery mode must remain active until an authoritative restore/reconciliation is completed.
- This hotfix prevents pre-census writes and improves session-store failure reporting. It does not restore missing records or certify that all slow requests are resolved.
