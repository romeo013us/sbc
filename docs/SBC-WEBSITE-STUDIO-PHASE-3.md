# SBC Website Studio — Phase 3 Owner-Verified Facts and Private Concept Review

This is an **additive draft upgrade** to the existing Command Center Website Production flow. It is not a replacement for the live site generator, not an automated CRM research approver, and **not a customer-site publisher**.

## Implemented
- Website Production modal gains an owner-only **Verified Business Profile** panel for website business category, city, region, up to 12 confirmed services, and validated telephone/email.
- Account identity is read from the existing tenant-scoped saved website record; the client cannot rename or redirect the site to a different business via the Studio API.
- An authenticated owner must explicitly attest the facts and save a versioned approval before generating a new Studio preview.
- Saves preserve all existing website status, owner controls, customer/site ID, CRM, orders, SMS/email consent rules, and original website editing functionality.
- A single in-process serialization queue is now shared between the legacy draft editor and Studio profile approvals, preventing competing writes from silently overwriting each other's latest site state.
- Private preview bundles use the deterministic no-AI JSON engine, with unapproved research completely absent from the compiler input.
- Owner-only preview response includes inline local CSS/JS and a restrictive CSP sandbox: it cannot send network requests, post forms, or be search-indexed.
- Owner-only bundle endpoint returns **inspection artifacts** only; never triggers any deployment.
- Static QA checks for required bundle files, private noindex policy, responsive CSS presence, local resources, safe quote-preview-only behavior, and resolved anchor IDs.

## API contract — owner only

All paths are under `/api/website-production/sites/:id/studio` and reuse the existing Command Center auth/tenant/writer controls:

| Method | Route | Operation |
|---|---|---|
| GET | `/` | Read approved profile/version and current site identity |
| PATCH | `/approved-profile` | Explicitly approve verified facts on a writable Draft/Pending website |
| GET | `/preview` | Owner-only, sandboxed, non-indexable HTML concept |
| GET | `/bundle` | JSON copy of the five static preview files and static preflight results |

`PATCH /approved-profile` requires `{expectedVersion,ownerConfirmed:true,profile:{business:{name,category,city,region},services:[{name,description}],contact:{phone,email}}}`. The server sets the approver ID and timestamp, marks service provenance as owner-confirmed, **disallows reviews** until a later sourced-review workflow, and rejects stale edits, cross-tenant sites, wrong business identities, Approved/archived sites, unknown fields, and unavailable writer state.

## Test evidence

Locally exercised:
```sh
node --test scripts/sbc-website-blueprint.test.cjs scripts/sbc-website-studio-owner.test.cjs scripts/sbc-website-studio-static-qa.test.cjs
```

At authoring: **15 focused tests passed**. The project's existing CI regression group has been updated; GitHub workflow status should be checked again at review time.

## Not implemented; release blockers

- This owner-only panel is a **fact-approval form**, NOT a full drag-and-drop page editor or customer-facing media manager.
- Existing saved demo/site templates remain the default rendering path; the new Studio is a separate, opt-in concept preview inside that screen.
- No live SERP/Places enrichment, scraped research auto-approval, Pexels/Unsplash API, or new AI spend.
- No public inquiry/quote submission or CRM webhook. The quote widget is a private interactive **request summary** and intentionally sends nothing.
- No customer-facing publisher, DNS/SFTP upload, domain registration, hosting purchase, SSL provisioning, or real lead delivery.
- No claim of Lighthouse 95+, 9.5+, responsive pixel-perfect rendering, zero layout overflow, or passed desktop/mobile headless QA. Automated local Chromium test was **blocked by administrator** for both `file://` and `http://127.0.0.1`.
- The static QA gate is NOT a substitute for Playwright, accessibility, performance, image licensing, form spam/consent, domain/SSL, tenant-specific database persistence and rollback tests.
- No merging/deployment until CI, reviewed owner workflow, staged database/writer acceptance, actual browser testing and owner publish authorization.

## Safe next work

1. Run full GitHub CI and staging tests on this feature branch; fix any regressions before merge.
2. Add versioned visual page editing (copy, approved imagery, layout controls) with safe customer approval history.
3. Add verified, rate-limited inquiry delivery and durable CRM receipt **behind a separately approved public release gate**.
4. Implement headless desktop/mobile QA in a supported runtime and an audited rollbackable static publisher. Publish only after real hosting/domain/customer approval is recorded.
