# V65.1.12 Release Verification Report

## Candidate identity
- Package: `sbc-business-command-center`
- Version: `65.1.12`
- Intended runtime: GoDaddy managed Node.js 22.x
- Production database: not connected or modified during this build

## Code changes in this candidate
- Logout no longer depends on successful authentication to clear the browser cookie. Server-side session revocation is attempted with bounded cleanup across configured stores.
- Login no longer returns success when neither Redis nor MySQL confirms durable session persistence; it returns retryable HTTP 503 and clears the cookie.
- Session-store SQL uses mysql2 query timeouts and application-level bounds.
- Release identity and browser cache-busting updated.
- Recovery guard and 243-versus-248 verification floor are preserved. No records are fabricated, deleted, promoted, or rewritten.

## Local checks
- `npm run test:all`: PASS
- JavaScript syntax audit: PASS (556 files)
- Targeted V65.1.12 auth/session checks: 6/6 PASS
- Session overlay regression: 3/3 PASS
- Lead workspace integration uses a fake MySQL connection; not a live database test.
- ZIP integrity: must be verified on the final generated archive.

## Deployment blocker — DO NOT DEPLOY THIS CANDIDATE YET
The source ZIP provided for this work has no root `package-lock.json`. An attempt to resolve the dependency tree could not complete because registry access timed out in this environment. The predeployment gate has therefore been corrected to fail when the lockfile is missing. A valid generated lockfile must be produced and verified before GoDaddy deployment. Do not substitute a hand-written or incomplete lockfile.

## Live issues not resolved by source-only work
- MySQL reports 243 customers versus a verified baseline of at least 248. Keep recovery lock active.
- Cause of the historical `CRM_BULK_REWRITE_BLOCKED_SOURCE_EMPTY` log still requires tracing against the exact deployed archive and timestamps.
- Historical 401/slow-request errors require live GoDaddy verification after the candidate is correctly packaged.
- This candidate has not been deployed and has not been tested against production MySQL.
