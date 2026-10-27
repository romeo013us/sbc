# SBC V64.2.3 — Database Recovery Order Fix

- Moved schema migration/reconciliation ahead of recovery-state evaluation.
- Recovery guard remains non-destructive and still blocks data reconstruction/seeding when authoritative CRM data is absent or below the verified floor.
- Added owner-only `/api/owner/recovery/status` database identity and migration telemetry.
- Updated legacy compatibility gate to validate the current V64.2.3 release identity.
- No new secrets required.
