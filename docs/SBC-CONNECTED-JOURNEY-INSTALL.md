# SBC · One connected customer journey

**Release:** Command Center V66, runtime patch 66.0.26 + SBCMIA V4.5.0. Prepared November 20, 2026, Eastern time.

**Status: built and locally tested preview candidate. No production deployment, real customer messaging, live payment, or production database changes were performed.**

## Files and destinations

| File | Destination |
|---|---|
| SBC_COMMAND_CENTER_V66_CONNECTED_JOURNEY_FULL_PREVIEW_2026-11-20.zip | Complete GoDaddy Node.js Command Center project root |
| SBCMIA_V4_5_CONNECTED_JOURNEY_CPANEL_2026-11-20.zip | Complete public PHP website runtime, in the SBCMIA cPanel site root |
| SBCMIA_V4_5_FULL_SOURCE_2026-11-20.zip | Owner source archive with tests and documentation; keep outside the public website |

The combined release kit contains these three full archives, this guide, and the validation record. The Command Center archive contains the full supplied application plus the connected workflow. It excludes dependencies, live data, uploads, and secrets. Keep the Node.js project and the public PHP website in their respective hosting applications.

## What is connected

1. A service visitor chooses a call request, quote, or appropriate purchase path. The signed inquiry carries the selected service, package, intent, requested window, timezone, and source into Account 360.
2. Exact contact matching preserves existing CRM contact details and assignments. Conflicting contact matches remain separate for staff verification. A retry uses the same opaque receipt and does not create another inquiry or task.
3. An active assigned Account Manager receives the next task. An inactive or absent assignment routes the task to an active tenant owner. Contact restrictions remain in place.
4. Published $99, $199 and $499 purchases use correlated checkout. The server verifies the fixed published price and existing Square/economic readiness before generating a checkout link. Opening checkout never marks an order paid.
5. Existing authenticated Square capture processing creates one service delivery plan. Requirements, preparation, quality checks, customer proof approval, owner release, and delivery follow in order. Vendor job creation and submission enforce the new approval gate for connected orders.
6. Staff can prepare a private customer activation link after verifying the contact. Its token is stored only as a hash, expires after 72 hours, is consumed once, and cannot reset an already active account. The customer sets a password and signs in through the existing portal.
7. Customers see their own public progress, proof, approval actions, deliverables, and appointments. A time-change request stays **Awaiting confirmation** until staff reschedules the calendar entry. Original booked times remain intact meanwhile.
8. An appointment outbox supports confirmations, 24-hour and 1-hour reminders. It checks explicit channel permission tied to the current contact address/number, suppression, confirmed meeting links, 8 AM–8 PM Eastern sending hours, duplicate keys, and a durable claim before dispatch. Provider acceptance and confirmed delivery have distinct statuses. Uncertain attempts are held for reconciliation.
9. Delivered orders generate an internal handoff follow-up task. Existing renewals and customer workspaces remain under their existing service workflows.

## Daily use

Open **Customer Journey** beside **Revenue Today**, from Account 360, or from the Account Manager workstation. Select an account to review inquiries and appointments, continue paid-order steps, and prepare customer access.

Verify an inquiry's contact before marking it reviewed. Use the existing Account 360 booking editor to agree and book the real appointment. A private website concept is prepared before the presentation; the existing approved calling script is preserved.

For a paid website: confirm requirements → build → save the customer proof URL → finish QA → customer approves in their portal → owner approves release → deliver the final URL. A revised proof invalidates its prior QA and approval. Automated website publication and vendor purchases are not triggered by these buttons.

## Install and accept in isolated staging first

1. Back up the existing Node.js code, database, uploads, and hosting configuration, and the public website. Retain the current working release for rollback.
2. Use a **separate authenticated staging Node application and separate test MySQL database**. Preserve the normal writer-lease and recovery controls. The current protected, read-only GoDaddy Preview cannot prove successful booking or intake writes; do not bypass its policy.
3. Upload the complete Node archive at that app's project root. Let GoDaddy install the pinned dependencies. Its start command remains `node sbc-godaddy-flat-entrypoint.cjs`.
4. Verify the extracted app with `SBC_RELEASE_PREFLIGHT_ONLY=1 node sbc-godaddy-flat-entrypoint.cjs`. This checks package identity and inventory without opening customer state.
5. Put the clean cPanel runtime in a protected HTTPS staging site. Use a staging subdomain of sbcmia.com and set `SBC_WEBSITE_PUBLIC_ORIGIN` to that exact HTTPS origin in both staging applications. Keep the staging site excluded from indexing at the hosting layer. Set the PHP server's `SBC_COMMAND_CENTER_ORIGIN` to the exact isolated GoDaddy staging app origin; the code accepts only HTTPS GoDaddy airoapp.ai application hosts. Do not point staging at the live writer.
6. Configure a separate matching `SBC_WEBSITE_BRIDGE_KEY` for the staging PHP site and Node app, and the existing tenant host mapping. The logical signed website host remains sbcmia.com. Keep private keys outside public_html. Configure an independent strong `SBC_PORTAL_SECRET` in Node. Reuse the existing private key-file mechanism where required by cPanel.
7. Use controlled synthetic contacts and a sandbox payment provider account. Confirm the new `website-custom` $499 SKU has the owner-verified product cost mapping required by the existing financial governor. An unavailable cost or Square setup blocks checkout; no cost guard was weakened.
8. Leave `SBC_APPOINTMENT_MESSAGES_ENABLED` absent or `false`. Test calendar, customer activation, permissions, approvals, and delivery first. Message-provider and carrier delivery need separate controlled testing before this switch is enabled.
9. Promote through the existing GoDaddy writer release process only after the acceptance scenarios below pass with the actual staging database. Restore normal production origins and retain production secrets when promoting the PHP site.

## Required hosted acceptance scenarios

- Assigned AM creates and reschedules an appointment without a prebuilt website; another AM and another tenant cannot access it. Conflicting slots are rejected. Read-only/recovery/writer-lease failure blocks writes.
- A signed inquiry reaches MySQL, survives restart, retains service/source context, and appears once after an identical retry. A forged website request is denied. An inactive AM routes review to the owner.
- A controlled buyer sees the published price and exact scope, receives one pending order and one checkout link, and becomes paid only after verified Square capture/readback. Declines, unmatched events, refunds and disputes do not authorize delivery.
- A verified customer receives an activation link through your normal authorized contact process, activates once, signs in, sees only their own records, and approves the current proof revision. An old revision is rejected. Activation pages do not load analytics.
- A connected vendor submission is blocked before customer approval and owner release. Delivery requires the completed checklist and a valid HTTPS deliverable.
- A customer requests another meeting window; the original appointment remains scheduled until staff confirms a conflict-free replacement.
- After controlled provider testing, verify explicit email/SMS permission, revoked permission, changed destinations, quiet hours, reschedules, duplicate suppression, uncertain-attempt holds, and authenticated Twilio status callbacks. An ACCEPTED receipt is not proof of handset delivery. SMTP acceptance is not an email-open receipt.

## Validation and limitations

The accompanying validation record contains the exact local test counts, baseline comparison, syntax checks, browser checks and archive evidence. Local tests use synthetic records and injected persistence/provider adapters; the browser scenarios use local HTTP APIs and a PHP site with a synthetic portal session relay. They do not certify MySQL writes or live provider delivery.

Six inherited Command Center tests depend on GitHub workflow/history files omitted from the supplied deployment ZIP; they also fail in the unmodified baseline. The older aggregate npm chain likewise reaches an omitted historical release-note file. No success was fabricated for those checks. The MySQL integration test remains skipped without an isolated configured database.

Automatic Zoom creation is not included; confirm a real meeting URL. Customer rescheduling is an authenticated request followed by staff confirmation, rather than unrestricted self-service slot selection. Office Box provisioning and reseller order reconciliation retain their existing integrations and require their own hosted acceptance. No new subscription, provider account, paid ad, or outside purchase was created.

This release adds customer JSON state, workspace tasks, and order JSON metadata using existing persistence. It does not install a destructive database migration. Rollback handling preserves unrelated concurrent record changes and holds uncertain external attempts for review.
