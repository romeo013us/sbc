# SBC OS — Buyer Demo and Unattended Operations Transition Plan

## Non-negotiable release gates
- Keep the V65.1.10 recovery safeguards / current recovery guard locked. Keep Kevin owner veto and financial mutation blocks enabled.
- Do not run migrations, real payment tests, live outreach, production restore, fulfillment redrive, or production unlock during validation.
- GoDaddy has 50 occupied secret slots. Do not add a 51st. Reuse an existing slot only when the credential/configuration has been explicitly reviewed.

## Gate A — Freeze and establish evidence
1. Freeze the candidate ZIP; record SHA-256 and Git commit. Clone the current database and file state into isolated staging.
2. Run `node bootstrap.js --verify`, `node persistent-state-test.js`, the V65.1.19 phase tests, and the V65.1.20 strict-tenant test. Save logs as release evidence.
3. In phpMyAdmin, run `SHOW COLUMNS FROM sbc_customers;` and `SHOW COLUMNS FROM sbc_workforce_users;`. Also run `migrations/20261011_065_tenant_isolation_preflight.sql`. Do not assume core CRM tables have tenant_id; the legacy source schema does not declare it on several core tables.
4. If staging and production cannot be proven to use different database/schema identities, stop. Do not use production as staging.

## Gate B — Tenant and webhook proof
1. Reconcile each core table's tenant column, unique keys, insert path, read path, and update/delete predicates. A zero grep count for `tenantId || 1` is necessary but not sufficient for database-wide tenant isolation.
2. Backfill legacy tenant assignments only through a reviewed, auditable staging migration. Do not fabricate rows or assign tenant IDs based only on row order.
3. Send concurrent duplicate webhook fixtures from at least two worker processes. Verify exactly one business mutation, one processed ledger row, and safe behavior for a crash between claim and completion.
4. Verify stale-claim recovery requires owner MFA and an event older than five minutes.

## Gate C — MFA and proxy proof
1. The runtime defaults `SBC_TRUST_PROXY` to one trusted proxy hop when unset. An explicit integer 0–4 may override it; never use `true`/trust-all. No extra slot is required.
2. Enroll owner TOTP in staging, verify current and invalid codes, test replay/expired codes, and confirm sensitive routes reject missing/invalid MFA.
3. Verify session cookies are Secure, HttpOnly, and SameSite as appropriate for the deployment; test logout/session revocation.

## Gate D — 15-minute staging run
- Minutes 0–3: boot, health, DB connection, schema read-only comparison.
- Minutes 3–6: tenant A vs tenant B isolation tests, missing tenant denial, owner/workforce RBAC.
- Minutes 6–9: concurrent webhook replay, status monotonicity, persistent ledger state.
- Minutes 9–12: quote/outreach/renewal draft creation with no consent, with consent, suppression, and owner approval. No messages are sent.
- Minutes 12–15: fault queue/backoff cap, staging-vs-production identity check, recovery lock, emergency handbrake, rollback to the frozen package.
- Any failed check means NO-GO. Keep production recovery locked.

## Gate E — 72-hour silent shadow and buyer proof
- Run monitoring in isolated staging or read-only production shadow with all side effects blocked. Do not send SMS/email, create payment links, charge/refund cards, or execute fulfillment.
- Record event counts, duplicate suppression, queue age, error rates, database latency, and every owner veto. Require zero cross-tenant findings and zero unauthorized mutations.
- After 72 hours, review evidence with the owner. Only then can a separate approval authorize a staged rollout. A buyer-grade unattended claim should wait for a 2–3 week run without engineer intervention, including restart/recovery and vendor outage drills.

## Revenue automation boundary
- Automatically prepare quote, renewal, and abandoned-checkout follow-up *drafts* only when the customer record, payment status, and consent are verified.
- Do not auto-send outreach, issue invoice/payment tokens, change prices, charge/refund, or submit fulfillment until tenant-scoped persistence, consent proof, idempotency, spend caps, and owner-approved policy are tested in staging.
- Revenue goal ($1,000/day) is a target, not a forecast or guaranteed outcome. Validate actual conversion, contribution margin, refund rate, and customer acquisition cost before projecting it.
