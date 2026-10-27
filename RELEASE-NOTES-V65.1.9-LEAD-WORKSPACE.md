# SBC OS V65.1.8 — Lead Workspace Rebuild Candidate (candidate patch)

## Scope
- Adds a new, isolated Lead Workspace UI without deleting existing CRM UI code.
- Adds tenant-scoped, read-only list/detail endpoints backed by the existing CustomerRepository.
- Provides manual browser-session staging and CSV export; staging is not persisted to MySQL.
- Retains the existing customer-360 routes for backward compatibility.
- Keeps all existing recovery/emergency gates and historical database rows untouched.
- Includes focused tests and the existing polling hotfix changes from the V65.1.8 source package.

## Important deployment gate
This package is a candidate, not a declaration of production readiness. Do not deploy until the source package is reviewed and an approved backup/rollback point exists. The production and Preview environments share MySQL; app startup can still perform schema reconciliation. This package does not change the database or unlock recovery.

## Test
Run `npm run test:lead-workspace` after dependencies are installed. The test verifies route scope, tenant-bound repository use, browser-only staging, CSV export, and retained polling safeguards.

## Manual lead staging behavior
The workspace's “Add to Staging” action only stores entries in browser memory for the current page session. Use “Export Staged CSV” to preserve them. It intentionally does not insert, update, delete, or import records into MySQL while the recovery gate is unresolved.

## Known limitations
- The list view is paginated and the search filters only the currently loaded page.
- The workspace does not write leads into production; that requires a separate reviewed import workflow after recovery is resolved.
- Live GoDaddy deployment and live endpoint behavior have not been verified by building this archive.
