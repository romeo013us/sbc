# SBC OS V65.1.20 — Strict Tenant Isolation and Governed Automation

## Included
- Strict server-derived tenant context middleware. Authenticated requests without a valid positive tenant ID fail closed; request/body tenant IDs are not accepted as authorization.
- Static replacement of tenantId/tenant_id fallbacks to tenant 1 across server-side JS in server.js, enterprise/, routes/, workers/, and config/. Missing context throws TENANT_CONTEXT_REQUIRED rather than silently choosing tenant 1.
- Durable webhook ledger uses a database-enforced unique key on (provider, provider_event_id); provider event IDs are preferred, with a stable content-hash key only when providers omit an event ID.
- Proxy trust accepts only an explicit integer hop count 0–4; startup fails if SBC_TRUST_PROXY is absent, boolean, or invalid. Reuse an existing GoDaddy environment slot—do not add a 51st—and verify the actual proxy topology before production.
- Patcher asset resolver copies the webhook patch into scripts/ and verifies SHA-256.
- Existing owner MFA, recovery lock, Kevin governance, financial mutation blocks, and owner veto remain. No payments, outbound messages, production restores, or automatic production unlocks are performed.

## Migration / rollout requirements
- The base SBC relational schema creates core CRM tables such as `sbc_customers`, `sbc_orders`, and `sbc_renewals` without tenant_id columns. The read-only preflight reports actual columns; this package does not claim database-wide multi-tenant isolation until those tables, inserts, and reads are migrated and tenant-scoped.
- The runtime no longer assigns tenant 1 to missing legacy records. Existing records with absent tenant assignment will be inaccessible until reviewed and explicitly migrated. Run the read-only preflight in `migrations/20261011_065_tenant_isolation_preflight.sql` on a database clone first. Do not backfill automatically.
- A 15-minute staging run and the prior 72-hour silent shadow are still required; this build does not establish GoDaddy/live-MySQL success.
- TOTP must be enrolled and verified before sensitive owner actions. MFA configuration reuses existing secrets; no 51st GoDaddy slot.
- Quote, abandoned-checkout, renewal and fault work remains queue-first and bounded. No unattended outbound or money movement is enabled in this hardening release.

## Verification
- Run `node bootstrap.js --verify`, `node persistent-state-test.js`, `node hotfix-assets/v65119-phases-test.js`, and `node scripts/v6520-tenant-hardening-test.js` after the runtime overlay is applied.
- Live phpMyAdmin schema verification, concurrent live webhook tests, MFA enrollment, staging isolation, GoDaddy runtime and full buyer-demo runbook remain external gates.
