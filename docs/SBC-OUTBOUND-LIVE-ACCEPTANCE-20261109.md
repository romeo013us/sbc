# SBC Outbound: live acceptance and owner handoff

Release date: 2026-11-09. This checklist concerns Command Center's existing **Prepare Tomorrow** integration, NOT a new CRM.

## Scope and safety
- Public SBC business contact: **info@sbcmia.com**. Jonathan Jones is the owner signature. Do not substitute private owner alert/invoice/account sign-in addresses.
- One verified/eligible lead can receive a reviewed, personalized email only with documented **affirmative direct marketing opt-in**. No scraped contact is automatically enrolled. Calls remain governed by existing employee permissions and DNC review.
- Website demo claims appear only when the existing CRM Demo engine has a saved Ready demo.
- No automated dialing, customer-facing auto-replies, or unconfirmed appointment bookings.
- Email sending is disabled by default. A 202 receipt means **provider accepted**, not delivered; signed Event Webhook establishes provider delivery status.
- Incoming replies are reviewable tasks. The mailbox is NOT directly connected by this code alone.
- Existing Square, Twilio, account credentials, and Office Box payment integration are unchanged.

## Provider and environment checklist (no secrets in GitHub)
Configure in **Published GoDaddy Secrets** after reviewing the provider dashboard, permission policy, and sending domain:
- `SENDGRID_API_KEY`: provider key with minimum needed Mail Send rights (never paste into chat)
- `SBC_MARKETING_EMAIL_ENABLED=true`: enable only after approved test and signed webhook
- `SBC_MARKETING_SENDER_VERIFIED=true`: only when SendGrid verified the actual SBC sender/domain
- `SBC_SENDGRID_UNSUBSCRIBE_GROUP_ID`: configured ASM unsubscribe group
- `SBC_MARKETING_POSTAL_ADDRESS`: verified current, valid SBC business mailing address (do not use an unverified placeholder)
- `SBC_MARKETING_PRIVACY_URL`: live SBC privacy-policy URL using HTTPS
- `SBC_SENDGRID_EVENT_PUBLIC_KEY`: SendGrid signed Event Webhook ECDSA verification public key (public, not private key)
- `SBC_MAIL_RELAY_SECRET`: randomly generated 32+ character HMAC secret shared ONLY with a trusted server-side inbox connector. The relay endpoint is not an inbox itself.
- `SBC_OWNER_SALES_ALERTS_ENABLED=true`: optional after owner notification delivery is verified; sends deduplicated alerts for real caller appointment requests.

Do **not** alter the existing MX records for `info@sbcmia.com` merely to enable SendGrid Inbound Parse. If using an existing Microsoft 365/other mailbox, connect an authorized server-side workflow that reads that inbox and signs a sanitized reply event for Command Center. The connector must be configured separately; no such mailbox connection is asserted by the code.

## URLs and verification
Owner-signed-in:
- `GET /api/owner/nextday/email-status` — readiness flags, eligible prospect count, consented lead count, signed webhook/relay flags
- `GET /api/owner/nextday/preview`, `GET /api/owner/nextday/priorities`, `GET /api/owner/nextday/queue` — authoritative owner review
- `POST /api/owner/nextday/prepare` — owner-reviewed call tasks and drafts; no email
- `POST /api/owner/nextday/send/:taskId` — owner-approved single email, explicit consent and provider checks
- `POST /api/owner/nextday/reply/:taskId` — manual verified email classification
- `POST /api/owner/nextday/appointment` — owner records only customer-confirmed appointment

Webhooks:
- `POST /api/nextday/sendgrid/events` — signed SendGrid delivery and suppression events; SendGrid's ECDSA signature over raw bytes
- `POST /api/nextday/mailbox/reply` — **not public-use**: expects `X-SBC-Mail-Relay-Timestamp` (Unix seconds), `X-SBC-Mail-Relay-Signature` (lowercase SHA256 hex of HMAC_SHA256(secret, timestamp + "." + original raw JSON bytes)).
- Relay JSON fields: `tenantId`, `messageId`, `fromAddress`, `toAddress` (must equal info@sbcmia.com), `subject`, `text`. No attachments, HTML, untrusted commands or credit-card details. If unknown/ambiguous, fail for owner reconciliation instead of guessing a customer. Suppression for a clear one-word unsubscribe is immediate; other replies create a review task and do not auto-book.

## One bounded acceptance test
1. Verify Published writer, database, recovery state, login/role restrictions, and no changes to existing real customer records.
2. Use a **consenting internal test mailbox** and verified opt-in evidence; do not use a scraped lead for a live SendGrid test.
3. Create/verify a Demo for that test lead. Confirm its URL genuinely opens.
4. Use owner **Prepare Tomorrow** for one test lead and confirm the next-day call task saved after reopening Command Center.
5. Approve exactly one email and verify provider acceptance **and a signed delivered event** before calling it delivered.
6. Reply from the test mailbox; verify the signed relay creates one review task and owner alert and does not double-create on replay.
7. Explicitly confirm one meeting time and create the appointment; verify calendar task, time ordering and owner notification receipt.
8. Unsubscribe using the test mailbox; verify the durable CRM suppression survives a database reload and prevents another marketing email.
9. Verify the caller workspace has the assigned lead, due date, Demo link, and Twilio controls unchanged.
10. Run separate Square Office Box **recurring-payment-to-activation** acceptance; the email workflow does not prove subscription billing.

## Rollout
PR-only code is not evidence of a live deployment. Verify GitHub CI plus GoDaddy Published hosting and event receipts. Do not state 100% until this acceptance test passes.