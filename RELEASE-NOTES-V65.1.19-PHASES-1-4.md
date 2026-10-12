# SBC OS V65.1.19 — Governed Phases 1–4 Control Plane

## Included

- **Phase 1 — Security and durable events:** MySQL-backed unique webhook event ledger for cross-process idempotency; encrypted owner TOTP enrollment/verification using an already-configured signing secret; tenant context required by new operations routes; MFA required for sensitive approval/redrive/recovery actions; audited owner actions; canonical webhook status matching rejects negated/cancelled transit or delivery statuses.
- **Phase 2 — Revenue workflows:** consent-gated outreach draft creation, quote-draft and renewal-review queue, explicit owner approval state, and manual-execution boundary. No messages, quote delivery, checkout, or payment are triggered by these routes.
- **Phase 3 — Fault recovery:** persistent fault queue with attempt caps, owner-MFA-gated redrive queueing, read-only recovery drill, explicit separate-staging configuration check, and stuck webhook claim release only after five minutes with owner MFA.
- **Phase 4 — Operations cockpit:** `/ops-center` UI, Today view, read-only command palette, fault/workflow visibility, runtime/DB latency telemetry, and an explicitly owner-entered revenue/direct-cost margin ledger.

## Safeguards

- No automatic production recovery unlock, database restore, deployment, payment, refund, SMS/email send, or fulfillment redrive execution.
- The existing recovery guard and owner veto remain in place.
- New routes fail closed when MySQL or tenant context is missing.
- No new GoDaddy environment-variable slot is required. MFA encryption reuses an existing configured secret (`SBC_SESSION_SECRET`, `SBC_TENANT_CONTEXT_KEY`, or `SBC_JWT_SECRET`) and refuses enrollment if none is configured.
- `SBC_STAGING_DATABASE_URL` is only inspected to report whether isolated staging is configured; this build does not silently reuse production as staging.

## Scope boundaries still open

This is the V65.1.19 Phase 1–4 **implementation increment**, not a claim that every original production-readiness item is finished:

- A static scan found 109 legacy `tenantId || 1` / `tenant_id || 1` fallback expressions across source JavaScript. They were not mass-rewritten because blind replacements can break existing routes; the new operations routes fail closed on missing tenant context. The legacy sites still need a route-by-route audit and removal/classification.
- Revenue workflows create durable draft/approval tasks. This increment does not yet turn them into automatic quote creation, renewal execution, or message sending.
- Fault redrive is persisted and owner-MFA-gated, but this increment queues work for separate worker review; it does not execute arbitrary failed business operations.
- Margin reporting is based on owner-entered revenue/direct-cost entries, not a reconciled Square/MySQL accounting ledger. Runtime telemetry is a live snapshot, not a statistically validated p95/SLO system.
- The staging endpoint reports whether a separate `SBC_STAGING_DATABASE_URL` is configured; it does not create a staging database or deploy to it.

## Verification performed

- Root launcher build verification: PASS (`sbc-business-command-center@65.1.19`).
- Persistent-state regression test: PASS.
- V65.1.19 control-plane regression checks: PASS (TOTP, secret encryption, strict tenant-context check, schema/route guards).
- Full existing source `npm run test:all`: PASS after applying the release overlay.
- GoDaddy runtime, live MySQL schema migration, MFA enrollment, staging isolation, and live webhook delivery have **not** been verified in the user's account. Do not describe this release as production-certified until those staging checks pass.
