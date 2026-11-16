# SBC Prospect Intelligence V2 — offline launch plan

**Purpose:** Prepare SBC's owner research and workforce handoff while GoDaddy is unavailable. Code is tested in GitHub without customer calls, Square, Twilio, or a live GoDaddy instance.

## What is executable in the release

- **Owner:** Growth → Market Intelligence → Prospect Intelligence. Run public PageSpeed measurements (Google online access required only when later deployed), review findings, generate lead research score / competitor-site comparison / draft email / TXT strategy report, and explicitly check Owner review to export a JSON research handoff.
- **Lorna:** Lead Research Workspace → Research Intelligence → import JSON → type business name → review research checklist. Confirm CRM assignment separately.
- **Sales Caller:** Sales Caller Workspace → Research Intelligence → import → match business name → review call-prep script and consent reminder. Nothing dials or texts.
- **Account Manager:** Account Management OS → Research Intelligence → import → match business name → review expansion / scope checklist.
- **Owner Research Library:** Save and reopen approved public research through the existing owner-only, tenant-scoped Command Center writer. This does not write CRM customer records or grant staff new server permissions. Actual restart persistence must be confirmed on Published GoDaddy.
- **No live validation:** Staff files import/export locally in signed-in browser sessions. No new staff account permissions or CRM customer mutations.
- **No recurring platform bill:** Workforce briefs and JSON handoff are deterministic native SBC code. PageSpeed Insights requests may be throttled once GoDaddy is restored.
- **Evidence semantics:** Owner-marked is not cryptographically signed. Worker must confirm provenance and assignment with owner. Lighthouse is a synthetic site measurement, not conversion or ranking evidence.

## Restrictions

1. The owner manually shares approved public research through an existing approved company channel. Files intentionally contain no personal contact information, customer IDs, payments, keys, CRM notes or assignments.
2. Handoffs older than 30 days and website observations measured more than 30 days ago are rejected or marked unavailable.
3. Employee access remains subject to existing sign-in and role checks. The file does not authorize contact or create assigned CRM rights.
4. A lead score represents research priority, not buying probability. Unmeasured findings are unverified.
5. No auto-email, auto-call, enrichment API charge, vendor order, subscription billing, or live deployment occurs.

## Repeatable offline validation (Node 22)

- node --test test/sbc-prospect-intelligence.test.cjs test/sbc-prospect-workforce-v2.test.cjs
- node scripts/sbc-prospect-handoff-v2-rehearsal.cjs
- node scripts/v66-static-mirror-gate.cjs

GitHub Actions workflow: .github/workflows/sbc-prospect-workforce-v2-offline.yml. Existing full GoDaddy ZIP CI runs all release gates and provides a staging candidate.

## When GoDaddy is restored

Do not deploy until backups exist. Then:

1. Preview full verified candidate with a non-customer fixture. Confirm owner access and rate limits.
2. In Published owner workspace, measure one consent-free public website and confirm score values against the provider.
3. Save one owner-reviewed packet into Research Library, refresh/restart the application and confirm the same record remains accessible. Check cross-tenant access is blocked.
4. Export the owner-marked research JSON and import it in each role workspace using authorized test accounts. Verify wrong roles, stale packets and mismatched business names fail closed.
5. Verify tenant isolation, caching, logout clearing, mobile contrast, and no automatic calling, emailing, orders, payments or CRM database writes.
6. Confirm Published release identity, resolve any 503 errors and record a deployment receipt.

## Separately authorized follow-on upgrades

- Assignment-aware, tenant-scoped server-side research persistence and owner approval workflow after schema/migration tests.
- Licensed Google Business Profile data and verified competitor discovery. Never claim GBP data exists when it does not.
- Account expansion grounded in paid orders and current subscriptions, not inferred purchases.
- Staff-scoped research inside CRM accounts after authorization and safe migration.

This release does not alter CRM accounting, employee access, outreach suppression, Website Studio, Square payments, or Office Box.
