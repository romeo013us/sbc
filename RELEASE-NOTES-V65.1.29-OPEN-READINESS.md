# SBC OS V65.1.29 — Open-Readiness Fixes

## Included corrections
- Prevent Agent Operating System status requests from attempting schema creation in read-only Preview or recovery-safe runtime.
- Make Growth Hardening status read-only in Preview; disable its write/run control and explain the environment boundary.
- Correct the workforce lead-create SQL shape: persist the authenticated tenant ID and `lead_intelligence_json` with matching columns/placeholders.
- Require explicit tenant association before Revenue PLAY creates a Square checkout; reject mismatched existing orders rather than inventing a tenant.
- Exclude clearly marked SBC system-test records from Lead Research prospecting views, active-sales counts, lead verification, Revenue PLAY, and follow-up selection without deleting CRM history.
- Show the actual build release identity in the Agent OS panel, explicitly label read-only Preview status, and add patched-source syntax checks to `bootstrap.js --verify`.

## Validation performed locally
- `node bootstrap.js --verify` — PASS
- `npm run test:all` — PASS
- V65.1.29 open-readiness regression — 10/10 PASS
- Patched JavaScript syntax checks — PASS

## Deployment boundary
This release has not been deployed to GoDaddy and has not been tested against the live MySQL database or live Square/Twilio/OpenAI endpoints. Do not unlock recovery safeguards, run schema-changing SQL from Preview, send outreach, or create test charges as part of deployment verification. Published runtime acceptance tests remain required.
