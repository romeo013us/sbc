# SBC OS V64.2.5 — Recovery Truth Layer

## Purpose
Make the production recovery state truthful and observable without reconstructing, seeding, promoting, or overwriting authoritative CRM data.

## Changes
- V64.2.5 release identity unified across package/runtime/UI.
- `/api/bootstrap` is recovery-aware and exposes owner diagnostic recovery state.
- Owner recovery state includes MySQL database identity, server identity, schema migration count/timestamp, relational counts, and verified production baselines.
- Dashboard no longer presents an empty `$0 / 0 leads / 0 orders` operating cockpit when MySQL recovery is required.
- Recovery dashboard explicitly shows protected/suspended capabilities.
- Revenue PLAY, startup seeding, Kim missions, autonomous mutation workers, and financial mutations remain blocked during recovery.
- `sbc_workspace` remains auxiliary and is never promoted automatically.

## Safety
This build does not restore data and does not modify production CRM records as part of recovery. An authoritative MySQL snapshot remains required when the verified baseline is not present.

## Verification
- Root `package.json`: 64.2.5
- `config/release-identity.js`: 64.2.5
- `VERSION`: V64.2.5
- Migration reconciliation precedes recovery decision: PASS
- JS/CJS/MJS syntax scan: PASS
- Root `server.js` and start command present: PASS
- No new GoDaddy secret required
- Financial mutations remain blocked by design
