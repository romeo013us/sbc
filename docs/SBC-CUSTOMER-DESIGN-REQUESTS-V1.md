# SBC Customer Design Requests — V1 release checklist

## Purpose
An interested customer receives a secure questionnaire tailored to a website or business-card design. This is a **design request, not an order**.

* Account 360 or Call Center: owner or assigned manager generates Website or Cards link.
* Link: 256-bit random bearer capability, SHA-256 hash stored in MySQL (not the raw link), 14-day expiry, single accepted submission.
* Owner explicitly copies or sends the link by SBC email/SMS. No automatic outbound contact on creation.
* Customer fills three mobile-friendly steps for business information, palette/style/reference links, and website or print requirements.
* Submitted answers appear in Account 360; authorized staff can review them or request a new brief.
* No payments, vendor orders, domain purchases, site publication, or contact automation are triggered.

## Safe deployment

1. Back up the authoritative MySQL writer and verify restore access.
2. Manually apply migrations/20261119_001_sbc_customer_design_briefs.sql on the **authorized writer**, never Preview/startup.
3. Build the pinned V66 GoDaddy artifact using the existing pipeline, not individual file uploads. Preserve release identity, manifest, and SHA verification.
4. Verify routes/crm.js registers the customer design route before any terminal SPA catch-all. Verify an unauthenticated GET at /request/<token> renders the real form without a login redirect.
5. Verify static public assets are included in packaged inventory and source mirrored in browser_public/.
6. Verify the Call Center, Account 360, account assignments, and calendar regression tests still pass.

## Security checks

* Tenant-safe staff endpoints must reject another tenant, another assigned manager, inactive staff, and unauthenticated users.
* Public token must not reveal CRM account details beyond a brief business label and form type, and must never authorize account management.
* The form uses no-store/noindex/no-referrer and a CSP; request posting enforces JSON limits, a honeypot, rate limits, expiry, and atomic one-time update.
* Reference URLs are stored as customer-provided text; no server fetch is performed.
* Read-only/DB recovery blocks write actions.
* Staff confirms permission before explicitly sending any customer message.
* Never collect credentials, card details, or passwords in these fields.

## Smoke test

1. Use an internal synthetic account and create both Website and Cards links.
2. Open each link in an unauthenticated private browser, including narrow mobile viewport.
3. Complete and submit; verify the confirmation states no order or charge.
4. Attempt a second submission; it must be rejected.
5. Refresh Customer 360: verify the correct account, selected style/colors, text, page requirements, quantity and finish are visible and clearly labeled unverified customer preferences.
6. Mark a brief Reviewed. Revoke a different unused link and verify it cannot be used.
7. Confirm different tenants and unassigned managers get no access.
8. Verify no unsolicited email, text, payment or publishing action occurred.
9. Confirm migration applied on writer and new public route truly serves from the GoDaddy published artifact.

## V1 limits
Native photo/logo uploads are **not yet implemented**. Customer can paste HTTPS links to reference images/logos. Uploads require safe storage, file validation, malware and retention controls. The customer form currently supports English only. Two-way notifications and translation can follow after staging acceptance.
