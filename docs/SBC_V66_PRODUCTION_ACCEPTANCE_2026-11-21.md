# SBC V66 — Evidence-based production acceptance

**GitHub source branch:** `a-sbc-master` (owner: Successful By Choice)

**Status:** `LOCAL_CODE_TESTED`; **not** production-certified. Do not assign a 9.5/10 production reliability or automation score from passing unit tests alone. Production messaging stays disabled until approved provider delivery acceptance.

## Automated tests now in GitHub

- `test/sbc-appointment-recovery.test.cjs`: explicit per-destination reminder consent; 8 AM–8 PM America/New_York sending window; quiet-hours deferral to the first permitted 8 AM; 15-minute catch-up expiry; DST-safe opening time; concurrent at-most-once claims; failed persistence; provider uncertainty and callback terminality; owner-only dispatch.
- `test/sbc-connected-journey.test.cjs`: inquiry deduplication and readback, owner/AM scope, refund guards, checklist/approval gating, customer activation, protected reschedules, and rollback preservation.
- `test/sbc-sales-p0p1.test.cjs` and `test/sbc-journey-http.test.cjs`: synthetic call, appointment, permissions, and API tests.
- `scripts/v6683-full-recovery-ci.test.cjs`: *disposable local* MySQL source → logical backup → empty isolated target; verify record hashes and refuse unsafe destination, cross-schema, repeated restore. **Never run it on GoDaddy.**

The GitHub Action `.github/workflows/sbc-v66-customer-journey-reliability.yml` runs those checks on the correct branch. It does not read SBC production secrets, real customer records, or deliver messages. It deliberately does not switch on `SBC_APPOINTMENT_MESSAGES_ENABLED`.

## Required real hosted evidence before production sign-off

| Gate | Controlled scenario | Required proof |
|---|---|---|
| Database durability | Create synthetic tenant/account, book a meeting, restart staging app | MySQL readback of same IDs before and after restart; no unexpected duplication |
| Backup and restore | Take a separate staging backup and restore to a **new** isolated target | Restored row counts plus redacted record-level digest comparison; never restore onto live tables |
| Website intake | Submit a signed sbcmia staging inquiry; repeat the identical receipt and attempt forged submission | One CRM account/inquiry/task, forged request refused, owner/AM assignment verified |
| Payments | Use Square sandbox for one approved published price; send duplicate and failure events | One pending checkout, paid only after verified capture, exactly one fulfillment plan, refund holds delivery |
| Customer approval | Activate a test portal account, approve current revision, request a changed proof | Only authorized tenant sees its records; stale proof rejected; owner approval required for release |
| Appointments | Book/reschedule a meeting; test conflicting managers and canceled slots | Original meeting remains until confirmed replacement; no double-booking |
| Reminders | Use a provider-approved test recipient who opted in; verify dispatch, statuses, revocation, quiet hours, uncertain holds | Provider IDs/status callbacks, no repeat delivery, no sends to changed destinations; **accepted is not delivered** |
| Office Box | Test existing tenant provisioning and the paid activation handoff in isolation | Tenant/account/scope and billing status readback |
| Reseller | Check recovered customers, reseller checkout and order synchronization without mutation | Reconciliation evidence; distinguish verified unavailable from untested |

## Operational acceptance sequence

1. Back up currently working GoDaddy code, cPanel site, database, uploads, and hosting configuration. Preserve the last known good release.
2. Create a **separate authenticated writable Node staging app** and **separate test MySQL database**, with isolated keys, origin, and test tenants. Never bypass the protected read-only GoDaddy Preview.
3. Deploy the `a-sbc-master` candidate only to staging; ensure installed Node dependencies and release identity pass the normal preflight. Keep outbound appointment messages disabled.
4. Perform the first six gates using synthetic test contacts and Square sandbox. Record exact staging host, tested commit, UTC/Eastern timestamp, sanitized IDs and screenshots/logs with secrets removed.
5. Only then test SMS/email with explicitly consenting controlled recipients and verify carrier/provider delivery callbacks. Treat SMTP acceptance as unverified delivery until additional provider evidence exists. Leave messages off if provider readiness fails.
6. Reconcile Office Box and reseller independently. Production promotion is an **owner-controlled** separate action after all gates pass. Monitor and retain rollback capability.

## Release notes for this upgrade

- Quiet-hour reminders no longer expire invisibly before the first 8 AM Eastern dispatch window. The worker has a 15-minute catch-up window for 1-hour/24-hour reminders and will never send after the appointment. The scheduler recalculates Eastern time through DST changes.
- Customer Journey reminder preview counts uncertain attempts needing reconciliation, failed deliveries, and provider-accepted but not confirmed-delivered attempts, scoped to the authorized staff account.
- `SENDING` and `UNKNOWN` attempts are **never automatically retried**; owner/provider reconciliation remains mandatory. No automatic Zoom creation, vendor purchase or public website publishing was enabled.

**Exit standard:** Only write `PRODUCTION_VERIFIED` after hosted gates have dated, inspectable evidence. Synthetic CI passes are `TESTED`, not `PRODUCTION_VERIFIED`.
