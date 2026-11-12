# SBC Fulfillment — Owner Acceptance Runbook (Stages 4–6)
**Created:** 2026-11-11 · **Purpose:** Test fulfillment start, service delivery, and customer notification without repeating the owner-confirmed $1 Square payment test.

## Evidence already accepted
The owner has confirmed the $1 Square QA order automatically became **Paid** in Command Center. That is evidence for basic checkout/reconciliation. This order is explicitly `QA - NO VENDOR FULFILLMENT` and must never create a real supplier purchase. **Do not convert it into a real vendor order.**

## Two complementary tests — do not conflate them
**A. Zero-dollar owner Checkout Lab** — safe, isolated simulation. Existing API and UI can create a 100%-discounted QA record, advance it to `READY_FOR_MANUAL_REVIEW`, then `COMPLETED` with explicit owner confirmation. This lab stores records in `ownerCheckoutLab`, **not** the commercial `db.orders` / `db.customers` tables, and does not call Square, vendors, or external messaging. A successful lab test **cannot certify real fulfillment or delivery**.

**B. Owner-controlled commercial fulfillment acceptance** — only on a real, properly paid, consented order with actual provider evidence, or on a specifically provisioned isolated staging order. Must check the authoritative SQL-backed order, fulfillment job, supplier/service activation evidence, and customer communication delivery. Do not fabricate paid status or provider receipts. Real supplier orders, purchases, emails or SMS require explicit owner authorization.

## A — Run the existing safe $0 Checkout Lab (owner)
1. Sign into **Published Command Center** with an owner account. Use the existing **Owner Checkout Lab / Quick Checkout** interface, not the public Square payment link.
2. Choose a service from the existing Master Price Book (e.g. **Business Cards — 100**, **Business Starter**, or **Office Box**). The lab should show the original price, a **100% owner QA discount**, and a final total of **$0**.
3. Confirm the record is clearly marked `QA` and has `NOT_APPLICABLE_ZERO_DOLLAR_QA` payment status; no actual Square payment link, vendor order, or subscription should be created.
4. Create the QA order once. Save the **QA order ID** and a screenshot of the initial state. Reload the page; it must still be visible, with no duplicate record.
5. Advance to **Ready for Manual Review**. Reload. The stage must persist.
6. Attempt to mark **Completed** without the explicit owner confirmation. It must be rejected. Then use the explicit **Mark Test Fulfillment Complete** confirmation. Reload; stage must persist as `COMPLETED`.
7. Repeat the same request once, if the interface permits: it must not create another job/order or repeat an external side effect.
8. Open **Owner Acceptance Desk**. If this QA lab record is not in the commercial order ledger, that is **expected**; do not claim it proves commercial order delivery.
9. Record the outcome and attach screenshots to [Fantastic 4 acceptance issue #277](https://github.com/romeo013us/sbc/issues/277).

**Pass A:** QA order created once, stages persist after reload, unauthorized stage skip rejected, owner completion works, zero real charges, zero vendor orders, zero customer emails/SMS, no real Office Box entitlement.

## B — Prove the actual final three stages (real or isolated staging order)
| Stage | Owner action | Required independent evidence | Fail condition |
|---|---|---|---|
| 4. Fulfillment begins | Open an already **Paid** non-QA order, inspect the fulfillment desk and SQL-backed **Owner Acceptance Desk** | Exactly one correct fulfillment job, mapped product/SKU, tenant/customer, persisted `Paid` and current stage | Missing job, duplicated job, wrong product/customer, QA order sent to supplier |
| 5. Service delivered | For **digital**, activate service with provider receipt and independent readback; for **print**, require real vendor order number, tracking and actual delivery confirmation | Provider evidence, order/job status and customer portal status agree after reload; owner-only closeout is auditable | Fake receipt, 'Delivered' based only on button click, missing vendor readback, customer cannot access service |
| 6. Customer notified | With consent and owner approval, send a **test notification only to an owner-controlled address/number**, or inspect a real consented customer's completed notification | Message event stored with order ID, recipient, provider accepted/delivered result when supported, correct content; portal reflects completed service | No event, wrong recipient, repeated message on retry, status 'sent' without provider acknowledgment |

**Critical:** If using a real paid order, do not make up a vendor purchase or customer delivery. For email/SMS, provider acceptance and actual inbox/device receipt are separate observations. SMS must obey consent and suppression policy. For Office Box, activation requires a real tenant-specific entitlement and period, not merely a QA record.

## Read-only owner acceptance endpoint
The current repository includes an owner-only, read-only `GET /api/owner/delivery/acceptance/:orderId` endpoint and an **Acceptance Desk** in the owner dashboard. For an authenticated owner, enter the **real non-QA order ID** in the desk; record `recordedWorkflowComplete`, `productionCertified`, `blockers`, and evidence. A synthetic provider receipt may make `recordedWorkflowComplete=true`, while `productionCertified=false` is still correct without independent provider/customer attestation.

## Automated tests already in the repo
Run locally or through the existing CI workflow on an isolated source checkout:
```bash
node scripts/v66129-owner-checkout-lab.test.cjs
node scripts/v66139-owner-fulfillment-completion.test.cjs
node scripts/v66144-order-delivery-acceptance.test.cjs
node scripts/v66138-fulfillment-truth.test.cjs
node scripts/fulfillment-v2-checkout-integration.test.cjs
```
These tests are synthetic. Their green result proves code contracts, **not** a live purchase, vendor shipment, subscription activation, or actual email/SMS receipt.

## Record results
- Timestamp / environment / deployed source commit:
- Owner QA order ID (lab):
- Real non-QA order ID (if any; redact customer details in shared logs):
- Stage 4: PASS / FAIL / NOT TESTED — SQL order and job evidence:
- Stage 5: PASS / FAIL / NOT TESTED — actual provider receipt, customer confirmation:
- Stage 6: PASS / FAIL / NOT TESTED — notification event and delivery evidence:
- Zero unintended charges / supplier purchases / customer messages: YES / NO
- Outstanding blocker and responsible owner:
- Decision: **LAB VERIFIED**, **MANUAL FULFILLMENT VERIFIED**, or **PRODUCTION-CERTIFIED** only if all independent proof exists.

Do not spend money, provision services, send customer communications, or alter Published configuration solely to turn a QA result green.
