# SBC OS V65.1.29 — Open-Readiness Fixes

## Included corrections
- Prevent Agent Operating System status requests from attempting schema creation in read-only Preview or recovery-safe runtime.
- Make Growth Hardening status read-only in Preview; disable its write/run control and explain the environment boundary.
- Correct workforce lead-create SQL column/value alignment; persist the authenticated tenant ID and `lead_intelligence_json`.
- Scope local and MySQL duplicate checks to the authenticated tenant, and preserve tenant IDs when customers, quotes, orders, renewals and activities are loaded from MySQL.
- Require explicit tenant association before Revenue PLAY creates a Square checkout, propagate that validated tenant context into the Square request, and reject mismatched existing orders.
- Keep clearly identified SBC system-test customers in CRM history, but exclude them from Lead Research prospecting, active-lead counts, lead verification, Revenue PLAY and follow-up selection.
- Exclude system-test orders from normal revenue totals and fulfillment reconciliation, preventing the $1 diagnostic order from being treated as business revenue or fulfillment work.
- Correct the dashboard print-order metric, show the total filtered CRM lead count separately from the 250-row display cap, and deduplicate repeated identical recent-activity entries.
- Show the actual build release identity in the Agent OS panel, explicitly label read-only Preview status, and add patched-source syntax checks to `bootstrap.js --verify`.

## Validation performed locally
- `node bootstrap.js --verify` — PASS
- `npm run test:all` — PASS
- V65.1.29 open-readiness regression — 18/18 PASS
- V65.1.29 runtime writer lease regression — 9/9 PASS
- Patched JavaScript syntax checks — PASS
- GitHub Actions PR verification — PASS

## Deployment boundary
This release has not been deployed to GoDaddy and has not been tested against the live MySQL database or live Square/Twilio/OpenAI endpoints. Do not unlock recovery safeguards, run schema-changing SQL from Preview, send outreach, or create test charges as part of deployment verification. Published-runtime acceptance tests remain required.
