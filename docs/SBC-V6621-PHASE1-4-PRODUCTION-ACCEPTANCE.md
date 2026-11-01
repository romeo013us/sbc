# SBC Phase 1–4 Production Acceptance — V66.21

**Official repository and release branch:** `romeo013us/sbc` → `a-sbc-master`. GoDaddy app: `tyvrqnjz57`.

**Operating rule:** Verify before promotion, preserve MySQL/tenant/financial safeguards, and never treat a simulated dry run, readiness GET or an existing `Paid` label as a verified Square capture. The application is **NOT certified 9.5 or production healthy** merely because CI succeeded. Keep the last healthy Published rollback until the new Preview passes.

## Phase 1 — Production stability

**Automated controls:** `scripts/v6621-launch-acceptance.test.cjs` proves the owner-only Launch Check sends exactly five bounded, authenticated GET requests and cannot create a charge, CRM write, notification, external handoff or recovery unlock. The verified GoDaddy staging release checks inventory, fresh receipt, server hash, tamper rejection, and install/build reproducibility.

**Operator test:**
- Update GoDaddy Preview to the exact compiled HEAD SHA shown by GitHub Actions. See `SBC-FLAT-RELEASE-IDENTITY.json` for the source hash, and confirm `receipt=VERIFIED`, the runtime reaches Healthy and no restart loop occurs.
- Open Preview in a regular browser and Incognito; verify readable light/dark UI, navigation and no flashing. Record the Git SHA and browser outcomes.
- Sign in as owner. Click **✅ Launch Check** in the header. Preview is read-only by design; do **not** require write eligibility there.
- Inspect `/api/owner/recovery/status` and `/api/owner/launch-gates` in Published after promotion. Check historical MySQL counts without changing data. **Never reset, re-import or delete records to make the count look correct**.
- Confirm backups exist, that a restore drill can recover the required data, and that rollback works without data loss before declaring operational readiness.
- Only after Preview acceptance, publish exact compiled commit and repeat owner checks in Published. Do NOT perform Square checkout while Published is unhealthy.

**Sign-off:** owner records SHA, timestamp, Preview/Published health, CRM count before/after, browser results, backup evidence and a signed no-data-loss declaration. Current state: **NOT YET SIGNED OFF**.

## Phase 2 — Staff and demonstration accounts

- The **✅ Launch Check** GETs the existing owner-only `/api/users` route and reports presence of active researcher and demo role accounts, *not* whether passwords, sessions or screens actually work.
- Owner separately signs in as Lorna's researcher test account, verifies allowed research workflows and confirms that payment, employee payroll, owner telemetry and other tenant/customer records are inaccessible. Do not distribute or reset real credentials in a chat.
- Owner signs in to demo, verifies it cannot create charges or mutate live customer data. Verify the demo does not reveal secrets or customer financial data.
- Test logout and stale-browser session refusal. Owner-only $1 test and Launch Check must never appear for demo/researcher.
- Preserve role restrictions; no owner impersonation, emergency unlock or automatic test-account creation.

**Sign-off:** two independent authorized sessions, role boundary outcomes, timestamps. Current state: **PENDING LIVE ROLE LOGIN**.

## Phase 3 — Fantastic 4

- The existing `/api/fantastic4/summary` GET reports WordPress/hosting/ephemeral-vault/edge-cache *configuration flags*, not live cross-service availability or a proven integration.
- Confirm `sbcmia.com` sends an authorized customer intake/lead only to the correct tenant and the record appears exactly once in Command Center. Reject unsigned/unknown-origin bridge payloads.
- Confirm Office Box demo, account creation and tenant separation. Real Office Box fulfillment/invitations remain quarantined until Square capture, relational persistence, provider reconciliation and owner approval; do not bypass this gate.
- Check GoDaddy reseller `sbcwebsites.com` domain, SSL and customer redirect journey. Do not claim GoDaddy reseller capabilities that the hosted storefront does not expose.
- Explicitly record which integrations are real, manual handoffs, configured-but-unverified or unavailable. Never automatically issue domain purchases or external provisions on a test order.

**Sign-off:** four service URLs, tenant-bound journey, one controlled handoff with identity and duplicate proof, rollback/ownership review. Current state: **PENDING LIVE END-TO-END**.

## Phase 4 — Revenue / sales opening

- The existing `/api/owner/lead-readiness` GET returns tenant-scoped verified human-call and research queues. A verified telephone number does **not** imply consent to autodial or text. Sales operators use human review and appropriate compliance controls.
- Review package prices, actual wholesale/shipping costs and the **20% minimum margin** before sending a quote; no fabricated prices/costs and no manual `Paid` flag.
- Execute **one** owner-controlled Square $1 QA order in Published *only after Phase 1* using **🧪 Run $1 Test**. Reuse a pre-existing test order and inspect its provider status rather than creating a duplicate. Pay at most once. Verify Square merchant, $1 amount, payment completed, signed webhook reconciliation, and `QA VERIFIED - NO FULFILLMENT`. Kim AI credits are unnecessary.
- Work a small human-reviewed prospect batch: research → verify → contact only through compliant channels → document conversation → send quote → collect Square payment → authorized fulfillment → customer approval → renewal support. Distinguish real collected revenue from quote values and demo/test orders.
- Track weekly **verified calls/contact attempts, qualified conversations, quotes sent, paid conversions, actual collected gross revenue, fulfillment quality and renewals**. A $1 QA charge is NOT a customer conversion and should not inflate sales success.

**Sign-off:** Square receipt + CRM status match, one real customer fulfillment and post-sale support evidence, owner approval to expand outreach. Current state: **PENDING SQUARE & FIRST CUSTOMER ACCEPTANCE**.

## What Launch Check means

The owner-only button calls existing authenticated GET endpoints `/api/owner/launch-gates`, `/api/users`, `/api/fantastic4/summary`, `/api/owner/lead-readiness?limit=0` and `/api/payments/square/readiness`. It does **not** create proof of staff login, cross-product API delivery, Square capture, consent, background automation, or customer fulfillment. If any read fails, the operator sees **Not confirmed**, never **Passed**. It runs only when explicitly opened; no polling.

**9.5 scoring rule:** keep provisional build / SaaS / company assessments separately and do not raise to 9.5 until phase-specific acceptance evidence has actually been recorded. A green GitHub build is necessary but insufficient.
