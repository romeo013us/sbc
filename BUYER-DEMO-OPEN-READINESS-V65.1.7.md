# SBC OS V65.1.7 — Demo and Opening Gate

## What is verified locally
- Release identity matches `package.json`.
- Tenant context, recovery-isolation and buyer-demo regression tests pass locally.
- Read-only relational candidate reconciliation parses customer and lead-mesh INSERT rows and does not mutate data.
- Package can be checked for ZIP integrity and JavaScript syntax before delivery.

## Not represented as verified
- GoDaddy deployment or live health checks.
- Live customer authentication from a clean browser session.
- Production MySQL migration execution or rollback behavior.
- End-to-end Square payment → webhook → fulfillment with a real production event.
- Full tenant isolation for every SQL query in the application.
- Recovery of the alleged five missing records.

## Tonight's release gate
1. Upload/deploy only after preserving the current production package and database backup.
2. Confirm the deployed release identity is V65.1.7 and inspect startup logs for migration or SQL errors.
3. Test owner login and a non-owner role in a clean browser session.
4. Verify owner-only refund approval and owner authority/veto controls.
5. Run a non-charging demo path first. Use a real payment only if explicitly approved by the owner and confirm the resulting event and fulfillment state without duplicate processing.
6. Verify tenant-scoped pages with two distinct test tenants in staging; do not use another customer's data as a test fixture.
7. Keep the production recovery lock engaged until the authoritative CRM baseline is reconciled. Do not invent or insert the five claimed rows.
8. If any gate fails, keep the demo in read-only/showcase mode and do not describe the system as fully production-verified.

## GoDaddy constraints
- Use the existing Node.js 22.x runtime and `npm start` (`node server.js`).
- Do not add environment secrets beyond the existing 50-slot limit. Reuse or migrate configuration only through a separately verified secret-management plan.
- This artifact is a locally tested build package, not proof of a successful live deployment.
