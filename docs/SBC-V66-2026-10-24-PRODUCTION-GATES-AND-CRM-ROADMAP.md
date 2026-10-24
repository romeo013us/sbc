# SBC Command Center — Production Launch Verification Register
Date: 2026-10-24. Scope: official GitHub `main` plus draft PR #108. **NOT a production certification.**

## Release philosophy
Stabilize a focused CRM/revenue operating system **before** adding features. SBC must let an authenticated owner: view one authoritative lead record, update the record durably, call and document the outcome, issue a legitimate Square payment link, verify payment through a signed webhook, and execute governed fulfillment. Kim/Kevin can suggest and coordinate but cannot override the owner or bypass tenant, finance, consent, or recovery boundaries.

## Verified in automated CI
- Full frozen-baseline reconstruction through 64 post-patches, syntax verification, read-only HTTP boot.
- Real disposable MySQL 8 CRM tests and writer-lease socket turnover; no production database.
- Signed Twilio webhook verifier test: valid independent HMAC signature accepted, missing/tampered data refused, untrusted origin refused.
- Payments renderer rejects nonexistent/untrusted links; this is **not** proof that Square accepts a payment.
- Synthetic Chromium Lead Workspace and navigation geometry; this is **not** a fully authenticated production browser test.
- Historic recovery GET report from Published: 499 customers, 181 orders, 6017 activities, recoveryRequired=false. **These are not 499 qualified prospects, 181 paid orders, or a current data reconciliation.**

## Release blockers — do not claim 100% ready until closed
1. **P0** Merge and deploy signed webhook and launch-gate fixes through a backed-up rollback-capable GoDaddy change. Verify /api/owner/launch-gates in the actual Published role.
2. **P0** Authenticated CRM save/readback from live relational MySQL and refresh in a second browser session, including a denied cross-tenant access attempt against disposable fixture data (never manipulate production tenants).
3. **P0** Actual Twilio Voice TwiML App URL matches the HTTPS SBC_PUBLIC_URL/SBC_APP_URL origin and existing Auth Token/vault alias. Confirm caller ID, iPhone mic, callback authenticity, call logs. User intentionally deferred testing.
4. **P0** Square signed webhook, idempotent event receipt, payment status confirmation against a test order and fulfillment gating. No live charge performed.
5. **P0** Current independent backup and successful isolated restore/rollback rehearsal; historical record counts alone are insufficient.
6. **P0** Verify owner/rep RBAC, tenant isolation and DNC/opt-in evidence for outbound calling/SMS. No automated cold SMS without consent.
7. **P1** V6620 now tenant-scopes legacy customer duplicate lookup, owner edit, account notes, single delete and bulk delete, and blocks arbitrary-field edits. **Still unresolved:** legacy `saveData()` can silently fall back to a local file after a MySQL write error, potentially claiming a successful CRM save. Legacy quotes/orders and other routes still require their own tenant/durability audit. The v6606 transactional SQL PATCH remains the preferred lead-editor path.
8. **P1** Authenticated 21-route end-to-end desktop/mobile browser audit and links/actions coverage using nonproduction credentials.
9. **P2** Revenue reporting should separate all customer rows, qualified sales leads, sales pipeline, paid orders, recurring hosting renewals, and actual cash collected.
10. **Deferred** Office Box improvements and lead imports occur after core systems pass; customer data must not be overwritten or fabricated.

## What leading CRMs make indispensable
- Salesforce Sales Cloud: unified leads, contacts, activities, pipeline, quoting, forecasting and role-relevant sales workspace.
- HubSpot: trigger-based follow-up workflows with explicit enrollment, reenrollment, exclusions and testability.
- SBC differentiator: a verified GoDaddy reseller **and agency partner** digital-service order workflow integrated with payment, domain/hosting provisioning, print fulfillment, and governed AI. This is the strategic direction, not proof that all integrations are production-ready.

## Industry-aligned technical reference points
- OWASP ASVS 5.0, session management and cross-tenant access control: https://github.com/OWASP/ASVS
- Twilio server-side signature validation: https://www.twilio.com/docs/usage/webhooks/webhooks-security
- Twilio Voice JS Device token refresh and state: https://www.twilio.com/docs/voice/sdks/javascript/best-practices
- Square webhook HMAC verification: https://developer.squareup.com/docs/webhooks/step3validate
- Square idempotency: https://developer.squareup.com/docs/build-basics/common-api-patterns/idempotency
- HubSpot workflows: https://knowledge.hubspot.com/workflows/create-workflows
- Salesforce Sales Cloud: https://www.salesforce.com/sales/cloud/guide/

## Safety
Never bypass MYSQL_RECOVERY_REQUIRED, the exclusive writer lease, tenant isolation, consent gating, owner veto, webhook signatures, or payment proof. Do not add a 51st GoDaddy secret. Never deploy a draft PR automatically or mistake a successful GitHub build for live provider acceptance.
