# SBC V64.2.11 — Recovery Authentication + Read-Only Truth Fix

## Fixed
- Recovery mode now preserves authentication for an existing durable owner session by rehydrating the non-secret owner identity before session validation.
- Partial MySQL recovery now hydrates the relational read model for visibility while keeping `MYSQL_RECOVERY_REQUIRED=true`; mutation/save paths remain blocked.
- Empty-database recovery never seeds CRM data; it only makes the owner identity available for an already-valid durable session.
- No new secrets or credentials introduced.

## Safety
- No authentication bypass.
- No automatic promotion of `sbc_workspace`.
- No CRM seeding/fabrication.
- No financial mutations.
- No recovery commit without the existing explicit owner confirmation gate.
