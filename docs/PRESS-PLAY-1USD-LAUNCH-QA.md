# PRESS PLAY — controlled $1 production payment acceptance

**Status:** OWNER ACTION REQUIRED. Synthetic testing is not a real charge, and a passing Square checkout is not yet launch approval.

## Design
The compiled V66 release adds one owner-authenticated, tenant-scoped endpoint:
`POST /api/owner/launch-qa/create-order` with JSON `{"email":"<email account controlled by owner>"}`.

It requires an authoritative active Published MySQL writer and existing `auth, ownerOnly` middleware. It never creates a checkout link, captures money, sends an email, provisions a tenant, or dispatches a vendor. It creates one labeled internal-test customer and an exact $1.00 order. Repeating with the same tenant+email returns the existing order, including after a persistence-uncertain response. Do not repeat using other emails after an ambiguous payment.

**Do not use Office Box SKUs or a real catalog package** for the test. The QA product is `SBC Launch QA - $1 Test Service`, with the signed-in owner-only creation marker `OWNER_ONLY_ONE_DOLLAR_CHECKOUT`.

## Preflight (must all be true)
- Command Center release source and runtime manifest match; GoDaddy Preview boot and Published release completed under owner-approved backup/rollback controls.
- Confirm primary tenant, Published writer lease, MySQL persistence and Square production credentials are healthy using owner `GET /api/payments/square/readiness` (read-only).
- Check webhooks and `SQUARE_LOCATION_ID`; if Square configuration, webhooks, Financial Governor or owner gate blocks checkout, **do not bypass it**. Repair the configuration first.
- Use only an email you control and a payment instrument you are authorized to use. No card data in chat, logs, CRM notes, GitHub, or screenshots.
- Ensure the test product cannot dispatch any vendor, Office Box activation, marketing message or subscription. No automated refund: refunds require owner review.

## Test once (owner)
1. From your logged-in owner account, call `POST /api/owner/launch-qa/create-order` with your owned test email. Record the returned `orderId` and `customerId`. This creates an **unpaid** $1 order, not a payment.
2. Owner calls the existing `POST /api/payments/square/create-link/:orderId` route to generate a single Square-hosted payment link. If the attempt returns a hold, a timeout, or `SQUARE_PAYMENT_LINK_RECONCILIATION_REQUIRED`, **stop** and reconcile the existing order. Never auto-retry another new link.
3. Open **that exact order's** hosted Square link. Pay **$1.00 USD one time** after verifying amount and merchant. The payment action must be performed by the authorized owner; no assistant or synthetic test can submit a live card transaction.
4. Check the real Square Dashboard: one completed payment, correct USD amount, order ID, location and no refund/dispute. Keep only sanitized receipt identifiers for validation.
5. Check `GET /api/payments/square/order/:orderId` as owner. If still Pending, use existing owner-only `POST /api/payments/square/refresh/:orderId` **once** to retrieve the actual captured Square Payment; do not use Mark Paid.
6. Expect `Paid`, exactly one captured Square payment, order `QA VERIFIED - NO FULFILLMENT`, exactly one `launch_qa_payment_verified` activity, no commercial tenant, storefront, fulfillment automation, intake email, Office Box invitation or customer account grant. **No duplicate activities on repeated callbacks.**
7. Reload and restart the service only in a controlled window; recheck order and customer persisted. Compare CRM/DB and Square payment reference. Retain backup and rollback evidence.
8. Record PASS/FAIL and any provider charge/refund receipts. A failed or ambiguous test blocks go-live, and must not create a second charge.

## Release caveats
- The new endpoint is available **only in a new, source-matched compiled release after code review and merge**. Older V66 ZIPs do not include this endpoint.
- No automatic Square live charge, email, user invitation, Office Box ACTIVE entitlement or GoDaddy deployment was performed by the QA code.
- This one-dollar test validates the core receipt-to-CRM integration, **not** the separate Office Box V2 paid activation lifecycle or production readiness of every service.
