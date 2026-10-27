# SBC OS V65.1.8 — Demo/Open Readiness Gate

## Locally testable now
- Release identity and static assets align to V65.1.8.
- Tenant repository uses explicit, parameterized tenant filters and does not accept a caller-provided tenant override.
- Concurrent context isolation is tested with a mock pool.
- An isolated, no-network Docker test profile is included.
- Read-only reconciliation tools remain non-mutating.

## Not claimed as verified
- Successful GoDaddy deployment or live health checks.
- Live MySQL migration or real database tenant isolation.
- Full application-wide query coverage; existing SQL call sites are not all routed through this repository.
- Restoration of five customer rows; no authoritative 248-row baseline has been demonstrated.
- Live Square payment-to-fulfillment end-to-end acceptance.

## Tonight's controlled release sequence
1. Preserve current production package and database backup.
2. Deploy only after local gates pass; inspect startup logs and `/livez` and `/readyz`.
3. Confirm the live release identity is V65.1.8 and test owner login in a clean browser.
4. Confirm owner-only refund approval and owner veto controls remain enforced.
5. Use a non-charging demo path first; do not create a production payment unless the owner explicitly authorizes it.
6. Keep the recovery lock engaged and show read-only/demo mode while the customer baseline remains unresolved.
7. Test two synthetic tenants only in isolated staging; never use another customer's data as a fixture.
8. If a gate fails, stop and retain the existing production build.

## GoDaddy constraints
- Node.js 22.x and `npm start` (`node server.js`).
- Do not add environment secrets beyond the existing 50-slot limit.
- This ZIP is a locally prepared artifact, not proof of successful live deployment.
