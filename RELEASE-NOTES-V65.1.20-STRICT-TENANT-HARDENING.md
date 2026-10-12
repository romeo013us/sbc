# SBC OS V65.1.20 — Strict Tenant Hardening

## Delivered in this release candidate
- 110 tenant fallback expressions removed from 36 server-side JS files in the source bundle; missing/invalid tenant context now fails closed in those paths.
- Strict authenticated request context guard; request/body tenant IDs cannot override the authenticated user's tenant.
- Webhook ledger unique key is `(provider, provider_event_id)`. Provider event IDs are preferred; stable payload hash is used only when provider payloads lack an event ID. Ledger completion happens after state persistence, and stale events are completed only after their ignored state is durable.
- Existing V65.1.19 ledger column is migrated from `event_hash` to `provider_event_id` in an idempotent compatibility step.
- Patcher path resolver copies and SHA-256-verifies the webhook patch under `scripts/`.
- `SBC_TRUST_PROXY` may override the proxy hop count with an integer 0–4. If absent, the runtime uses a bounded one-hop default; invalid values fail startup. No extra environment slot is required.
- Owner TOTP, consent gates, owner veto, financial mutation blocks, and production recovery safeguards remain.

## Important scope boundary
The legacy schema does not declare `tenant_id` on several core tables (`sbc_customers`, `sbc_orders`, `sbc_renewals`). This release therefore does **not** claim database-wide multi-tenant isolation or production certification. The included SQL preflight is read-only. A reviewed, staging-only schema/data migration plus tenant-scoped CRUD query audit is still required before additional tenants can safely be provisioned.

## Verification gates
- `node bootstrap.js --verify` — passes root build and applies/test-checks the source overlay.
- `node persistent-state-test.js` — 7/7 passes.
- `node hotfix-assets/v65119-phases-test.js` — passes.
- Runtime strict-tenant tests: 3/3 pass; server-side fallback scan: 0; backend JavaScript syntax checks pass.
- Live phpMyAdmin schema inspection, concurrent MySQL webhook tests, GoDaddy startup with explicit proxy hops, MFA enrollment, isolated staging, 15-minute staging run, and 72-hour silent shadow are not verified here. Do not unlock production.
