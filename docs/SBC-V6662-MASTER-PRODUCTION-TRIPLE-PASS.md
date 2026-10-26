# SBC V66.62 — Master production audit: client hub, tenant proof and 3× regression

**Release target: pre-deployment candidate. Certification: NO_GO pending independent live operating evidence.**

## Source-derived defects and repairs

1. **P0 / tenant isolation:** `POST /api/mega/client-portal/:customerId/token` accepted a staff-scoped customer ID with no tenant check. A manager could generate the legacy bearer link for a foreign-tenant customer. V66.62 requires `requireRequestTenant` and verifies the customer's tenant ID before any mutation.
2. **P0 / reflected and stored client-hub injection:** `GET /client/:token` interpolated an unvalidated URL parameter into JavaScript source and inserted customer/provisioning strings into `innerHTML`. V66.62 requires an exact 48-character hex bearer token, renders customer data via safe DOM `textContent`, and uses a per-response CSP nonce.
3. **P1 / private link leakage:** Client-hub HTML and public JSON bearer routes now send `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`; HTML disallows inline scripts except a cryptographic per-response nonce.
4. **P1 / internal financial data:** The authenticated portal orders API returned raw `order.notes`, which can contain internal payment/provider metadata. Responses now expose only deliberately customer-visible notes (`parsed.customerVisibleNotes`) while retaining the original order/notes unchanged in the database.
5. **P0 / autonomous mutation control:** Any authenticated user could call `POST /api/kim/control-plane/run` and trigger Kim's full autonomous control plane. Control-plane reads and manual execution now require owner authorization.

## Automated acceptance

- Source-only, no live account access: JavaScript syntax, strict text-only render helper and CSP nonce validation.
- Compiled runtime route execution with synthetic tenant 1/tenant 2, owner, manager and caller. Prove denial before any save. Check valid client token, malformed/script-bearing token rejection, privacy response headers, source preservation, and owner-only control plane.
- **Three separate compiled-test process invocations** and **three separate real Chromium tests**, each testing desktop (1365 px) and mobile (390 px) with synthetic malicious customer text.
- Existing GitHub offline source-fingerprint reconstruction, atomic config tests, auth, financial and tenant regression tests, lease / MySQL disposable restore, CSS comparison, desktop/mobile navigation and exact-ZIP smoke remain required.
- Full GoDaddy ZIP packaging is additionally gated on three compiled test runs. SHA-256 and archive CRC are recorded independently.

**These three repetitions cover the release-specific client-hub tests, not every feature, vendor integration or UI button.** No test here can prove actual Square bank deposits, Twilio calls, live CRM/tenant writes, or owner approval.

## Operational freeze / no unwanted changes

- No data records or schema changes.
- No GoDaddy Preview or Published deployment by CI.
- No SMS, phone calls, emails, charges, provider reconciliation writes or vendor fulfillment.
- SBCMIA existing V66.60 `index.php` remains compatible. The GoDaddy-controlled SBC Websites reseller storefront is untouched.
- **Office Box remains on hold.** Public SBCMIA pages currently advertise future Office Box packages and activation. Do not promise/activate Office Box before its separate delivery acceptance.
- Production Writer / Recovery Guard / MySQL tenant isolation are not disabled, bypassed or automatically unlocked.

## Release gate / 9.5

Engineering, SaaS and Operating Company must independently demonstrate >=95 with evidence under `scripts/sbc-v6655-strict-95-evidence.cjs`. CI success does not supply live Signed Square, disaster restore, security review, mobile authenticated commerce and real profitability/retention. The release may become a **verified candidate** but cannot be called 9.5-certified.

## Deploy only after owner review

1. Download the exact FULL GoDaddy ZIP from the passing GitHub Actions run (sign in and extract outer artifact once).
2. Confirm archive checksum and sourceCommit in `SBC-V66-PREBUILT-RUNTIME.json`.
3. Verify previous GoDaddy Published remains healthy and authoritative persistent backup exists.
4. Run Update Preview; verify runtime boot, read-only MySQL, 10s layout stability and privacy headers on legacy client hub.
5. Check non-destructive authorized test of tenant access and the existing SBCMIA signed lead bridge.
6. Publish only with owner decision; do not change Production Writer role, financial secrets or recovery locks as a shortcut.
7. Check read-only revenue integrity; real payments/fulfillment require a controlled owner-approved procedure and provider transaction ID.
