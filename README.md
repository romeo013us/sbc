# SBC Command Center V66 — Full GoDaddy Application (P0/P1 Sales Preview Candidate)

This is the **full Node.js application archive**, not a patch-only ZIP and not a backup from the live GoDaddy instance.

**Build status:** Locally generated preview candidate from the user-supplied V66 archive. Not production certified; no live customer data, environment secrets, `node_modules`, or database dump included.

## What's new
- Authenticated, tenant-scoped Account Manager appointment creation and rescheduling without a prior website concept.
- Assigned-account access, DNC/suppression checks, writer/recovery gate, 10-minute booking, double-booking prevention.
- An immediately actionable daily revenue priority queue for the owner and Account Managers.
- Upcoming appointment preparation, evidence-based research opportunities, and **draft-only** 24-hour/1-hour reminder previews.
- Calling script unchanged. No automatic outbound SMS/email, Zoom meeting creation, voice calls, or public rescheduling tokens.

## Installation
1. Back up the existing GoDaddy Node.js Command Center, database, uploads and credentials.
2. Install into the Node.js application root (not the public PHP website's `public_html`).
3. Install dependencies with the platform's supported Node.js 22/npm 10 flow; `package-lock.json` is included.
4. Verify integrity with `SBC_RELEASE_PREFLIGHT_ONLY=1 node sbc-godaddy-flat-entrypoint.cjs`.
5. Verify on a **separate writable staging database** with authenticated Account Manager role. Do not bypass GoDaddy Preview read-only state.
6. Promote to Published only after end-to-end results are accepted and rollback backup exists.

See `docs/SBC-P0-P1-PREVIEW-RELEASE-NOTES.md` and `SBC-P0P1-PREVIEW-QA.json` for tests, safety restrictions, and limits.
