# SBC V66 — controlled $1 Square launch acceptance (owner runbook)
Effective: October 30, 2026. **Not a live-payment authorization or production certification.**

## Which code is actually tested?
- Source deployment line: `a-sbc-rollback-oct27`. A source PR alone does not update GoDaddy Published.
- This PR adds `POST /api/owner/launch-qa/create-order` **only to the disposable V66 staging ZIP** by applying the tested and exact-anchor V6693 + V6694 compiler protections to the staged server.
- The older main-line PR #216/#218 feature must not be assumed to exist in Published. Record and verify the **actual installed source SHA and release identity**, not merely the GoDaddy dashboard "Healthy" status.
- The GoDaddy stage must pass source/inventory integrity, and after deployment must pass the owner-only route, MySQL writer/recovery status and Square readiness checks. Preview remains read-only.
- No additional secrets or env values are required by the QA route.

## Before spending $1 — mandatory owner checks
1. Confirm the specific new approved ZIP is actually installed in **Published** (not just staged, committed, or deployed to Preview). Check its server hash against `SBC-FLAT-RELEASE-IDENTITY.json`, presence of `SBC_V6693_OFFICE_BOX_LEGACY_PRECOMMIT_QUARANTINE` and `POST /api/owner/launch-qa/create-order`, and verified V66 source/receipt.
2. Confirm backup and rollback, persistent MySQL, only one Published writer, recovered state, tenant context and signed Square integration.
3. From the authenticated owner session use the existing `GET /api/payments/square/readiness` API and confirm Square production location, provider status and webhook readiness. Do not paste tokens, card numbers or other secrets in chat.
4. Use an email **you control**. The owner-only endpoint creates an internal QA customer, not a normal service/Office Box customer. Do not select a real SBC $199/$349/$599 package or purchase external GoDaddy/card inventory.
5. Confirm the economic governor accepts the *real, accurately accounted* QA SKU cost and 20% margin. Owner-verified **zero vendor cost** is permitted only when genuinely true and supported by the existing documented mechanism. Do not invent a vendor expense or remove the gate to force a payment.
6. Verify this test order's no-fulfillment quarantine is present and enabled before creating any payment link.

## Exactly one authorized $1 payment
1. Signed-in owner invokes `POST /api/owner/launch-qa/create-order` with JSON body `{"email":"<owner-controlled-email>"}`. The response should return one `orderId`, `customerId` and `amountCents:100` with `Pending`. This action must **not** charge a card or issue a Square link.
2. Reusing the exact same email in the same tenant must return the existing order, not create another. Record the order ID safely; if server returns `503 LAUNCH_QA_SAVE_UNCONFIRMED`, first reconcile that exact order. **Never create a second test order because of a timeout.**
3. Owner deliberately calls `POST /api/payments/square/create-link/:orderId` **once** for the same order. If any economic/owner/provider hold occurs, STOP and reconcile; no bypass.
4. Visit the matching Square-hosted checkout and verify SBC merchant, **$1.00 USD**, and the exact order. Pay once with a payment method you are authorized to use. Never supply card details to chat.
5. Verify in the actual Square Dashboard: exactly one `COMPLETED` $1 transaction, correct location, same Square order/payment IDs, no duplicate or unexpected refund.
6. Verify `GET /api/payments/square/order/:orderId` from the owner session. If still Pending despite confirmed capture, use authorized `POST /api/payments/square/refresh/:orderId` **once** (not "Mark Paid"). Compare returned IDs to the Square Dashboard; reconcile any mismatch before retrying.
7. Expected state after verified webhook/refresh: `Paid`, exactly one `launch_qa_payment_verified` activity, `QA VERIFIED - NO FULFILLMENT` hold, **zero GoDaddy purchases, VistaPrint/4over4 orders, Office Box invitations, emails, commissions, or vendor jobs**.
8. Reload the page and check that status and hold persist. Controlled application restart/readback must also preserve `Paid` and no-fulfillment. No duplicate activity or order on provider callback replay.

## Stop and investigate
- Missing owner QA route / 404 / 401 / 403 / 423 from incorrect role or unhealthy writer.
- Unexpected `MARGIN_TOO_LOW`, `ECONOMIC_COST_DATA_REQUIRED`, Square provider/amount/currency/location mismatch, no signed webhook, or duplicate link/capture.
- Paid in CRM without Square-confirmed settled transaction; Square Paid but CRM still pending after one verified refresh.
- Any fulfillment automation, email, account provisioning, commission, Office Box activation, or extra charge on the $1 QA order.
- Any customer record disappearance or changed tenant identity.

## Test report (fill after actual test)
- Deployed V66 SHA / release identity:
- Published writer & recovery verified (yes/no):
- Authorized owner route status:
- QA order ID (redacted if shared):
- Square charge $1.00 completed exactly once (yes/no):
- Signed webhook/payment evidence and CRM Paid (yes/no):
- QA no-fulfillment, no commission, no provider action (yes/no):
- Repeat read/restart persistence (yes/no):
- Result: **PASS / FAIL / BLOCKED** (do not use GitHub CI PASS as substitute).

## Boundaries
The $1 scenario proves a controlled Square-to-CRM payment path, **not** full commercial fulfillment or 9.5 certification for build/SaaS/company. Only a successful live $199 product with verified supplier costs and correct customer handoff can validate the entire commercial process. No GoDaddy production deployment, payment action, database migration, or secret change occurs from merging this document.
