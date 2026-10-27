# SBC V66.77 — GoDaddy 50-secret capacity: read-only audit

## Scope and guardrails
This is an **audit, not a cleanup or deployment**. No application configuration is changed and no GoDaddy API calls are executed. Do not delete, overwrite, rotate, or export live credentials to make room.

The owner-provided October 27 list contains **55 distinct variable names** while GoDaddy indicates Preview **50/50** and Publish **50/50**. The discrepancy is unresolved. Collect separate *name-only* inventories for each environment; do not use a mixed list.

## Read-only steps
1. Obtain the **compiled GoDaddy runtime** archive from the validated release and extract it locally (do not run the runtime).
2. Create a local text file containing **one VARIABLE_NAME per line, without values**, for each environment. Never supply a .env file containing values.
3. Run:
   - node scripts/v6677-secret-capacity-audit.cjs --runtime=/path/to/unzipped/release --names-file=/path/to/preview-names.txt --variant=preview
   - node scripts/v6677-secret-capacity-audit.cjs --runtime=/path/to/unzipped/release --names-file=/path/to/publish-names.txt --variant=publish
4. Review the candidate list and textual references. These are **not proofs of safe deletion**; dynamic environment usage and third-party code may escape text searches.
5. Check whether the intended website-bridge integration expects SBC_WEBSITE_BRIDGE_KEY in the published environment. A missing name is a blocker for website onboarding, not a reason to disable its protection.

## Potential configuration candidates (not deletions)
- SBC_AI_TIMEOUT_MS
- SBC_TWILIO_TIMEOUT_MS
- SBC_KIM_MASTER_MODEL
- SBC_WORKER_MEMORY_MB
- SBC_SMTP_PORT
- SBC_SMTP_SECURE
- SQUARE_API_VERSION

To migrate one of these, first add an alternate validated configuration source and preserve the **exact existing value** without disclosing it to code repositories or chat. During transition, original environment values retain precedence. Prove Preview and Published behavior before removing any GoDaddy entry. Require a rollback plan.

Never retire authentication, MySQL, encryption, webhook verification, recovery/writer, or payment keys to free a slot.

## GoDaddy domain integration
- Generate a **separate PAT with only domains.domain:read**. Do not use the older four-scope write-enabled token for first connectivity.
- Once a slot is safely available, store the token server-side as GODADDY_PAT. Never store in GitHub, browser JavaScript, build assets, or logs.
- First integration: a non-billing, server-to-server domain availability GET with timeouts, no redirect to unapproved hostnames, redacted errors, and safe 401/403/429 handling.
- Keep domain registration, DNS writes, and AI autonomous purchases disabled pending separate owner-approved acceptance tests.

## Release acceptance
Three isolated test passes are **not** a production readiness score. Preserve existing Lorna/demo account isolation, tenant/writer guards, Square and Twilio flows, public website bridge, and Office Box boundaries. Complete a staging read-only API test and an owner-approved Published smoke test before declaring any 9.5+ result.

No live credential values, GoDaddy changes, or production database writes are part of this audit.
