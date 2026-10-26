# SBC V66.61 — Inbound CRM integrity and customer portal sessions

## Evidence-based scope
The public `sbcmia.com` form and customer account bridge is signed server-to-server as of V66.60. That signature authenticates the PHP server, **not the person submitting a public form**. Treat the person's email, phone and business name as unverified. The GoDaddy-managed `sbcwebsites.com` reseller storefront and Office Box remain completely unchanged.

## Fixes
- An anonymous website form can no longer change the phone, email, contact person, lifecycle status, score, sales stage or assignment of an established CRM customer. Instead, signed repeat inquiries are recorded as a bounded ten-entry staff review list and activity.
- Public inquiry deduplication requires exactly one same-tenant matching email or phone. Business-name-only matches and ambiguous multiple matches create a separate **unverified** prospect rather than silently merging into another person's customer profile.
- An unverified new website inquiry is never auto-marked `Hot 95`, `Sales Ready`, nor auto-assigned a dialer task. Leads remain in the CRM for human verification and owner-controlled follow-up. Existing qualified records are not altered by the build.
- Authentication of the signed PHP site happens before rate limiting, preventing unsigned submissions from consuming legitimate website visitors' shared IP allowance.
- Customer portal session tokens require an independently configured `SBC_PORTAL_SECRET` with at least 32 characters and 8 distinct characters, use constant-time HMAC checks and a per-account session version.
- Customer portal logout now **revokes all outstanding tokens** for that account with one atomic state persistence. Historical V66.60 portal tokens have no version and are deliberately invalid; customers need to sign in again. Other legacy intake/vault secret sources are not modified.

## Deployment and required secrets
1. Confirm existing Published and Preview health before deploying.
2. Check **SBC_PORTAL_SECRET** is configured securely in GoDaddy Published with a strong independent key. **Do not replace or rotate a current working secret** without assessing customer-intake tokens and vault fallback, because they also use the historical portal-signing key.
3. Test the new release in read-only Preview; do not send real leads, payments or session mutations there. Only Published's approved writer may accept legitimate inbound website forms.
4. Keep `SBC_WEBSITE_BRIDGE_KEY` the same on the website and Command Center. **Do not place keys in index.php or GitHub**.
5. The existing V66.60 `index.php` remains compatible and needs no replacement for V66.61.
6. Check one authorized real signed website inquiry, one portal sign-in/logout and one owner-side CRM readback when operationally ready. Existing clients will have to log in again once after deploying this session-version update.

## Limitations
- No customer email-ownership confirmation flow exists yet; new account email confirmation remains a separate 9.5 gate.
- Non-Square public checkout links still require their own properly reconciled provider payment proof.
- No live GoDaddy production transaction, real Square settlement, customer delivery, retention or gross margin evidence is inferred from CI.
- **Release grade: NOT CERTIFIED 9.5** until Build, SaaS, and Company independently clear every >=95 subsystem with external evidence.
