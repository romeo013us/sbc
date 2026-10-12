# SBC OS V65.1.23 — Read-query cancellation release report

## Changes
- The MySQL pool guard now places a 5-second limit on read-only SQL statements (`SELECT`, `SHOW`, `DESCRIBE`, `DESC`, `EXPLAIN`, `WITH`).
- If a read-only query exceeds the limit, the specific leased connection is destroyed and the timeout is marked non-retryable. This avoids leaving a detached query on a pooled connection and avoids replaying timed-out statements.
- V65.1.22 bounded Kim/Growth response behavior, null/unknown lead counts, cache-busting, tenant hardening, webhook recovery, persistent-state behavior, owner veto and financial restrictions are retained.
- Recovery remains locked; no data writes, financial operations, outbound messages, or recovery unlocks were run.

## Verification run
- `node bootstrap.js --verify`: PASS; release identity resolves to `sbc-business-command-center@65.1.23`.
- Outer `npm run test:all`: PASS; 7/7 persistent-state tests and existing root regression tests pass.
- Full extracted source `npm run test:all`: PASS; existing source suite plus new V65.1.23 read-query cancellation test pass.
- New test uses a fake pool and verifies: normal read works, hanging read rejects within the configured bound, the leased connection is destroyed, and timed-out query is not retried.
- `node --check` on patched query guard and bootstrap: PASS.

## Limitations
- This is not a live GoDaddy database test. The fake-pool regression test does not prove how quickly a particular MySQL/MariaDB server cancels work after socket destruction.
- No live schema, tenant distribution, customer count, or API endpoint was queried from this environment.
- No staging database is configured. Preview and Published share the live database, so do not treat Preview as isolated staging.
- Keep production recovery and financial mutation gates engaged until the live endpoints and data integrity are verified after upload.
