# SBC V66 — One Master Release (October 31, 2026)

## Definitive deployment rule

The **only approved GoDaddy application candidate** is the SHA-pinned compiled GitHub branch that passes `.github/workflows/sbc-v6606-staged-release.yml`. After independent Preview acceptance, the owner may promote that exact candidate as the canonical `sbc-master` branch. Do not deploy the uncompiled source branch or the unrelated historical `main` branch.

- `sbc-master`: **one canonical, compiled, integrity-verified operational release**, containing the frontend, backend, QA route, and all migrated approved updates together. After creation, its commit SHA must be checked before GoDaddy Preview.
- `a-sbc-rollback-oct27`: protected working development-source lineage for future fixes. It is NOT directly deployable without matching staged runtime and manifest.
- `main`: older, unrelated Git history. GitHub reports **no common ancestor** with the live release line, so an unconditional Git merge is not safe. Archive only until any unique features have been independently audited and ported/tested.
- `stable/sbc-v66-working-20261030`: known-working rollback snapshot. Retain; do not rewrite.
- `release/sbc-v66-qa-<source sha>`: CI-produced ephemeral candidate, not a separate long-term product.

These labels do not create more apps: the repo contains one SBC Command Center, and GoDaddy continues to host the same existing application and database. `Office Box`, `sbcmia.com`, and `sbcwebsites.com` remain separate services linked through the Fantastic 4 interfaces, not merged destructively into a single Node process.

## Consolidated scope

The current working source contains the checkout/server economic controls (20% gross margin, Square verified payment only, owner-only $1 QA quarantine), MySQL writer/recovery guards, per-tenant protections, Lorna/demo role segregation, browser cache-repair logic, Quick Checkout, and visible owner-only $1 test entries.

**One-click entry to the test modal:** the authenticated owner sees **🧪 Run $1 Test** in the top navigation on every screen and **$1 Test Checkout** directly below Home in the sidebar. The test is deliberately not offered to customers or in the ordinary product catalog.

To run the controlled $1 test:
1. Confirm GoDaddy Published is running the exact compiled `sbc-master` SHA, with writer lease ready and recovery checks clear. Do not test on Preview.
2. Sign in as **owner**, click **🧪 Run $1 Test** (no need to find Payments Center), enter an email under your control.
3. Click **Create / find $1 QA order** once. Inspect the internal order identifier and $1 amount.
4. If new, select **Generate Square link once**, inspect the Square merchant and exactly **$1.00**, then perform **one authorized checkout** in Square. If an existing order is reused, read its existing Square link/status and **do not generate another**.
5. Click **Check payment status** and confirm both **Paid** and **QA VERIFIED - NO FULFILLMENT**. Also confirm one completed payment in Square Dashboard. If status is pending or uncertain, reconcile **the same order**, do not make a second charge or mark it Paid manually.

**No AI credit, Kim funding, domain purchase, vendor provision or commission** is needed for this owner-run QA test. The backend never automatically captures funds; the owner completes Square's authenticated hosted checkout.

## Release acceptance

- Three CI groups (staged ZIP/GoDaddy npm install, quote/browser UI regression, 4-track revenue/security audit) must pass for the exact source SHA.
- Verify SHA and integrity manifest after packaging and within GoDaddy boot logs.
- Test Chrome normal and Incognito sessions, light/dark, CRM lead/customer/order counts, Quick Checkout, topbar owner $1 shortcut, and staff/demo access in Preview.
- Publish to Live only after the owner accepts Preview, then complete the real $1 transaction in Published.
- Do not claim a 9.5/10 live production score before the end-to-end Square payment, entitlement/tenant, and fulfillment evidence is confirmed.
- No new secrets, migrations, payment charges, customer notifications or provider provisioning are introduced by this source change.
