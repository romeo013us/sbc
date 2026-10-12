# SBC OS V65.1.25 — Customer 360 Workspace Test Report

## Included changes
- Customer row clicks now route to the fuller Customer 360 surface.
- Adds SBC call, email, SMS, build cart/quote, fast checkout, demo, and refund-request actions where applicable.
- Fast checkout selects an existing customer quote; link dispatch requires a valid HTTPS quote URL and an explicit customer-consent confirmation.
- Paid/won/completed quotes are blocked from duplicate checkout sending.
- Recovery/read-only state disables outreach, quote/checkout, demo, and refund actions.
- Lead Workspace launcher moves to the bottom-right corner on desktop and mobile, away from the sidebar Sign out control.

## Verification
- Root bootstrap release identity and ordered patch application are checked by `node bootstrap.js --verify`.
- Customer 360 safety/static regression checks are run by `node hotfix-assets/v6525-customer360-workspace-test.js`.
- Existing V65.1.24 root, persistence, phases, API stabilization, and single-writer regression tests remain in `npm run test:all`.

## Limitations
- No live GoDaddy deployment or live Square transaction was performed during this build.
- This patch does not modify the database or alter payment state.
