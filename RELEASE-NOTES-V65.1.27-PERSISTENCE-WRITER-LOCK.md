# SBC OS V65.1.27 — Persistence Writer Lock

## Problem addressed
The persistence epoch correctly rejected stale in-memory snapshots, but multiple Node.js processes sharing the same MySQL database could race through snapshot/check/write work. This manifested as `STALE_MODEL_REFUSED` and MySQL lock contention in runtime logs.

## Change
- Adds a connection-scoped MySQL named lock around the entire relational persistence operation.
- Lock contention fails closed with `PERSISTENCE_WRITER_BUSY`; it does not overwrite another process's state.
- Releases the lock on the same connection; destroys the connection if release fails.
- Preserves the existing persistence epoch compare-and-swap and all recovery/owner/financial safety gates.
- No schema change, SQL import, database restore, or new secret is required.

## Important deployment requirement
Preview and Published must share the database only with explicit runtime roles: Preview `SBC_RUNTIME_ROLE=readonly`, Published `SBC_RUNTIME_ROLE=writer`. The lock serializes relational writers; it does not replace role configuration or prove the deployed runtime is current.

## Validation
- Bootstrap verification passed for `sbc-business-command-center@65.1.27`.
- V65.1.27 lock regression assertions: 7/7 passed.
- JavaScript syntax checks passed for bootstrap and patch.
- Full available release test suite passed.
- Live GoDaddy verification remains unconfirmed. No live database was modified and no deployment was performed.
