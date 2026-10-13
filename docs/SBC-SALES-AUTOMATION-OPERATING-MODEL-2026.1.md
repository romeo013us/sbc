# SBC Sales & Automation Operating Model — 2026.1

## Purpose

Give every SBC sales representative one consistent, auditable workflow from first call through payment, provider provisioning, customer handoff, and follow-up. The operating rule is **capture once, fulfill once, verify every state transition**.

This document is an operating specification and training source. It does not claim that every listed automation is currently implemented or live.

## 1. Source-of-truth rules

1. The SBC Command Center is the internal system of record for customer, rep, quote, order, payment status, fulfillment tasks, evidence, and follow-up.
2. GoDaddy's reseller storefront is the order channel for products purchased directly through that storefront. Do not create a duplicate SBC checkout for the same purchase. Link or reconcile the storefront order into the Command Center if an approved integration exists; otherwise record a clearly labeled reference/manual reconciliation task.
3. An SBC custom package sold and paid through SBC is an SBC order. GoDaddy fulfillment for any included provider product is a separate fulfillment step unless a tested API integration creates it.
4. Never charge a customer twice for one purchase. A Command Center order record is not proof of payment. Only a verified payment event or provider confirmation may advance the payment state.
5. Never mark an order fulfilled based only on an API request being sent. Require provider confirmation/evidence, then QA against the sold scope.
6. Preserve tenant isolation, recovery locks, owner veto, financial governor, and all emergency gates. Never invent a tenant ID or bypass a recovery gate to make the workflow appear healthy.
7. Provider support and SBC support are different. GoDaddy handles ongoing support for GoDaddy products under the reseller program's support settings. SBC remains responsible for delivering its own promised setup work and correcting defects in that work. New edits, added features, and ongoing management are separate work unless the written package expressly includes them.

## 2. Required customer journeys

### A. Direct reseller-store purchase

1. Rep listens, qualifies the need, and guides the customer to the relevant SBC-branded reseller storefront page.
2. Customer reviews the provider product, term, renewal, and checkout details and submits the order.
3. GoDaddy processes the storefront checkout and provisions the applicable product according to its product flow.
4. Rep records the customer and links the order/reference in the Command Center only if the existing integration supports it; otherwise create a reconciliation task rather than a second checkout.
5. Confirm the order exists in the provider/reseller view before telling the customer it is complete.
6. Explain where the customer gets ongoing provider support.

### B. Custom SBC setup package

1. Rep captures business/contact details, customer requirements, selected package, inclusions, exclusions, provider products, recurring charges, and customer consent.
2. Create exactly one SBC order in the Command Center.
3. Generate the approved payment checkout for that order. Do not take payment through a second channel for the same order.
4. Wait for the verified payment webhook/state transition. A pending payment must remain pending.
5. Create fulfillment tasks from the order's explicit line items. Each task needs an owner, provider, external reference, idempotency key, status, and evidence.
6. Provision each provider product through the approved provider workflow. If no working API exists, route to a clearly labeled manual fulfillment queue; do not claim end-to-end automation.
7. Complete SBC's own setup work, run QA against the sold scope, record evidence, and hand off the customer.
8. Explain provider support, the scope of the one-time setup fee, and the price/approval process for additional SBC work.

### C. Payment failure, timeout, cancellation, or duplicate webhook

- Keep payment/fulfillment in a non-complete state.
- Make retries idempotent: the same payment or provider event must not create another order, charge, or fulfillment task.
- Show the rep a clear recovery state and next action.
- Escalate provider ambiguity or financial discrepancies to the owner/authorized manager.
- Do not manually mark paid without the approved owner-only process and auditable evidence.

## 3. Phone-call standard

1. **Open:** identify yourself and SBC; ask permission to ask a few questions.
2. **Discover:** business type, current website/presence, primary goal, required features, email/domain needs, timing, and budget.
3. **Recommend:** match the need to an approved package or individual product; explain why.
4. **Separate one-time and recurring costs:** state SBC's setup fee separately from provider subscriptions, renewal prices, and optional maintenance.
5. **Set the support boundary:** provider support covers the provider's product; SBC setup deliverables and any separately purchased SBC work are covered by SBC's written scope.
6. **Review scope:** read back inclusions, exclusions, customer obligations, and any recurring charges before checkout.
7. **Order once:** use the correct checkout path—reseller storefront for direct reseller products, Command Center for custom SBC packages.
8. **Confirm next steps:** tell the customer what happens next, what evidence/credentials they will receive, and whom to contact for each type of issue.
9. **Log the call:** outcome, needs, objection, package/product, consent, order/reference, follow-up owner/date, and unresolved questions.
10. **Never promise:** unlimited edits, guaranteed search ranking, features not in the scope, instant provisioning, or an integration that has not been tested.

## 4. Rep decision table

| Customer wants | Sales path | System of record | Next action |
|---|---|---|---|
| A standalone domain, hosting, email, or other listed reseller product | SBC reseller storefront | GoDaddy reseller order; Command Center reference if supported | Verify provider order and explain provider support |
| A bundled SBC setup package | Command Center order and approved SBC checkout | Command Center | Verify payment, create line-item fulfillment, confirm each provider deliverable |
| A website change after initial delivery | Separate SBC quote/order | Command Center | Scope, price, obtain approval, then schedule |
| Help with GoDaddy billing, renewals, login, or hosting platform | Provider support route | Provider case/reference plus SBC note if needed | Direct customer to GoDaddy support |
| A defect in the website setup SBC delivered | SBC service follow-up | Command Center task | Review original scope and correct within agreed terms |
| Unclear scope, refund, payment mismatch, tenant/access issue, or provider submission ambiguity | Do not improvise | Command Center escalation/audit trail | Pause and escalate |

## 5. Training and certification

Preserve existing Training Center courses, assignments, and completion history. Add this as a versioned sales operating module rather than replacing legacy modules.

### Module 1 — SBC offer and scope (20 minutes)
- Explain setup versus subscription and optional maintenance.
- Identify what is included and excluded in each currently approved package.
- Practice disclosing provider renewals and support boundaries.
- Pass: no inaccurate promise in three role-play scenarios.

### Module 2 — Discovery and recommendation (25 minutes)
- Ask open questions; summarize the customer's goal.
- Recommend a package/product only from the approved catalog.
- Practice an SMB website/email/domain discovery call.
- Pass: requirements and recommendation recorded accurately.

### Module 3 — Storefront versus Command Center (25 minutes)
- Choose the right order path.
- Demonstrate a direct reseller-store journey and a custom SBC package journey in a sandbox/test mode.
- Explain why an internal order record is not proof of payment.
- Pass: zero duplicate orders or duplicate charges in scenarios.

### Module 4 — Payment, fulfillment, and evidence (25 minutes)
- Read pending/paid/failed/canceled states.
- Explain webhook-confirmed payment and idempotent fulfillment.
- Record provider references, assigned owner, QA evidence, and handoff.
- Pass: resolve payment-pending and duplicate-webhook simulations without manual state fabrication.

### Module 5 — Objections and clear handoff (20 minutes)
- Handle price, ongoing support, edits, renewals, and “can you just add this?” questions.
- Set expectations without sounding dismissive.
- Pass: customer can explain who supports the provider service and what additional SBC work costs.

### Module 6 — Supervised call certification
- Listen to three calls, role-play three calls, then complete live calls under supervision.
- Owner's first ten calls establish the baseline script and common objections.
- Certify only after a manager reviews the call notes and confirms correct order-path selection and scope disclosure.

## 6. Required automation and acceptance tests

Do not describe a workflow as automated until the test passes in the target environment and the evidence is retained.

1. **Single order identity:** one order ID follows the quote/customer/payment/fulfillment lifecycle.
2. **Catalog integrity:** storefront price, Command Center catalog, payment link amount, receipt, and fulfillment scope match.
3. **No duplicate charge:** repeated click, retry, webhook replay, or browser refresh cannot create a second charge/order.
4. **Payment state:** pending/failed/canceled payments never trigger paid fulfillment.
5. **Provider adapter:** a provider submission records request ID and confirmed provider order ID; retries are idempotent.
6. **Manual fallback:** when the provider API is unavailable, a visible task is created and the customer is not told provisioning succeeded.
7. **Fulfillment checklist:** every sold line item has a completion state and evidence.
8. **Support handoff:** customer receives the right provider-support route and SBC scope summary.
9. **Auditability:** record actor, tenant, timestamp, old/new status, external reference, and reason for every sensitive transition.
10. **Tenant isolation:** a rep can only access authorized tenant/customer/order data; missing tenant context fails closed.
11. **Recovery safety:** no schema mutation, import, financial action, or background write bypasses the current recovery gate.
12. **Training gate:** sales order access is granted only after the required course and role-play certification are recorded.

## 7. Known gaps to resolve before claiming end-to-end automation

These are verification tasks, not assumptions:

- The reviewed source snapshot contains a Command Center Sales Order Builder that creates an internal order and can request a Square payment link; payment confirmation can create a fulfillment task. This does not by itself prove GoDaddy reseller order creation is integrated.
- No verified GoDaddy reseller order-creation adapter or live test evidence was found in the reviewed source snapshot. Confirm the supported reseller API/product flow and credentials before building an adapter.
- The owner confirmed that $699 is the correct top-package price. Keep the approved package prices and inclusions consistent across the storefront, Command Center catalog, payment links, receipts, and sales-training materials. Verify these values in Preview before enabling production sales; do not substitute an older price note.
- The latest provided GoDaddy logs show Preview running read-only and skipping background automation while recovery remains unresolved. This is not a production-readiness sign-off.
- Verify that provider orders, payment events, fulfillment tasks, customer notices, and Training Center completion are durable and tenant-scoped in the actual GoDaddy Preview before any Live release.

## 8. Release gate

The sales workflow is ready for wider use only when all acceptance tests pass in Preview, existing customer/training data is preserved, a test order can be traced end-to-end without a duplicate charge, and the owner explicitly approves the release. Keep Live publishing, customer imports, and production financial mutations blocked until then.


## 9. Price consistency audit

A read-only audit of the bundled `SBC-OS-V65.1.13-ROOT-FIXED-LOCKFILE-BLOCKED.zip` found stale $599 top-package mappings in the public PHP storefront, server revenue-proof status, sales offer/closer modules, lead-to-offer mapping, commercial-readiness/economic-control catalogs, 90-day revenue-command SKU lookup and planning default, training curriculum, and release manifest. The storefront also linked its $599 button to an existing Square URL whose current amount could not be verified. The correction patch replaces that link with a call-to-SBC action until a verified $699 checkout link is configured. The reviewed source snapshot also used the legacy `SBC-599-COMPLETE` SKU.

A correction patch and a pricing-consistency regression test were generated from that V65.1.13 snapshot. Local verification passed the pricing regression test, JavaScript syntax checks for changed files, and the commercial OS test. The patch is not a live deployment and has not been proven against the newer V65.1.33 Preview source. Do not deploy the older V65.1.13 bundle over V65.1.33; reconcile the correction against the current source, run the full CI suite, then verify storefront, Command Center catalog, checkout amount, receipt, and training in Preview.

The separate $699 top-package price is the approved owner value. Any other $599 value must be classified by its actual product/billing meaning before changing it; numeric IDs, timestamps, and unrelated estimates are not package prices.
