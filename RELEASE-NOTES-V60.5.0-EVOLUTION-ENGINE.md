# SBC V60.5.0 — EVOLUTION ENGINE

## Purpose
SBC Evolution Engine converts ordinary business intent observed through Kim into a governed technical capability lifecycle:

OBSERVE → DIAGNOSE → DESIGN → BUILD → TEST → SECURITY_CHECK → SIMULATE → STAGE → APPROVE → DEPLOY → VERIFY → ROLLBACK → LEARN

## God-Tier capabilities
- First-principles capability discovery with reusable internal blueprints.
- Capability-gap evidence and technical deficit mapping.
- Proposal planning for database, API, UI, diagnostic, and workflow capabilities.
- Persistent capability/proposal/run/checkpoint records.
- Staging Bridge with reviewable plan, security findings, simulation contract, and live-diff-ready artifact model.
- Tenant-scoped proposal records.
- High-risk and critical action classification.
- Production mutation blocked by design in this release; approval does not itself deploy code.
- Recovery-safe behavior: if the authoritative MySQL recovery guard is active, evolution staging is suspended.
- No new GoDaddy secrets required.

## Security boundary
The Evolution Engine does not execute arbitrary generated code, install arbitrary packages, download arbitrary runtime code, mutate credentials, delete/merge customers, send bulk communications, or directly mutate financial systems. Those capabilities require separate governed implementation and explicit owner controls.

## Owner surface
`/evolution-engine` — owner-only staging bridge.

API:
- `GET /api/evolution/status`
- `GET /api/evolution/proposals`
- `POST /api/evolution/observe`
- `POST /api/evolution/stage`
- `POST /api/evolution/proposals/:id/approve`
- `POST /api/evolution/proposals/:id/reject`

## Important
This release adds the autonomous evolution control plane. It does not claim that production code can safely self-rewrite without governance. The permanent upgrade path remains sandbox → tests → security → simulation → stage → owner approval → separately governed deployment → verification → rollback.
