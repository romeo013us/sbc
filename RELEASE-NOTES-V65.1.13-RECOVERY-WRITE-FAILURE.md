# SBC OS V65.1.13 — Recovery Write Failure Propagation

## Purpose

Correct the persistence failure path that can otherwise make an unsafe CRM shrink look like a generic MySQL retry failure.

## Changes

- Preserve the persistence safety rejection code (`CRM_BULK_REWRITE_BLOCKED_SOURCE_EMPTY` or `CRM_BULK_REWRITE_BLOCKED_PARTIAL_SOURCE`).
- Log a compact call-site stack trace and affected table names without logging customer payloads, so the exact caller can be identified in the next diagnostic run.
- Mark the application as recovery-required when the persistence safety engine rejects a source snapshot.
- Propagate the recovery rejection to the caller instead of silently returning as if the save succeeded.
- Do not write a local JSON fallback snapshot from the possibly partial in-memory projection after a recovery safety rejection.
- Preserve the existing 243-vs-248 recovery baseline, tenant isolation checks, recovery lock, financial mutation protections, session changes, and lead workspace controls.
- Synchronize release identity and browser cache identifiers to V65.1.13.

## Verification

- `npm run test:all`: PASS.
- Targeted recovery/session/lead-workspace/tenant-isolation/polling tests: PASS.
- `npm run predeploy:open-gate`: BLOCKED because `package-lock.json` is missing. The package must not be deployed until a genuine lockfile is generated and verified.
- JavaScript syntax audit from the predeploy gate: 578 files checked, 0 syntax failures.
- Static secret scan: PASS.

## Limitations

- No live GoDaddy deployment or production database connection was performed.
- The historical source of the empty `customers` buffer cannot be proven from the existing logs alone. V65.1.13 adds safe caller diagnostics for the next occurrence.
- Production database recovery remains unresolved at 243 customer rows versus the verified baseline of at least 248. Do not lower the baseline, synthesize records, or unlock mutations.
- Authentication and latency require live endpoint verification after a controlled release.
- Dependency resolution could not reach `https://registry.npmjs.org/` from the build environment, so a valid npm lockfile could not be generated here. No placeholder lockfile was added.
