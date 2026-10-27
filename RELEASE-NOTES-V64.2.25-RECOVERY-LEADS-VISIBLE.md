# SBC OS V64.2.26 — RECOVERY LEADS VISIBLE

## Purpose
Restore visibility of surviving SBC lead-mesh records after the authoritative CRM core entered recovery-safe mode.

## Change
- `/api/bootstrap` already exposes `recoveryProjection` from `sbc_lead_mesh`.
- The browser app now merges non-restored recovery projection records into the displayed CRM customer list.
- Recovery records retain `_recoveryProjection=true` and `_leadMeshId`.
- Restored authoritative records are excluded from the projection merge to prevent duplicates.
- Existing server-side mutation guard remains intact: recovery leads cannot be edited through normal CRM mutation routes.
- Dashboard/CRM lead counts now reflect the visible recovery leads.
- Lead detail remains visibly READ ONLY / LEAD MESH.
- No customer, quote, order, renewal, payment, or revenue records are fabricated or created.

## Important
This is **lead visibility recovery**, not authoritative CRM restoration. The existing owner-controlled restore endpoint remains the only path to commit lead-mesh records into `sbc_customers`.

## Verification
- Node syntax: 515/515 PASS.
- Canonical Kim UI retained from V64.2.24.
