# SBC OS V65.1.48 — Lorna Least-Privilege Access

## Security objective
Limit the Lead Researcher workforce role to the work required for lead research, lead submission, training, and personal time-clock functions.

## Changes
- Add a server-side deny-by-default boundary for Lead Researcher role aliases before API route handlers. Routes outside the explicit allowlist return HTTP 403.
- Apply the restriction to API handlers even when an older handler omitted its own `auth` middleware.
- Permit only the dedicated lead-research endpoints, lead submission/import, own training progress, and self-scoped time-clock/onboarding routes.
- Deny direct navigation to Office Box, Ops Center, admin, settings, system-console, and commercial-console pages for Lead Researcher accounts.
- Restrict the sidebar to Customer Acquisition, Training, and Time Clock; hide global search, external links, Office Box, and all other navigation for the Lead Researcher role.
- Preserve owner and other non-researcher roles.
- Preserve tenant identity, recovery guard, and exclusive writer-lease checks. No customer rows are modified by this patch.

## Verification required before Live
- Build and regression checks must pass.
- Test as a Lead Researcher: allowed lead workflow works; prohibited APIs return 403; owner account remains unrestricted.
- Deploy to GoDaddy Preview first. Do not publish to Live until these checks pass against the deployed runtime.
