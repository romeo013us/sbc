# SBC Command Center V66 — P0/P1 Sales Upgrade (Preview candidate)

## Version and provenance
- Built from the **user-supplied full V66 GoDaddy ZIP**, not an export of the running server.
- Base Git source revision in the supplied archive: `3852e20c6a7748c87cff98a9c52e8b3b5d468907`.
- The P0/P1 changes are **local candidate edits** and have not been committed to GitHub or certified by a hosted GitHub CI run.
- The refreshed stage inventory and hashes prove package-byte consistency only; they are **not evidence of live production acceptance**.
- New runtime patch: `v66.0.25-sales-p0p1-preview-candidate`.

## Delivered features
1. **Assigned Account Manager booking** at `/api/appointments` (POST/PUT/GET), after authenticated session + tenant + assigned customer checks. No approved website prerequisite.
2. **Owner and Account Manager appointment editor**: saves 10-minute appointments, displays them per account, supports authenticated rescheduling, and explicitly identifies Zoom links as manually confirmed.
3. **No accidental double bookings** for the same assigned Account Manager; repeated identical clicks are idempotent.
4. **Read-only daily queue** at `/api/sbc/sales/actions/today`: past-meeting attendance review, due callbacks, imminent meeting preparation, then verified research opportunities. Owner topbar and Account Manager login surfaces are connected.
5. **Read-only reminder drafts** at `/api/sbc/sales/reminders/preview`: 24-hour and 1-hour opportunities for customers with verified channel-specific consent and a confirmed HTTPS Zoom/Meet/Teams link. No SMS/email dispatch or guest link exists in this candidate.
6. **Security preserved**: assignment and tenant isolation; no DNC contacts; read-only and recovery/writer gates; no AI voice, outbound calls, mass email, SMS, billings, or payment changes.
7. **Official calling script preserved verbatim** including `WELL, THE THING IS, I BUILT YOU ONE!`.

## Preview rollout — do not skip
- Preserve a backup of the working GoDaddy Command Center, database, uploads, and secrets.
- GoDaddy Preview is currently read-only and was observed returning HTTP 401 externally; an isolated authenticated writable staging environment with a **separate test database** is required to test a successful save as a real Account Manager.
- Do not try to bypass the read-only policy or use live customer records to test booking, texting, or payment.
- Verify an assigned Account Manager can create/reschedule an appointment and see it in both Calendar and Account 360; confirm another Account Manager/tenant cannot.
- Verify a booking with no website exists; then generate an owner-reviewed private concept before the customer presentation.
- Verify safe date formatting and slot conflict responses with two scheduled accounts.
- Verify DNC, disabled actor, failed MySQL writer lease, and recovery mode deny changes.
- Verify the reminder preview displays only qualified consented appointments. Automated SMS/email and one-click public reschedule are **not enabled** until opt-in proof, channel templates, Twilio/email provider delivery, duplicate suppression, quiet-hours policy, token security, and separate approval are implemented and tested.
- Run server boot preflight with `SBC_RELEASE_PREFLIGHT_ONLY=1 node sbc-godaddy-flat-entrypoint.cjs` before starting Preview, then use GoDaddy's normal published-writer release process only after genuine Preview acceptance.
- Never upload this Node.js project into the public PHP `sbcmia.com/public_html` folder.

## Local checks
- `node --test test/sbc-sales-p0p1.test.cjs test/sbc-appointment-workflow.test.cjs`
- `node scripts/v66-safe-js-bundles.cjs --check`
- `node scripts/v66-owner-ui-css-bundle.cjs --check`
- `node scripts/v66-deployment-artifact-gate.cjs`
- `SBC_RELEASE_PREFLIGHT_ONLY=1 node sbc-godaddy-flat-entrypoint.cjs`

## Known limitations
- No automatic Zoom invitations; entering a URL does not reserve a meeting with Zoom.
- No automatic SMS/email confirmations/reminders and no public self-reschedule link; **draft previews only**.
- No actual authenticated Preview login, live database mutation, external carrier delivery, Square capture, or real-customer funnel checks completed here.
- Other GoDaddy modules and products are unchanged from the supplied V66 baseline.
