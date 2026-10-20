# SBC Competitive Cockpit — V65.1.64 Prototype

## Intent
Stage the highest-value capabilities across CRM, workflow mapping, AI assistance, calling, payments, fulfillment, analytics, security, integrations, and executive reporting.

## Prototype
- `docs/sbc-competitive-cockpit-prototype.html` is a self-contained responsive UI prototype.
- Placeholder values are clearly marked; no live API/database connection or production mutations are present.
- Includes interactive lead-to-revenue stages and a local Markdown roadmap export.

## Proposed production implementation sequence
1. **Release/runtime verification:** confirm current source bundle identity, bootstrap patch chain, MySQL lease lifecycle, persistent state, and CI/test status.
2. **Read-only executive metrics:** bind existing authorized APIs for qualified leads, sales activity, reconciled paid orders, fulfillment exceptions, and runtime health. Never display guessed figures.
3. **Workflow visibility:** render process stages and live state from authoritative events.
4. **Sales engagement:** compare existing Twilio capabilities with JustCall in a sandbox; preserve existing AI voice architecture unless tests justify changes.
5. **Payments and fulfillment:** verify provider signatures, idempotency, tenant ownership, and required tracking evidence.
6. **AI recommendations:** scope Kevin/Kim to authorized data and cite underlying records; keep financial mutations approval-gated.
7. **Production gates:** regression tests, security review, evidence reconciliation, owner approval, and rollback plan.

## Safety constraints
- Do not bypass MySQL recovery or writer-lease safeguards.
- Do not alter production data, schema, secrets, or calling/payment behavior in this prototype.
- Do not claim deployment readiness until the real GoDaddy runtime is tested.
