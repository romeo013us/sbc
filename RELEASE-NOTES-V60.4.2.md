# SBC Business Command Center V60.4.2
## MYSQL LIFECYCLE + JSON BOUNDARY HARDENING

Build type: production hotfix over V60.4.1 Runtime Integrity / State Kernel.

### Primary fixes
- Reworked the mysql2/promise pool guard so ordinary `query`/`execute` operations explicitly lease a connection.
- A transient connection/socket failure now destroys the poisoned connection before retry.
- Retries obtain a fresh pool connection rather than replaying a request through the same connection object.
- `getConnection()` now returns a guarded connection for transaction callers.
- Transaction retries remain the caller's responsibility; V60.4.2 does not blindly replay transactions.
- Lock-wait/deadlock errors are treated separately from socket failures so a lock timeout does not unnecessarily poison a healthy TCP connection.
- Added bounded MySQL lifecycle metrics for query/retry/recycle/failure accounting.
- Reduced the default idle pool lifetime to 5 seconds to avoid retaining stale cPanel/managed-MySQL sockets indefinitely.
- Preserved the existing explicit socket ping/keepalive and local-backup safety behavior.
- Added a tolerant JSON boundary that accepts strings, Buffers, and already-materialized objects without calling `JSON.parse()` on objects.
- Hardened dynamic JSON reads across the Command Center's database-backed surfaces.
- Unified authoritative release identity at V60.4.2.
- Updated the root `VERSION`, package metadata, release gate, UI release labels, and diagnostics.

### Safety boundaries
- No new GoDaddy environment secrets.
- No database reset or CRM wipe.
- No pricing changes.
- No Square payment behavior changes.
- No Twilio credential changes.
- No automatic financial transaction replay.
- Existing idempotency and economic controls remain in place.

### Validation
- Commercial OS gate: PASS
- God-Tier foundation gate: PASS
- God-Tier scenario suite: PASS
- Security static checks: PASS
- Federation validation: PASS
- Secret audit: PASS, 0 findings
- MySQL lifecycle test: PASS
- Safe JSON boundary test: PASS
- State Kernel test: PASS
- Experience OS test: PASS
- God-Tier runtime unit test: PASS
- JavaScript syntax sweep: 420 files, 0 failures

### Important deployment note
This package has been statically validated and tested locally. Live GoDaddy/MySQL behavior is not claimed until this exact V60.4.2 package is deployed and its runtime logs confirm the new lifecycle behavior.
