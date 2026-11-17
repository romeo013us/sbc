# SBC Fantastic 4 — GoDaddy outage & recovery gate (2026-11-16)

**Owner incident record. NOT an instruction to perform blind restores or to enable billing.**

## Observed externally

GitHub Actions [published Fantastic 4 smoke run 43984383001](https://github.com/romeo013us/sbc/actions/runs/43984383001) (2026-11-16 ET) reported:

| Product | Verified observation | Meaning |
| --- | --- | --- |
| Command Center | Public health, readiness and API HTTP 503 | Not publicly usable |
| Office Box | Public health and API HTTP 503 | Not publicly usable |
| sbcmia.com | Public GET failed with a URL/network error | Brand site not verified |
| sbcwebsites.com | HTTP 200 response at redirect destination, brand/reseller ID not verified | Storefront functionality not confirmed |
| Reseller domain/cart | Plan-ID/redirect mismatch and HTTP 403 | New transactions must remain unverified |

This report **does not** determine whether GoDaddy deleted any MySQL database, domain, backup, order, customer account, or resource. Do **not** infer deletion from HTTP 503.

## Provider escalation — highest priority

Ask GoDaddy Reseller Support to open a documented **restore-original-reseller-account** case immediately and provide ticket/reference number. GoDaddy explicitly includes "restoring a reseller plan within 60 days of cancellation" in its **Statement of Support — Turnkey Reseller**:

- https://www.godaddy.com/help/statement-of-support-turnkey-reseller-41053
- https://www.godaddy.com/en/legal/agreements/reseller-agreement

Ask support, in this order:

1. Confirm whether the original Reseller Pro subscription was **canceled/expired**, and whether **the same reseller account/plan ID** and all associated customers, delegation, commissions and storefront settings can be restored.
2. Confirm supported transition **from restored Pro to Basic**, preserving reseller customer accounts and product ownership. Do not create a new Basic identity or attempt to move customers until the provider confirms the supported path and any irreversible effects.
3. Independently identify the **Web Hosting/cPanel** subscription and each Node.js app. Ask whether they were affected by reseller-plan termination; confirm filesystem and database persistence for both Command Center and Office Box.
4. Confirm domain ownership, DNS, SSL, email, app aliases and managed website services separately. Reseller status and cPanel status are distinct account/product questions.
5. Request written data-preservation assurances and what backups/restore points remain. Do not grant broad permanent access or give passwords to anyone through chat.

## Preservation before any change

**Never run "restore", "recover account", "reset", "redeploy", "delete", "initialize DB" or "overwrite" as the first troubleshooting step.**

- If cPanel is accessible, export/download the **current entire hosting account** (including home directory and MySQL), then a separate, dated MySQL dump, and store it off-site. Ensure the export is complete and recoverable.
- Take an inventory of domains, DNS records, app slots, app versions, environment-variable **names only** (never values), linked MySQL databases and database row counts.
- Separate original customer/customer-product state from staged QA records; **never re-seed an existing production database**.
- If comparing backups, preserve current state first, choose restore targets with GoDaddy assistance, and confirm that no later customers/orders will be overwritten.
- GoDaddy backup/export reference: https://www.godaddy.com/help/download-a-cpanel-account-using-daily-backups-41157
- GoDaddy restore caution: https://www.godaddy.com/help/restore-a-site-using-daily-backups-41162

## Known source release candidate

The latest VERIFIED **offline** stage candidate at incident observation was:
- [GitHub Actions run 43984382877](https://github.com/romeo013us/sbc/actions/runs/43984382877)
- Artifact: **SBC-V66-QUOTE-SAFETY-STAGING-CANDIDATE**
- Source commit: \`b1be6a0d26afee7d5a71a9a3d1c24ae7248e58e7\`
- Artifact SHA-256: \`ca3c28675356ca8eda13bbd707a872ba649d87190304835edc22b802eebb2d98\`
- This candidate **predates** the subsequent runtime-wiring repair in PR #408; **do not deploy it as the final Account Manager release**. The correct rebuilt ZIP must be generated from a master commit containing that fix, and must pass the updated staged-role and endpoint-mount gate.
- This GitHub artifact is **not** a verified GoDaddy backup; it cannot recover your customer's historical MySQL records by itself.

## After provider access is restored

1. Confirm domain DNS/SSL/routing point to the correct surviving applications without clobbering current customer files.
2. Confirm Command Center **published writer** (not Preview) and Office Box health/readiness, MySQL reachability, tenant isolation, recovery flags and persisted data. Do not disable guards to force green checks.
3. Rebuild and download the current-HEAD verified GoDaddy candidate ZIP only after the **Account Manager compiled runtime** role/mount release gate passes. Follow existing GoDaddy deployment procedures; verify receipt source commit, inventory, app boot logs and failure rollback.
4. Restore only missing files/data from **validated** backups with an approved reconciliation plan. No blind application reset or overwriting live MySQL.
5. Run [published public smoke test](https://github.com/romeo013us/sbc/actions/workflows) and inspect actual outputs from all Fantastic 4 products. Do not mark unverified as passing.
6. Perform live authenticated acceptance against real staff account roles, tenant/customer IDs, owner-approved research handoffs, and V7 manual outcomes. Confirm blocked staff cannot read or mutate accounts.
7. Verify Square payment webhooks, $0 owner QA, fulfillment, SMS/voice and Office Box federation **separately**, with zero unintended contacts or charges.
8. Only after successful evidence, restore customer sales and marketing actions. If any dependency fails, stop its downstream operation and keep the rest of the system safe.

## Evidence grading rule

- **CI pass:** source/packaging tests passed, not proof of a live system.
- **Public smoke pass:** unauthenticated public endpoints available; not proof of customer, order or employee permissions.
- **Live acceptance pass:** verified employee sessions + durable database updates + appropriate customer workflows.
- **9.5+ production rating:** requires all three evidence layers, rollback, and real customer/order/telephony checks.

Open live-acceptance issues: #402, #404, #407. Do not close them solely because a GoDaddy ZIP builds.
