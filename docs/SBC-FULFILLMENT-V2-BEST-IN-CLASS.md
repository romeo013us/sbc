# SBC Fulfillment 2.0 — Best-in-class operating model
Date: 2026-11-09. Target: a-sbc-master. Status: architecture plus **read-only** service blueprint compiler; not deployed.

## Outcome
Customer checks out once. SBC verifies payment, breaks the purchased package into child service work, collects customer information once, runs safe automation, routes specialist/vendor work, verifies results, updates the customer, and closes the order with real delivery and margin evidence. The owner sees exceptions rather than approving routine clicks.

## Benchmarks researched
- Shopify: order-to-fulfillment separation, splitting, routing, holds and cancellations — https://shopify.dev/docs/apps/build/orders-fulfillment/order-management-apps/enterprise-oms-integration
- ShipStation: deterministic routing and automation rules — https://help.shipstation.com/hc/en-us/articles/360025870192-Automation-Basics
- ServiceTitan: optimized staffing, hard constraints, automatic and assisted assignment — https://help.servicetitan.com/docs/dispatch-pro-overview
- Printful: configurable vendor order approval with clear supplier-charging handoff — https://help.printful.com/hc/en-us/articles/50262235051153-Can-I-review-my-automatically-synced-orders-in-Printful-before-they-are-confirmed
- Temporal: durable steps, retry, recovery after worker outage — https://docs.temporal.io/workflow-execution
- Stripe: idempotent external operations — https://stripe.com/blog/idempotency

## Operating lanes
1. Office Box subscriptions: verify paid entitlement, provision access, verify login, handoff, monitor renewal. **No artwork.**
2. Domain/hosting, WordPress, Microsoft 365: intake, actual cost check, owner-approved external spending, supported provider provisioning, verify output, handoff.
3. Websites: approved brief, build, automated quality check, customer approval, launch.
4. Print: specs and shipping, proof, customer approval, actual wholesale quote, owner spend approval, vendor receipt, shipping and delivery.
5. Google Business Profile: verified/authorized intake, prepare profile, ownership verification, listing check, handoff.
6. Packages: independently tracked jobs run in parallel when possible, share customer intake, and complete the overall order only after every mandatory child service is evidenced.

**Product inclusions and quantities must come from the live catalog/price book, not hard-coded marketing names.** Unknown SKU or bundle recipe => NEEDS_CATALOG_MAPPING, not guessing.

## The only operational views needed
Owner: Needs me | Waiting on customer | Working automatically | With supplier | Delivered. Every job shows next action, owner, SLA, supplier receipt, true cost, margin, and exception. Employee: assigned tasks only. Customer: next required action and clear delivery progress. Avoid duplicate dashboards.

## Engineering path
A. Inventory active SKUs, and map each to explicit service recipe and bundle components. Commit and test the read-only blueprint compiler.
B. Use existing MySQL order/job infrastructure as authoritative; validate and reconcile overlapping JSON controllers. Add durable child-job persistence, completion evidence, idempotency and retry. Avoid external orchestration infrastructure until current runtime warrants it.
C. Integrate verified provider capabilities, only where supported. No fake vendor confirmation, guessed quote or unapproved purchase. Add shared customer intake and event-driven customer updates.
D. Run full owner $0 simulation in a separate QA execution path: real plan and workflow, fake vendor adapters, zero external spending, no live entitlement and no recognized revenue.
E. Stress-test retries, partial fulfillments, refunds, no response, failed webhooks, crashes, delayed vendor, wrong tenant, expired subscriptions and phone/desktop handoff. Roll out gradually with rollback.

## Repository findings
- enterprise/kim-fulfillment-control-v400.js can move an order lacking assets into ASSET_REQUIRED even for non-artwork products.
- workers/checkout-event-worker.js currently derives one canonical work-order record from each checkout, not explicit child services for a bundle.
- JSON-based fulfillment states and MySQL job records coexist; verify which is canonical before migration.
- enterprise/kim-fulfillment-control-v400.js submitVendor may create a synthetic vendor reference; never treat this as a confirmed supplier order.
- config/vendor-bidding-routes.json has configured, static base costs, not verified live wholesale quotes.
Existing durable claim/retry/reconciliation safeguards in server.js should be reused, not rebuilt.

## Launch metrics (targets, not claims)
- 100% active catalog recipes mapped; unknown mapping visibly held.
- 0 duplicate external purchases under retry/timeout tests.
- 100% paid orders create durable work under the 60-second target load-test SLA.
- 95%+ eligible routine steps automated without repetitive entry (after the needed integrations are implemented).
- 100% missed/blocked jobs have next owner, reason and escalation; 100% completion claims have evidence.
- 100% supplier charges backed by real approval and actual-cost record.
Track first-action time, delivery SLA, rework, exception age, cost per fulfilled order, gross contribution margin and renewal failures.

No production deployment, vendor credential verification or live-order smoke test has been performed. The former draft PR #297 is a narrow safety patch, not the vision or final implementation.
