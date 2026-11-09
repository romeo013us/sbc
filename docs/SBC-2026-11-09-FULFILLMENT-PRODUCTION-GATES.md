# SBC Fulfillment Center — Production Acceptance and Benchmark
**Audit date:** November 9, 2026 · **Release target:** `a-sbc-master` · **Status:** NOT FULLY LIVE-CERTIFIED

> This is an evidence-only acceptance plan. It does not initiate Square payments, external vendor purchases, customer emails/SMS, subscription activation, or artificial test orders. Synthetic CI is not independent proof of vendor fulfillment.

## Executive finding

SBC has multiple working fulfillment building blocks, but **100% end-to-end fulfillment is not yet proven**. Do not market the center as completely autonomous. It should function as **one owner-governed orchestration desk** with transparent manual-assisted vendor rails until verified account-specific APIs exist.

**Strengths already visible in source**
- Source guards require provider-backed Square payment evidence before commercial fulfillment, with owner QA orders quarantined.
- `createFulfillmentJobsForOrder`, `processReadyFulfillmentJobs`, database-backed jobs, idempotency keys, ownership locks and stale-outcome reconciliation are present.
- Owner Print Desk `GET /api/owner/print-desk` distinguishes unpaid, artwork/proof missing, no real vendor receipt, shipped and delivered jobs without inventing supplier submissions or print margins.
- Office Box signed post-commit reconciliation requires a committed order, independently read-back Square payment, approved SKU, and exact HTTPS/HMAC target.
- Existing $0 checkout lab simulates full routing without purchasing supplier inventory.

**Open defects or proof gaps**
1. **Real provider dispatch:** `StatelessFulfillmentGateway` will not submit 4OVER4 orders without account-specific URL/key/activation; current `config/vendor-bidding-routes.json` represents planned candidate routing with hard-coded costs, not live quotes. VistaPrint remains manual-assisted. An internal `ROUTED_CANDIDATE` or `SUBMITTED` label is never a supplier acceptance receipt.
2. **State convergence:** `enterprise/kim-fulfillment-control-v400.js` stores a separate JSON projection while authoritative orders/jobs also exist in MySQL. `v400ApplyOrderStage` calls `saveData().catch(()=>{})` without surfacing failure to the operator. This must be refactored to await and verify the durable write before claiming a changed stage.
3. **Provider states:** Vendor configuration flags and legacy capability labels can suggest readiness but do not prove real end-to-end availability, production access, supplier acknowledgment, cost, or delivery.
4. **Customer completion:** A manual record of a vendor number is not automatically proof of purchase, proof approval, production, shipment, activation, or final customer delivery.
5. **Live commercial testing:** The $1 Square QA is intentionally no-fulfillment. An internal paid test cannot certify a genuine $199 business launch, a physical print shipment, recurring Office Box subscription, or a production GoDaddy purchase.

## Benchmark against established systems (official documentation, reviewed 2026-11-09)

| Platform | Verified operating pattern SBC should borrow | SBC gap |
|---|---|---|
| [Shopify](https://help.shopify.com/en/manual/fulfillment/managing-orders) | Separate payment/fulfillment/return statuses; hold, partial fulfillment, customer updates | Unify verified state and customer evidence |
| [Order Desk](https://www.orderdesk.com/integrations/) | Rules-based vendor routing with managed fallback for vendors without direct APIs | Contract-confirmed API + costed manual handoffs |
| [Gelato](https://dashboard.gelato.com/docs/webhooks/) | Explicit per-order/per-item fulfillment statuses, tracking, webhook retries | Supplier status callback and delivery proof |
| [ShipStation](https://help.shipstation.com/hc/en-us/articles/360025856252-ShipStation-Webhooks) | Shipment/tracking events; exception notifications | Signed/verifiable provider event reconciliation |
| [Printful](https://developers.printful.com/docs/) | Draft, review, pending, failed, canceled supplier order lifecycle | Fail closed on unconfirmed supplier receipt |
| [4OVER4 reseller](https://www.4over4.com/company/resellers) | Reseller pricing; API/FTP evaluated case-by-case for qualifying accounts | Do not auto-submit without written account approval |
| [GoDaddy reseller APIs](https://reseller.godaddy.com/docs?countryview=1) | Account-specific domain/SSL/shopping provisioning endpoints | Live purchaser + entitlement read-back |

## One end-to-end state machine

`ORDER_CREATED → PAYMENT_VERIFIED → CUSTOMER_INTAKE_READY → ARTWORK_AND_REQUIREMENTS_VERIFIED → OWNER_APPROVAL_IF_SPEND → PROVIDER_SELECTED → PROVIDER_ORDER_CONFIRMED → IN_PRODUCTION_OR_ACTIVE → SHIPPED_OR_SERVICE_PROVISIONED → CUSTOMER_DELIVERY_CONFIRMED → COMPLETE`

Holds: `AWAITING_PAYMENT`, `AWAITING_CUSTOMER`, `MISSING_ARTWORK`, `AWAITING_OWNER_CLEARANCE`, `VENDOR_CONTRACT_REQUIRED`, `SUBMISSION_OUTCOME_UNKNOWN`, `PROVIDER_REJECTED`, `TRACKING_MISSING`, `PAYMENT_REFUNDED_OR_DISPUTED`.

**Never infer next state from elapsed time or button clicks.** Every consequential transition requires persisted evidence tied to `tenantId, orderId, paymentId, fulfillmentJobId, providerOrderId` when applicable. Retry unknown supplier submissions only after checking provider portal/status to prevent double ordering.

## Economical vendor policy

| SBC product | Cheapest reliable mode today | Condition to automate more |
|---|---|---|
| $99 GBP / cards | Structured intake, manual Google profile ownership verification + approved print proof + supplier order | Authorized supplier purchase integration and tracking |
| $199 Starter | Square-proof → owner-controlled GoDaddy domain/site provisioning → one-page QA → approved print cards → customer handoff | Reseller account-specific provision/read-back permissions |
| $349/$599 managed packages | Owner-approved service setup, accurate entitlements and renewal billing | Credentials, provider confirmation, support/renewal evidence |
| Business cards / banners / flyers | Auto-check artwork and quantities; manual VistaPrint/4OVER4 portal with receipt and tracking | Signed supplier API/FTP agreement, tested idempotent submission |
| Office Box recurring | Subscription-specific Square rail, signed MySQL post-commit handoff, customer activation proof | Real subscription lifecycle + failure/cancel/replay production tests |
| SBC internal design/DTF | Human final proof where relevant; production steps logged | Actual completed quality-check and delivery confirmation |

**Budget:** No additional paid platform required for this orchestration plan. Rules, SQL receipts, notifications through existing channels and existing provider portals should replace unnecessary OpenAI calls. Never enable automatic supplier purchases simply because API credentials exist; owner must approve financial execution policy.

## Live acceptance matrix — ALL rows required for 100% claim

| Test | Required evidence | Current evidence |
|---|---|---|
| $0 owner test, all services | No Square charge, no vendor cost, correct owner QA classification, end-to-end simulated jobs | Synthetic tests exist; compare live Published state separately |
| One real $199 Starter | Exact Square COMPLETED + correct buyer and amount, real GoDaddy domain/site order, live website, actual cards delivered, customer portal and final costs | Not verified |
| One real print order | Signed supplier receipt or manually verified supplier portal order, artwork proof, postage, tracking, delivery | Not verified |
| One Office Box recurring activation | Real recurring subscription, signed handoff, portal entitlement, failed-payment/cancel/replay | Not verified |
| One customer-communication test | Test email and test SMS actually delivered to owner-controlled number, consent and suppression checks | Email working previously; SMS failed previously |
| Two simultaneous orders | No duplicate fulfillment, correct tenant isolation, no mixed vendor jobs | Synthetic-only tests |
| Crash after supplier submission | Mark OUTCOME_UNKNOWN, reconcile vendor order before any retry, no duplicate purchases | Code guards present, live drill unverified |
| Refund / chargeback / cancellation | Fulfillment hold, refund state, customer message, no automatic continuation | Live drill unverified |
| Persistence failure / restart | No false Completed status; exact order/job survives restart and reload | Source has swallowed save errors in V400, needs fix |
| Owner inspection | One-screen reconciliation of missing payment, unknown vendor state, overdue production and margin proof | Print Desk and dashboards exist; not independently live-certified |

**Acceptance rule:** Do not label an external order `COMPLETE` based only on a click or time; require actual customer-facing service/delivery evidence. A QA job must not purchase anything. All order history and source receipts must remain immutable/auditable. Owner must be able to override prices for testing without generating fictitious provider payments.

## Prioritized engineering repair order

1. **P0:** Make V400 stage transitions atomic with MySQL commits, eliminate swallowed `saveData` rejections, and use one authoritative paid-order/job ledger.
2. **P0:** Explicit supplier capability registry: REAL_API, MANUAL_PORTAL, INTERNAL, or UNAVAILABLE. Require direct provider proof before a job can advance to supplier-accepted or customer-delivered states.
3. **P0:** Build owner-only, idempotent manual supplier receipt capture with supplier name, actual order number, date, verified shipping/wholesale expense, and proof attachment.
4. **P1:** Connect vendor status and customer updates to the same order timeline, including exceptions, corrections, refunds and returns.
5. **P1:** Complete one consented, owner-controlled live test for each service type. Register actual fulfillment receipts in SBC and verify after restart.
6. **P2:** Activate account-specific print API/FTP only after provider approval and documented authorization. Avoid buying a third-party SaaS before real-order volume justifies it.

**Release decision today:** CONDITIONAL / NOT 100% CERTIFIED. Existing systems may support controlled owner-assisted fulfillment; do not assume automatic vendor purchasing or full unattended customer delivery. The correct next code target is P0 persistence and provider-truth hardening, not a visual redesign.
