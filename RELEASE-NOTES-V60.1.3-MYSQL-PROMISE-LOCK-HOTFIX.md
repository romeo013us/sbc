# SBC V60.1.3 — MySQL Promise + Lock Contention Hotfix

## Production fixes
- Corrected mysql2 pool `connection` event handling: emitted connections use the callback-style API; no Promise `.then/.catch/await` calls are made on those objects.
- Preserved existing MySQL pool hardening and stale-socket recovery.
- Changed full relational snapshot persistence so lock-wait timeouts are not immediately replayed against the same contention window; local backup remains the failure-safe path.
- Reduced unnecessary database contention from the autonomous sweep: it now persists only when the sweep actually emits/processes work.
- No new environment secret required.
- CRM data and Lorna lead seed remain unchanged.

## Version
`60.1.3`

`60.1.2` remains an accepted rollback release.

## Validation target
GoDaddy must report:
`sbc-business-command-center@60.1.3 start`
and
`SBC FINAL PRODUCTION 60.1.3 running on port ...`

No Lead Auction Engine deployment is included in this hotfix.
