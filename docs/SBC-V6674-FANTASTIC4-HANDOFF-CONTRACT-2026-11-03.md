# SBC V66.74 — Office Box V2 handoff adapter and Fantastic 4 production boundary

**Status: SOURCE CONTRACT STAGED ONLY. No live provider calls, autonomous provisioning, new customer emails, new payment or database writes.**

## Source verified on 2026-11-03

- CC source branch: `a-sbc-master`, latest pre-change release `9e2db66`. Last independently user-confirmed GoDaddy Published release: `f4f6d71` Healthy.
- Office Box source branch `main` at `7c23535`. GitHub post-merge Node 22, Chromium, MySQL8 and GoDaddy ZIP checks **all passed**; claims of current Node 22 CI failure are stale/incorrect.
- sbcmia.com is live and selling $99, $199, $349 via individual `square.link` links, as observed using public HTTP retrieval. A signed CC checkout exists in the cPanel **candidate**, but **not proven deployed**.
- sbcwebsites.com redirect reached a hosted GoDaddy `secureserver.net` reseller destination; public storefront metadata, item fulfillment, and CC order synchronization are not independently verified.
- Mailbox `info@sbcmia.com` now works from user's mail UI; Node/PaaS SMTP remains pending actual transport test.

## Exact schema mismatch

| Aspect | Existing CC legacy handler | Current Office Box |
|---|---|---|
| Path | `POST /api/integrations/sbc/handoff` | `POST /api/sbc/handoff` |
| Envelope | `sbc.big3.handoff`, nested `order`, `customer` | `eventType=customer.subscription.paid`; `correlationId`, `customerId`, `payload` |
| Signature | canonical object HMAC in `x-sbc-signature` | HMAC SHA256 exact request body, or V2 SHA256 `timestamp+'.'+rawBody` |
| Required paid payload | `order.paymentStatus=PAID` | `payload.paymentStatus=PAID`, `payload.orderId`, `payload.businessName`, `payload.ownerEmail`, `payload.plan` |
| Return | legacy CC expects top-level `activation_url` | Office Box returns `{ok:true,data:{accepted:true,activation_url:...}}` |
| Paid entitlement | Legacy may treat acceptance as provisioned | Activation creates PENDING_BILLING_SYNC, signed entitlement status remains required |

## Change in this PR

- New **pure** `enterprise/v6674-officebox-v2-handoff.cjs` matches the current Office Box V2 event, correct endpoint, HMAC `x-sbc-signature-v2`, and wrapped ACK.
- The builder refuses to emit an event until explicitly presented with a verified committed MySQL receipt, independently verified completed Square provider readback, matching customer, Square order/location/amount, and an exact Office Box SKU. No QA-dollar exception or plan-name heuristic.
- It produces a stable correlation ID, requires a 32+ character secret, and does not silently treat duplicate ACK as a recoverable activation link.
- Source CI tests cover all gates and run before the staged ZIP is accepted.
- Cross-platform fixture validation was executed independently against Office Box `sbc-handoff-auth.js` at commit `7c23535`; correct V2 signature was accepted.

## What this DOES NOT do

**No existing payment handler calls this adapter yet.** The in-production explicit Office Box purchase quarantine stays in place. This is intentional: merely swapping a route or signature in an existing pre-commit legacy handler would risk creating accounts before durable payment evidence. Do not claim this PR completes customer activation.

A separate vetted owner-governed **post-commit reconciler** must:
1. Re-read exact tenant/order/customer from authoritative MySQL, not an arbitrary browser request or an in-memory order.
2. Retrieve Square payment using authenticated provider GET and confirm amount, USD currency, merchant location, order link, completed status, and no QA hold.
3. Generate event via V6674 adapter; deliver over HTTPS only to vetted `SBC_OFFICE_BOX_URL`, signing timestamp-bound raw body; persist idempotent delivery receipt before considering invitation delivered.
4. Handle duplicate ACK by checking timestamp-signed `POST /api/sbc/activation-status`; never regenerate a different tenant on retry.
5. After customer redeems single-use activation, reconcile signed `POST /api/sbc/entitlements` using the activation tenant ID plus independently verified Square receipt. Office Box status stays PENDING_BILLING_SYNC until this succeeds.
6. Log no activation token, signing secret or customer private information in public logs; manually verify first successful live sale.

## Complete Fantastic 4 go-live gates

- CC: Published latest intended SHA, Healthy, single writer lease, MySQL count unaffected, login/demo/Lorna, real quote save, Square authorized readback and reconciliation.
- Office Box: Published intended SHA, `/api/health/readiness` HTTP 200, real MySQL, account login, tenant isolation, subscription read-only before verified grant, purchase activation round trip.
- SBCMIA: confirm actual PHP code, signed checkout 99/199/349, correct shared key, same-origin CSRF, HTTPS, matching tenant host mapping, no direct Square bypass, form delivery to `info@sbcmia.com`.
- SBC Websites: correct GoDaddy reseller account/redirect, check purchase and post-payment order number, separate from CC data until a verified webhook/API exists.
- Email: live Node SMTP email to owner and recipient acceptance, do not trust webmail alone.
- Marketing: in-app customer offers safely visible to active linked tenants; no outbound messages until consent, unsubscribe, suppression, dedupe and delivery evidence.
- Security: never remove checksums, writer lease, recovery hold, Square QA exclusion, owner veto, tenant isolation, or prove a charge by a screenshot.

A green GitHub pipeline does not certify live deployment or autonomous fulfillment.
