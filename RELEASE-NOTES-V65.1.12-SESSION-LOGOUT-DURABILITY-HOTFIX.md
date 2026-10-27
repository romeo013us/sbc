# SBC OS V65.1.12 — Session Logout and Durability Hotfix

## Changes
- Logout no longer requires a valid session to clear the browser cookie; server-side revocation is attempted with bounded cleanup across cache, Redis, and MySQL.
- Login returns `503 SESSION_PERSISTENCE_UNAVAILABLE` and clears the cookie when neither Redis nor MySQL confirms durable session persistence. It no longer reports success for an ephemeral-only session.
- Session-store MySQL queries now use the mysql2 query timeout option and an application-level timeout.
- Release identity and client cache-busting updated to V65.1.12.
- Recovery lock remains engaged when authoritative recovery is required. No customer rows are inserted, deleted, promoted, or rewritten by this release.

## Verification scope
- Targeted static release/session checks added.
- Full automated suite and predeployment checks must pass on the final archive.
- No live GoDaddy or production MySQL test is performed by this build.
- Database discrepancy (243 customers versus verified baseline >=248) remains unresolved; all business mutations and automation remain restricted.

## Release blocker
The source archive does not contain a complete generated `package-lock.json`. The current build environment could not complete npm registry resolution. Do not describe this candidate as fully dependency-locked or production-ready until a valid lockfile is generated and verified in an environment with registry access.
