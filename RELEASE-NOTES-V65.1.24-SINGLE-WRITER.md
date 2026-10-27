# SBC OS V65.1.24 — Single-writer runtime gate

## Why
Oct 11 logs show repeated STALE_MODEL_REFUSED errors with the database epoch advancing beyond a process snapshot, MySQL lock-wait timeouts, and session-store timeouts. Preview and Published share one database, so both runtimes must not run full-snapshot persistence.

## Required runtime configuration
- Published: set SBC_RUNTIME_ROLE=writer. Only Published runs migrations, seed/repair, full-snapshot saves, and background automation.
- Preview: set SBC_RUNTIME_ROLE=readonly, or leave it unset (fail-closed default). Preview hydrates existing schema with SELECTs only, skips migrations/seeding/background workers, blocks API business mutations, and serves a read-only UI.
- Configure roles in each environment's own settings before deploying. Never set both environments to writer.

## Safeguards
- Does not reset or bypass the persistence epoch check.
- Does not restore data, unlock recovery, initiate payments/refunds, or send outreach.
- If Preview cannot hydrate, it fails closed into recovery-safe status.
- Retains V65.1.23 read-query cancellation.

## Limits
Local regression tests do not prove GoDaddy environment scoping. After deployment, verify writer only in Published and readonly in Preview, then confirm stale-epoch and lock-wait errors stop before enabling business writes.
