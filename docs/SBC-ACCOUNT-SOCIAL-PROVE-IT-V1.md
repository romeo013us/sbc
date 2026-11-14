# SBC Account Manager OS + Lorna Handoff + Multi-Client Social Studio

**Implementation state: tested, source-only, review branch. NOT production activated.**

This delivery extends, rather than replaces, the authoritative SBC CRM, Lorna Research Workstation, Caller Workstation, existing owner Marketing Hub, checkout, Office Box, fulfillment, GoDaddy writer lease, or session architecture.

## Delivered source

- `enterprise/sbc-account-social-core.cjs` — manager-assigned portfolio, customer timeline, owner-only assignment, strict tenant access, channel-scoped social content, approval/scheduling state machine and no-blind-retry publishing logic.
- `enterprise/sbc-account-social-mysql.cjs` — additive tenant-scoped MySQL adapter, conditional due-post claiming; no DDL on import.
- `enterprise/sbc-account-social-meta.cjs` — Meta Facebook/Instagram account verification and publish adapter with per-customer vaulted token references. No real Meta credentials included.
- `enterprise/sbc-lorna-handoff-v1.cjs` — Lorna submission of *already verified existing CRM leads*, owner-only assignment to an account manager, precise bad-number feedback, 15-day hold, escalations to avoid research loops, and auditable status transitions.
- `enterprise/sbc-lorna-handoff-mysql-v1.cjs` — transactional manager handoff + account ownership update; researcher feedback transitions commit or roll back together. The existing `sbc_customers` table remains read-only.
- `routes/sbc-account-social-v1.cjs` and `routes/sbc-lorna-handoff-v1.cjs` — authenticated tenant-scoped APIs, no public publisher endpoint. Mutation endpoints refuse writers without explicit lease verification.
- `routes/sbc-account-social-integration-v1.cjs` — optional injection into the existing session/auth and customer repository, explicitly gated. Adds no global RBAC permissions.
- `scripts/stage-account-social-v1.cjs` — optional, fail-closed route mount patch to `routes/crm.js`. After review, run on the non-deployed source branch only. Nothing enables it automatically.
- `scripts/stage-lorna-handoff-v1.cjs` — optional, mirrored insertion of the Lorna sidebar handoff panel into existing `public/lead-research.html` and `browser_public/lead-research.html`. Refuses mismatched asset trees.
- `public/sbc-account-manager-v1.html`, `.css`, `.js` — responsive EN/ES account manager workstation with portfolio, timeline, handoff queue and multi-client Facebook/Instagram content studio. Real API-backed, no invented sample data.
- `public/sbc-lorna-handoff-v1.js`, `.css` — optional added research/handoff panel; does not replace or alter existing research forms, CSV import, training, goals or time clock.
- `browser_public/` — matching copies of the new browser assets.
- `sql/sbc-account-social-foundation-v1.sql` and `sql/sbc-lorna-account-handoff-v1.sql` — **manual** additive schema migrations. Neither runs during boot.
- `.github/workflows/sbc-account-social-v1.yml` and `scripts/*.test.cjs` — focused regression gates. No tests contact real Facebook, Instagram, customers, payment providers or production state.

## What is protected

1. **One CRM**: Existing `sbc_customers` stays authoritative. Research handoff refers to its IDs, and never copies or overwrites lead/contact records.
2. **Employee roles**: Lorna remains `lead_researcher`; new `account_manager` must receive a *new least-privilege* RBAC policy only after an authenticated login/route audit. Do not automatically grant her account manager, payments, marketing credentials, billing or other tenant access.
3. **Tenant safety**: All DB selectors use `tenant_id`; actors come from server-side session + tenant context, not client body or headers. Deactivated users are refused by service even when they were previously assigned.
4. **No duplicate outreach**: `BAD_NUMBER` creates a 15-day minimum retry deferral and an actionable return task. Research that finds no verified alternative escalates to the owner; it does not bounce endlessly.
5. **No blind posting**: Every social post must be approved by the owner, associated with a verified client channel, and claimed by a single writer. Unknown Meta outcomes become `NEEDS_RECONCILIATION` rather than automatically retrying. Instagram requires a public HTTPS image URL.
6. **No pricing or revenue changes**: No changes to existing Square checkout, catalog, fulfillment, Office Box billing or accounting. Marketing revenue is not invented or inferred from draft posts.
7. **Fail-closed**: `SBC_ACCOUNT_SOCIAL_V1` defaults OFF. Even when ON, the supplied integration has `isWriterReady=()=>false`, `publishingEnabled=false`, and no scheduler; so it cannot mutate data or post to social accounts without later explicitly audited wiring.

## Required before genuine production readiness

- Compare the patch against the latest authoritative Command Center `a-sbc-master` and ensure it is included in the official deployment build pipeline and integrity manifest. **Do not paste into a compiled production ZIP outside release verification**.
- Run all existing SBC historical regression and tenant/workforce tests in GitHub CI. Validate in the appropriate GoDaddy Preview (read-only) and separate staging writer with a MySQL backup. No customer records, marketing campaigns, or payment data are to be overwritten.
- Apply the additive schemas **first in staging** after a verified backup. Existing tables must remain untouched. Verify the database user supports transactions and the same tenant-scoped schema exists in staging.
- Confirm original Lorna CRM lead fields are mapped correctly. `lead_intelligence_json` must contain verified status evidence. If absent, the handoff safely rejects it; mapping research verification into this new feature requires further schema validation, not guessing.
- Implement and test the least-privilege `account_manager` staff login/allowlist and explicit Lorna permissions for the new `/research` endpoints. Old `caller` privileges should NOT be widened to simulate account manager access.
- Explicitly supply the verified writer-lease callback, tenant- and customer-scoped vault-secret callback, and a *single* approved production scheduler. The new Social Studio must not create a second uncoordinated publisher alongside the existing Marketing Hub.
- Connect valid Meta App permissions and customer-authorized Facebook Page / Instagram professional account assets; run sandbox publish and reconciliation drills. The system never stores or ships tokens to the browser.
- Test the new UI in authenticated employee browser sessions including mobile, Spanish, refresh, missing data, logout, expired sessions and forbidden cross-tenant access.
- Owner-only pilot, then one consenting client. Confirm end-to-end research → handoff → account manager → customer service and owner-approved social publishing before any graded 9.5+ claim.

## Verification command (source-only)

```sh
node --test \
 scripts/account-social-core.test.cjs \
 scripts/account-social-meta.test.cjs \
 scripts/account-social-mysql.test.cjs \
 scripts/account-social-routes.test.cjs \
 scripts/account-social-integration.test.cjs \
 scripts/lorna-account-handoff.test.cjs \
 scripts/lorna-account-mysql.test.cjs \
 scripts/lorna-account-routes.test.cjs \
 scripts/stage-account-social-v1.test.cjs \
 scripts/stage-lorna-handoff-v1.test.cjs \
 scripts/account-manager-ui.test.cjs
```

**Test passing != live app working**. Production deployments, integrations, permissions, credentials and actual provider calls remain off until verified.
