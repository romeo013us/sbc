# SBC Fulfillment V2 — safe rollout and $25/month AI ceiling

## Spend discipline
- Default fulfillment path: **$0 OpenAI API spend**. Work planning, dependency transitions, rules and reporting use Node 22/MySQL code.
- No paid AI calls in checkout, payment capture, worker sweeps, vendor webhooks, status changes, or templated notices.
- Optional paid AI only for specialized content or complex exceptions after a verified centralized spend guard is active.
- **Owner's maximum OpenAI API budget: $25/month**, but start with deterministic, zero-AI fulfillment. Treat the cap as available capacity, not planned expenditure. Disable auto-recharge and prioritize measured sales-related uses.
- Use a dedicated OpenAI API project with Enforce a hard limit enabled, plus alerts. Enforcement and reporting may lag; the internal budget should stay below $25.
- API billing is independent from ChatGPT Plus. Image generation, voice and web-search tools need explicit approval under such a small budget.

## Revenue-first spending policy
- The owner estimates existing monthly payroll/product/operating expenses at approximately $500. Do not assume the full amount is fixed or fully inclusive without reconciling receipts.
- Owner-approved incremental ceilings: **$25/month OpenAI API and $75/month marketing**; combined ceiling $100, maximum indicative monthly operating outlay $600.
- For the first month **do not automatically spend either budget**. Prioritize converting existing verified leads via human calls and local referrals. Use existing Twilio credits before topping up.
- Recommended contingent allocations within $100: up to $10 API on measurable needs; $15 calling/communications if required; $35 in targeted local sales samples and QR demonstrations; $20 tightly bounded paid-ad experiment only after sales are closing; $20 unspent reserve. Reallocate unused amounts only after evidence, without exceeding category caps.
- Track qualified contacts, conversations, appointments, quotes, customers paid, actual contribution per deal and incremental customer acquisition cost. Advertising is paused if lead quality or contribution cannot be verified.
- No new fulfillment SaaS subscription, staff hire or AI-heavy order automation while existing systems can handle the load.

## Existing-checkout integration
1. Existing positive paid-checkout events enter workers/checkout-event-worker.js and retain the canonical MySQL order/job.
2. Recipes are sourced from the server-owned product catalog metadata field fulfillmentServices. No price-book guesses.
3. The new planner is OFF by default. It runs only when SBC_FULFILLMENT_V2_PLAN_STEPS=true AND the SKU is named in SBC_FULFILLMENT_V2_SKUS.
4. If the schema is installed, it stages child service tasks in the original paid-checkout transaction. No AI, vendor purchases, subscription activation, customer email, or external actions run from the new child ledger.
5. Missing mapping for an explicitly selected SKU is held for owner review instead of being guessed.
6. A trusted server-side caller may later complete a task with verified evidence inside its own transaction. Do not expose the completion helper directly as a public route.
7. The old fulfillment system remains authoritative until a verified execution cutover.

## Activation sequence
- Apply migrations/20261109_001_fulfillment_v2_plan_steps.sql through the existing approved migration process; verify its schema.
- Confirm active SKUs, package inclusions and quantity against the production catalog. Example for a website plus cards:
  fulfillmentServices = [{"code":"starter_website","quantity":1},{"code":"business_cards","quantity":100}]
  This is an EXAMPLE, not permission to change an unverified active SKU.
- Run the two Node 22 tests: scripts/fulfillment-v2-blueprints.test.cjs and scripts/fulfillment-v2-durable-plan.test.cjs.
- Exercise the owner $0 test path with simulated provider adapters. Never present $0 QA as real Square settlement.
- Enable the rollout flag only for exact vetted SKU identifiers after checking tenant isolation, duplicates, crashes, retries and approval behavior.

## Not yet provided
- Production migration and verified supplier contracts.
- Executing supplier API adapters, customer intake screens, protected task-completion routes, automated notices, and final QA.
- Centralized cost metering and hard enforcement for *all existing* SBC OpenAI call sites.

This is an implementation milestone, not a certification that the new fulfillment operation is live.
