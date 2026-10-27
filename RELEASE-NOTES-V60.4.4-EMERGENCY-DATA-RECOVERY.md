# SBC V60.4.4 — EMERGENCY DATA RECOVERY LOCK

## Purpose
Prevent the V60.4.2 legacy-workspace migration failure from being accepted as a healthy production state.

## Verified baseline
The last verified pre-corruption runtime reported 248 CRM records and 238 active sales leads.

## Hard protections
- `sbc_workspace` is never automatically promoted into the CRM.
- Relational MySQL remains authoritative.
- A materially partial CRM below the verified emergency floor is placed into recovery-required mode.
- Startup seeding, lead promotion, canonicalization, training mutation, and autonomous revenue mutation are suspended during recovery-required mode.
- `saveData()` refuses authoritative writes while recovery is required and preserves the local state as a recovery artifact only.
- No new secrets are required.

## Recovery requirement
An authoritative pre-corruption MySQL snapshot must be restored to recover records that are no longer present in the current database. The build does not fabricate customer records from synthetic or incomplete CSV sources.
