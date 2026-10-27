# SBC OS V65.1.1 — Authentication Redirect False-Positive Hotfix

## Why this release exists
Production logs show V65.1.0 starts successfully while the owner reports being repeatedly returned to the sign-in screen. The shared API helper previously treated generic HTML responses as authentication failures when the HTML contained common sign-in/session wording or the login form ID. The application shell itself contains a login form, so a proxy/SPA fallback response for an API endpoint could be misclassified as an expired session.

## Change
- Generic HTML returned for an API request now produces an endpoint/proxy diagnostic error and does **not** clear the in-memory user state or switch the UI to the sign-in screen.
- Only an actual HTTP 401 response triggers session-expired handling in the HTML-response path. Normal JSON 401 responses continue to trigger sign-in as before.
- Recovery mode remains engaged. This release does not restore CRM rows, unlock writes, modify secrets, or change payment/refund controls.

## Verification boundary
This is a code hotfix and regression test, not a claim that production is already updated. After deployment, verify `/api/me` returns JSON with HTTP 200 while signed in, and check any endpoint that returns HTML instead of JSON. If `/api/me` itself returns 401, the underlying cookie/session persistence still needs a separate diagnosis.
