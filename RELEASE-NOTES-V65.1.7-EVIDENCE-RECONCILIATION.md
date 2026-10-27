# SBC OS V65.1.7 — Evidence-Based Reconciliation & Buyer Readiness

## Changes
- Upgraded read-only lead reconciliation from whole-dump text scanning to parsed row comparisons for `sbc_customers` and `sbc_lead_mesh`.
- Audits the five proposed recovery claims against their named CSV sources; does not treat synthetic labels or short unverified hashes as customer records.
- Added regression tests for SQL tuple parsing, cross-table candidate matching, read-only output, and rejection of unsubstantiated claims.
- Added a buyer-demo opening gate with explicit local-vs-live verification boundaries.
- Bumped authoritative release identity to V65.1.7.

## Safety
- No database connection is opened by the reconciliation script.
- No customer records are inserted, updated, deleted, or synthesized.
- Recovery lock remains enabled. No automated unlock or live deployment is performed by this build process.

## Limitations
Tenant execution context does not by itself prove every SQL query is tenant-scoped. Full query-level tenant isolation, live GoDaddy deployment, production migration execution, and end-to-end payment-to-fulfillment acceptance still require separate verification.
