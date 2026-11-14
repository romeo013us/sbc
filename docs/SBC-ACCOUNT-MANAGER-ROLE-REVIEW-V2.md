# SBC Account Manager V2 — isolated employee RBAC staging gate

**Status:** source-only review, not published or certified for production. This change is additional to PR #366 and the former-manager handoff fix from PR #368.

## What is implemented

- Independent `account_manager` role (NOT a renamed `caller` or privileged `manager`).
- Deny-by-default authenticated API policy: account portfolio, account notes, handoffs assigned to that user, own clients' social drafts, training, time clock, session and logout only.
- Owner-only account assignment, social connection, provider verification, approvals and scheduling remain denied to account managers. Cross-tenant and unrelated accounts are also checked by the existing Account/Social services.
- Optional `scripts/stage-account-manager-role-v2.cjs` surgery to the **source** `server.js`: adds role provisioning, workforce classification, auth guard and private workstation redirect. This script never runs on import or boot; it refuses unrecognized source and is idempotent.
- Workstation now resolves role from `/api/me`, hides owner-only handoff assignment and social approvals from managers, and preserves Spanish/English support.
- Source-level regression tests and CI checks, plus continued Lorna/workforce tests.

## Activation gates

1. **Do not** copy the staged `server.js` over GoDaddy live. That server is pinned to a signed SHA256 release identity; use the official release packaging and preflight process.
2. Apply staging changes on the latest branch, verify full runtime integrity and authenticated browser tests including direct API requests for an inactive account manager.
3. Keep `SBC_ACCOUNT_SOCIAL_V1` disabled until the review-only schema is deployed into a backed-up staging database, the validated writer-lease callback is connected, and the existing Customer 360/CRM assignment model is reconciled.
4. Verify research-complete and verified lead field mapping, original researcher ownership, and the current account-manager assignment against authoritative MySQL. The account manager association is separate from the existing `sbc_customers.assigned_to` legacy research/caller field until migration is explicitly reviewed.
5. Confirm vault references, Meta permissions, existing Marketing Hub scheduler coordination and consent before any public posting. No automatic publishing is introduced here.
6. Complete an **actual** verified lead -> handoff -> manager account -> scheduled follow-up -> quote -> Square verified payment -> fulfillment -> servicing acceptance, with test transactions only and no false payment success claims.

All writes remain rejected by the feature's `isWriterReady=()=>false` default. Lorna's existing research workspace is not rewritten, and no lead/checkout/Office Box database migration runs automatically.

## Verify source branch

```bash
node --test scripts/account-manager-role-gate.test.cjs scripts/account-manager-ui.test.cjs
node --test scripts/account-social-core.test.cjs scripts/account-social-meta.test.cjs scripts/account-social-mysql.test.cjs scripts/account-social-routes.test.cjs scripts/account-social-integration.test.cjs scripts/lorna-account-handoff.test.cjs scripts/lorna-account-mysql.test.cjs scripts/lorna-account-routes.test.cjs scripts/stage-account-social-v1.test.cjs scripts/stage-lorna-handoff-v1.test.cjs scripts/account-manager-ui.test.cjs scripts/account-manager-role-gate.test.cjs
```

For optional source staging in a **copy of the repository** only:

```bash
node scripts/stage-account-manager-role-v2.cjs
```

Never assert a 9.5+ grade or production readiness until full staging, live authentication, database, provider and rollback evidence exists.
