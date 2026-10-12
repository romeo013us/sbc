# SBC OS V65.1.24 — Test Report

## Purpose
The Oct 11 GoDaddy logs show the app still running V65.1.18, repeated `STALE_MODEL_REFUSED` errors while the DB persistence epoch advances, MySQL lock-wait timeouts, and session-store timeouts. Preview and Published share one database, so this release establishes a fail-closed single-writer role: Published is the only writer; Preview is read-only.

## Local verification
- Root bootstrap/release verification: PASS (`sbc-business-command-center@65.1.24`).
- Persistent-state regression: PASS, 7/7.
- V65.1.19 phases regression: PASS.
- V65.1.22 API stabilization regression: PASS.
- V65.1.24 single-writer gate regression: PASS.
- Patched source syntax check (`node --check server.js`): PASS.
- Patched source V65.1.19 phases regression: PASS.
- Patched source V65.1.20 tenant-hardening regression: PASS; strict guard tests 3/3 and fallback scan 0.
- Patched source V65.1.23 read-query cancellation regression: PASS; bounded SELECT timeout, leased connection destroyed, no retry.
- Patched source V65.1.24 runtime-role regression: PASS.

## Required GoDaddy environment configuration
- **Published:** set `SBC_RUNTIME_ROLE=writer`.
- **Preview:** set `SBC_RUNTIME_ROLE=readonly` (default if unset).
- Do not set both environments to `writer`. Configure these before publishing the package. The current dashboard shows separate Preview and Publish environment-variable counts, but the actual hosted role behavior must still be verified from logs after deployment.

## Behavior
- Preview hydrates existing relational data with SELECT queries only; it skips schema migrations, seed/repair writes, full-snapshot saves, and background mutation workers. API business mutations are blocked in Preview. Owner login/logout are permitted for read-only inspection.
- Published retains the writer path and the existing persistence epoch check; this release does not bypass stale-model protection.
- Read-only Preview fails closed if its hydration fails.
- Recovery lock and financial restrictions remain intact. No live database was accessed or changed during these tests.

## Explicit limits
- No live GoDaddy deployment test was run from the build environment.
- These tests do not prove that the two GoDaddy environments have been configured correctly or that runtime errors have stopped. After deployment, verify logs show `runtime role=writer` only in Published and `readonly` in Preview, then confirm stale-epoch and lock-wait errors stop. Do not unlock recovery or enable payments/outreach until the live data census is reconciled.
