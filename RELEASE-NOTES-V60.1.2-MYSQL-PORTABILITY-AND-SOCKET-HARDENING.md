# SBC OS V60.1.2 — MySQL Portability + Socket Hardening

## Production blockers addressed

- Replaced the V58.3 worker-scaling migration's unsupported `ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` DDL with an `information_schema`-driven runtime reconciler.
- Made the worker-scaling migration ledger entry repairable/idempotent for the managed MySQL environment.
- Set the active release identity to `60.1.2`; V60.1.1/V60.1.0/V60.0.0 remain supported rollback identities.
- Configured newly-created MySQL pooled sessions with explicit `wait_timeout` and `interactive_timeout` session values, while retaining stale-socket detection, retry, and connection destruction.

## Deployment evidence addressed

V60.1.1 successfully reached the God-Tier runtime, but production logs still showed the worker DDL failure and subsequent stale-socket/EPIPE writes. V60.1.2 specifically closes those two remaining infrastructure gaps before commercial scaling work is layered on top.

## Safety

- No new GoDaddy environment secret required.
- No credentials embedded.
- No production payment transaction generated.
- Existing CRM lead records remain authoritative.
