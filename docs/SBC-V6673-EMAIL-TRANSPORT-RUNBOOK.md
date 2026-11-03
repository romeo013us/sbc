# SBC V66.73 — Email Transport Stabilization and GoDaddy Release Checklist

**Scope:** Secure email only. Does not change CRM data, Square, Office Box, customer orders, DNS, tenant roles, or financial approvals.

## What changed

- Owner notification emails: try configured TLS SMTP host/port, and, on network-level failure from port 465, retry authenticated STARTTLS on port 587. Do not retry authentication failures.
- Both connections validate TLS (minimum TLS 1.2). Never fall back to unencrypted SMTP for executive briefings.
- Customer and internal staff emails remain on the existing production path; this maintenance change does not alter that path or its SMTP sender defaults. A future customer-email hardening change requires a separately verified release.
- The pre-existing customer-email relay fallback is **not changed** by this release. Do not set `SBC_SMTP_RELAY_ENABLED=true` as a troubleshooting shortcut.
- Every test uses synthetic email provider responses. CI success is not proof GoDaddy permits outbound SMTP.

## Operator settings for the existing Professional Email account

Replace existing values in GoDaddy **Secrets / Environment Variables**; never add duplicates or paste passwords into an issue/chat.

| Name | Value |
| --- | --- |
| `SBC_SMTP_HOST` | `smtpout.secureserver.net` |
| `SBC_SMTP_PORT` | `465` |
| `SBC_SMTP_SECURE` | `true` |
| `SBC_SMTP_USER` | Active business mailbox address |
| `SBC_SMTP_PASS` | Mailbox password, set privately in GoDaddy |
| `SBC_MAIL_FROM` | Optional; if already defined, align with mailbox |
| `SBC_SMTP_RELAY_ENABLED` | Set `false` explicitly if an existing setting is present; this release does not change its legacy default |

GoDaddy Professional Email officially documents `smtpout.secureserver.net`, SSL, and port 465. Port 587 is a contingent STARTTLS alternative, not a guarantee the GoDaddy Node.js environment allows it.

**Owner destination:** Set separately in Command Center → Notifications → Executive Email to a mailbox the owner monitors. This does not set the SMTP sender.

## Acceptance sequence (one controlled email test)

1. Preserve live `f4f6d71` rollback, confirm CRM total and writer state; do not alter application records.
2. Merge only after CI passes and the new verified GoDaddy ZIP artifact/receipt match.
3. Deploy **Preview** and ensure Healthy, read-only role, exact release commit, login and state readback.
4. Promote **Published** only after Preview acceptance. Confirm Healthy, writer lease and unchanged customer count.
5. In owner-authenticated Command Center, use existing **Communications → Verify Email Connection**; its `POST /api/communications/email/verify` checks transport **without sending**.
6. In **Notifications**, choose **Send Test Email** once. Check owner inbox/spam; a 2xx provider acceptance is not final delivery proof.
7. Verify from-address is business mailbox and no duplicate attempts. Keep automated marketing paused pending explicit consent.
8. If both ports return `EACCES`, STOP. Host policy or another outbound transport is required. Use an authenticated HTTPS email API with a properly scoped secret after separately reviewing its contract; do not disable TLS, turn on unencrypted port 25, or send another charge.

## Not included / cannot be done by GitHub

- GoDaddy secret values, Node PaaS egress policy, and signed-in portal clicks.
- Live provider SMTP reachability and message arrival.
- Payment capture or customer activation.

**Rollback:** Restore the previous known-Healthy `f4f6d71` application release. Preserve `/app/sbc-persistent`, MySQL data, and payment evidence untouched.
