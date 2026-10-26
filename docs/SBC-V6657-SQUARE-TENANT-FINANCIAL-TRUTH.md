# SBC Command Center V66.57 — Square Tenant Isolation and Payment Evidence

## Incident and affected routes
The compiled V66.56 Square APIs selected an order using only its ID in three authenticated endpoints:
- `POST /api/payments/square/create-link/:orderId`
- `GET /api/payments/square/order/:orderId`
- `POST /api/payments/square/refresh/:orderId`

Owner authentication alone does not prove tenant ownership. A fourth endpoint (`GET /api/payments/square/status`) exposed an all-tenant pending order count.

## V66.57 repair
1. Require an authenticated tenant ID before selecting any order. A missing tenant returns 403; a different tenant's order is indistinguishable from an unknown order (404), with **no Square provider calls**.
2. Scope the pending Square count to orders in the request tenant.
3. For Square-linked orders, require nonnegative provider-backed settlement metadata: Square order ID, payment ID, settled Square payment status, and completed timestamp. **An editable Paid label cannot trigger vendor fulfillment.**
4. Add owner-only revenue-integrity report counts `providerCapturedSquare` and `statusOnlyPaidNeedsReview`. These are local evidence indicators, *not* proof that money was deposited in Square or a bank.
5. Preserve legacy non-Square order records and statuses rather than inventing settlement metadata, overwriting them, or silently modifying customer data. They remain reportable as status-only and require separate provider reconciliation.

## Tests and safety
V66.57 synthetic two-tenant tests invoke all four compiled routes, assert no out-of-tenant payment link or provider lookup, and test a Square-linked 'Paid' order without an external receipt. This regression is mandatory in isolated reconstruction and the exact GoDaddy ZIP package test.

No production DB migration, user import, real provider call, publishing operation, Square charge, live Twilio call, or recovery override is performed by this patch.

## 95/100 three-track status
Build, SaaS and Company all remain **NOT CERTIFIED**. Actual GoDaddy authenticated Preview and Published testing, independent production backup restore, real settlement/accounting checks, customer delivery, margins, consent and retention evidence are still required. The existing V66.55 per-subsystem evidence rule stands. Office Box is deferred.

## Release
- Source PR: V66.57
- Do not update GoDaddy Published until source-matched CI succeeds and Preview acceptance has independent evidence.
