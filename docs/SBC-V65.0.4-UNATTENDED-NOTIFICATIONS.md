# SBC OS V65.0.6 — Unattended Operations Notifications

## Included
- Owner-only notification status, destination-configuration, and test endpoints.
- Daily executive email briefing at 07:00 America/New_York by default.
- Read-only MySQL counts for customers, quotes, orders, renewals, and activities in the trailing 24 hours.
- Critical Twilio SMS alerts for an active recovery lock, MySQL connectivity failure, daily briefing send exceptions, and Square checkout webhook exceptions.
- Six-hour per-alert-key deduplication using a local state file under `data/`.
- Dashboard panel with provider readiness, test email/SMS buttons, manual briefing send, and refresh.
- The existing 248-customer recovery threshold is unchanged. No startup mutation pipeline is resumed by this feature.

## Existing configuration only
The feature reuses current process environment values and the existing owner profile. It does not require a new GoDaddy secret slot.

Email transport aliases, checked in order:
- Host: `SBC_SMTP_HOST`, `SMTP_HOST`
- Port: `SBC_SMTP_PORT`, `SMTP_PORT` (default 587)
- User: `SBC_SMTP_USER`, `SMTP_USER`
- Password: `SBC_SMTP_PASS`, `SMTP_PASS`
- Sender: `SBC_MAIL_FROM`, `SMTP_FROM`, then SMTP user
- Owner destination: `SBC_EXECUTIVE_EMAIL`, `SBC_OWNER_EMAIL`, `OWNER_EMAIL`, `ADMIN_EMAIL`, `SBC_MAIL_TO`, then active owner user's email

Twilio transport aliases, checked in order:
- Account SID: `TWILIO_ACCOUNT_SID`, `SBC_TWILIO_ACCOUNT_SID`
- Auth token: `TWILIO_AUTH_TOKEN`, `SBC_TWILIO_AUTH_TOKEN`
- Sender: `TWILIO_PHONE_NUMBER`, `SBC_TWILIO_FROM`
- Owner destination: `SBC_OWNER_PHONE`, `SBC_ALERT_PHONE`, `OWNER_PHONE`, `ALERT_PHONE`, then active owner user's phone/mobile

The owner destination must be a valid email or E.164 phone number. The dashboard can save destinations in a private server-side JSON file with restrictive file permissions, so you do not need another GoDaddy secret slot. Missing configuration fails closed and is shown as `NOT READY`; the status API never returns the full email address or phone number.

Optional schedule settings are non-secret configuration: `SBC_BRIEFING_TIMEZONE` and `SBC_BRIEFING_HOUR` (0–23). Defaults are `America/New_York` and `7`.

## Owner-only endpoints
- `GET /api/owner/notifications/status`
- `POST /api/owner/notifications/destinations` with JSON `{"email":"owner@example.com","phone":"+13055550123"}` (either field may be supplied)
- `POST /api/owner/notifications/test` with JSON `{"confirm":"SEND_TEST","channel":"email"}` or `sms` or `both`
- `POST /api/owner/notifications/briefing/send` with JSON `{}`

Test sends require the explicit `SEND_TEST` confirmation. A provider-accepted message is not proof of delivery to the final mailbox/handset.

## Safety
- The briefing uses SELECT-only queries and does not create or modify MySQL tables.
- If a metric query fails, it is reported as `UNAVAILABLE`, not falsely shown as zero.
- Recovery-required state is called out explicitly in each briefing.
- This feature does not unlock recovery, start Revenue PLAY, enable Kim mutation workers, send prospect outreach, process refunds, or move money.
- `data/sbc-unattended-notifications-state.json` records only alert deduplication and last successful briefing date. If local file persistence is unavailable, delivery deduplication degrades to process memory and is logged.

## Acceptance tests
Run `npm run test:v6504-notifications` in the app directory. Tests use mocked email/SMS providers; they do not send real messages or connect to production MySQL.


## V65.0.6 corrective UI changes
- Owner status now returns saved destinations to repopulate the owner form after refresh.
- Added an owner-only Notifications navigation item and dedicated Notifications & Action Queue view.
- Added a read-only recovery-status check with live table counts and baseline values.
- The master control displays RECOVERY LOCK rather than an unexplained SYSTEM OFF when recovery is active. Routine automation remains disabled until authoritative recovery is verified.
- No recovery threshold changes or database writes were added.


## V65.0.6 schema log correction
- Replaced the misleading `SBC V12.0.5` application-style log with a neutral database-schema compatibility message.
- The legacy V12.0.5 reference remains only as a historical migration explanation.
- The `sbc_settings.setting_value` type is checked first; an ALTER runs only when the existing column is not MEDIUMTEXT or LONGTEXT.
- The recovery threshold is unchanged. This release does not clear recovery mode or write lead records.
