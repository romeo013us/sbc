# SBC V66.80 — Production acceptance and release gate

**Scope:** role privacy, Demo Viewer credential lifecycle, layout stability and non-destructive production-readiness verification. This document is an acceptance plan, not evidence of live functionality.

## Baseline and rollback

- Keep the previous known-good Published GoDaddy artifact and an independently verified MySQL backup before publishing.
- Confirm the Preview build's source fingerprint matches the GitHub deployment receipt. Do not deploy a package merely because it is named V66.
- GoDaddy Preview must remain read-only; no attempts to bypass its writer/recovery safeguards.
- Never reset or replace customer, Square, Twilio, database, session, or website-bridge secrets for these tests.

## 1. Lorna's restricted role — all must pass

1. Log in as Lorna using her own employee account. `GET /api/me` should return `role=lead_researcher`.
2. Initial view is **Lead Research**. Navigation exposes Lead Research, Lead Verification, Training, Time Clock and Sign Out; no business dashboard, 90-day goals, sales totals, payroll, payments, owner approval, agent-control, Office Box or marketing management.
3. Lead list contains only permitted tenant/assignment records. Employee API bootstrap must omit owner revenue, payment, orders, audit logs and account secrets. The browser must not initiate requests to blocked owner-only endpoints; a forced request must still receive 403 from server RBAC.
4. At both 390px and 1366px, scroll and use research tools: no repeated content reinsertions, layout jumps or horizontal overflow. Test an actual edit/save only with owner-authorized real records in Published; Preview remains read-only.
5. Any 403 panel on the normal researcher screen, internal KPI displayed, private cross-tenant record or repeated UI jump is a **NO-GO**.

## 2. Demo Viewer — all must pass

1. As Owner, open **Users & Security**, find username `demo`, select **Manage Demo Viewer — Set Password**, choose a unique password (10+ characters, ideally a password-manager-generated phrase), set **Account active**, and save. Do not share or commit the password.
2. Sign out and sign in as `demo` in a fresh private browser. Owner must have explicitly enabled it first: new, missing-password, seeded-legacy or owner-disabled accounts must not become active automatically.
3. Demo must show fictional sample contacts with `.invalid` emails and `(Demo)` labels, non-billable sample quotes/orders and the **SAMPLE DATA ONLY** banner. No real CRM records, private Office Box, customer communications, financial ledger or production worker controls may appear.
4. Confirm GET demo data works and write APIs (e.g. POST quote or SMS) fail closed with HTTP 403. Do not create production transactions to test this.
5. Verify Owner can disable the demo account and that a later login/boot does not re-enable it. A missing demo login, live data exposure, or unauthorized write is a **NO-GO**.

## 3. Business workflows — all must pass

- `/readyz` in **Published** reports `ok:true`, `status:ready`, `database.reachable:true`, `recoveryRequired:false`, `writeProtection:false`, `writePrerequisitesReported:true`.
- Website PHP HMAC key and Published SBC key match, and one owner-authorized existing-account login succeeds. A login alone does not prove lead intake.
- Confirm one legitimate, consented website inquiry is entered into the CRM *once*, correct tenant and attribution, without duplicate or unauthorized creation. Avoid synthetic/test contacts in real CRM.
- Square: inspect Integration Health and the circuit-breaker state. Prepare or verify checkout with a safe non-charging preflight; do not mark an order paid without verified provider settlement. Check webhook idempotency with disposable/mock fixtures.
- Validate role-specific owner dashboard, no unauthorized 403 panels, login stability, session persistence, and a readable rollback release receipt.

## Evidence required before 9.5+ status

Pass/fail with timestamp, deployed GitHub commit and GoDaddy release identity; screenshot or HAR showing Lorna navigation/absence of owner panels; demo login and denied mutation evidence; readiness JSON; approved website lead receipt; Square preflight/settlement reconciliation. Automated CI passing is **necessary but not sufficient**: it cannot prove the live Published release, Lorna's actual browser or real provider setup.

**Release policy:** Any P0/P1 failing acceptance criterion blocks Published rollout. Keep backup, secrets and database unchanged; roll back the packaged runtime if the owner dashboard or published lead workflow regresses.
