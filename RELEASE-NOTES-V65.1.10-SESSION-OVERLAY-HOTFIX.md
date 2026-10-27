# SBC OS V65.1.10 — Session Overlay / Sign-out Access Hotfix

## Problem
When `/api/me` or another authenticated API returned HTTP 401, the app displayed the login panel but did not close the body-level SBC Lead Workspace modal. The modal uses a high z-index and could cover the login and sign-out controls, trapping the user on the workspace.

## Change
- `sbcShowLogin()` now closes `#sbc-lead-workspace` before displaying the login panel.
- The lead-workspace launcher is hidden while the session is rejected.
- Corrected the client-freshness token and active index cache-busters so the browser requests the hotfixed JavaScript.
- No database logic, recovery lock, tenant isolation, outbound messaging, checkout, or financial mutation behavior was changed.

## Validation scope
This is a source-level UI hotfix candidate. It does not establish that the candidate has been deployed to GoDaddy, and it does not resolve the existing MySQL recovery discrepancy.
