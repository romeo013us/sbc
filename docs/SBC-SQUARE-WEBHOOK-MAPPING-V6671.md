# SBC Square Payment-to-CRM Mapping — V66.71

**Status:** Source-level integration guidance. Not a live Square Dashboard verification or WordPress deployment. Canonical branch: `a-sbc-master`. Preserve the GoDaddy Published rollback and existing MySQL records.

## Existing live-system boundary

1. SBC constructs a CRM customer and unpaid SBC order **before** creating a payment link. The official checkout path is `POST /api/public/checkout`, which requires an approved `CATALOG.packages[].id`, business name, customer email and normalized phone. It refuses checkout while the writer, Square provider or webhook preflight is not ready. This checkout is distinct from the original static WordPress `square.link` payment buttons.
2. SBC creates the Square PaymentLink using its unique SBC order ID in `order.reference_id` and Square's server-returned `payment_link.order_id`; these IDs are persisted in the tenant-specific SBC order and `squarePayments` record. Payment notes are descriptive, **not** proof of ownership.
3. Square sends an HTTPS POST to the **Published** `/api/webhooks/square` endpoint. SBC verifies the `x-square-hmacsha256-signature` against the **exact** publicly configured webhook URL and raw request body. Signed `event_id` is the webhook receipt's retry key.
4. On `payment.created` or `payment.updated`, a COMPLETED payment must match the stored Square order and must pass a **read-only independent Square Payments API GET**: exact payment ID, Square order ID, merchant location, status COMPLETED, amount and USD currency. Provider errors stay in the bounded retry process. Matched completed captures proceed through the existing payment proof, owner holds and fulfillment safeguards.
5. An unmatched completed payment (including one possibly paid through a **static Square link**) is retained as `RECONCILIATION_REQUIRED`; it does **not** mint a CRM customer, mark revenue as paid, or activate Office Box. Mismatched provider/amount/location entries also require review. No automatic re-charge or vendor action.
6. The receipt array/queue is bounded to 5,000 records and backed by the existing saveData flow. It should **not** be described as an immutable or infinite append-only audit ledger. Separate MySQL retention and restore verification is still required.

## Square Developer Dashboard acceptance

- Select the correct **Production** application and webhook subscription, not Sandbox.
- Use the real HTTPS **Published** application URL ending in `/api/webhooks/square` (not a Preview URL). Configure `SQUARE_WEBHOOK_URL` in GoDaddy to exactly the same URL. Do not guess when a vanity domain or ingress redirect is used; Square signs with the configured notification URL.
- Subscribe to `payment.created` and `payment.updated` with adequate `PAYMENTS_READ` permission. Other events such as `order.updated` may be received, but this implementation does not use them to settle a payment.
- Keep `SQUARE_WEBHOOK_SIGNATURE_KEY`, `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_ENVIRONMENT=production` and `SBC_PUBLIC_URL` private in encrypted GoDaddy Secrets. Never paste tokens into WordPress, GitHub files, or chat.
- Inspect Square's delivery logs and SBC's received/retry/reconciliation records. Test with Square's signed notification tooling **without** charging a customer. A webhook fixture with no existing SBC order is expected to stay unmatched, not become a paid order.
- For a controlled live sale, complete backup/restore proof, verify an exact order/customer/tenant readback, create one order-specific checkout, and reconcile a signed provider-completed payment before allowing owner-authorized vendor fulfillment.

## WordPress checkout replacement

**Do not use webhook metadata to guess a buyer after the money arrives.** A reusable Square link does not carry a trustworthy, unique SBC order ID for each purchaser.

The intended WordPress path is: package selection -> secure WordPress server-side intake -> authenticated/abuse-protected cross-service checkout request -> unique SBC customer+order -> unique Square-hosted link -> webhook -> durable matching CRM order. Implement server-to-server forwarding with an explicit security policy, anti-CSRF controls and retry discipline; do not expose Square credentials or rely on cross-origin browser requests. Keep static links available for manual sales until the new WordPress integration is independently tested, then retire them deliberately.

No code in this release edits WordPress or the GoDaddy reseller storefront. No live payment or environment mutation occurs during the automated tests.

Square references: https://developer.squareup.com/docs/payments-api/webhooks , https://developer.squareup.com/docs/webhooks/overview , https://developer.squareup.com/reference/square/checkout/create-payment-link
