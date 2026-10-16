# SBC OS V65.1.57 — Owner Force-Unlock

## Changes
- Adds an authenticated owner-only force-unlock action for the recovery latch, read-only mode, DDL gate, and operational kill switches.
- Stores the owner override in `sbc_settings` so recovery mode does not re-engage on restart after the owner clears it.
- On the next owner login, the frontend executes the one-time unlock action and clears all runtime operational kill switches.
- Clears every `PRODUCTION_HARDENING.KILL_STATES` value through the runtime gate API.
- Preserves owner authentication, tenant scoping, and the exclusive MySQL writer lease. The force-unlock refuses when another process owns that lease.

## Scope boundaries
This is an explicit owner-authorized override of the recovery/read-only and operational kill-switch states. It does not delete customer records or synthesize missing CRM rows. It does not turn off the database mutual-exclusion lease.

## Verification
Run `npm run test:v6557-owner-force-unlock` and `npm run build`. GitHub Actions must pass before merge.
