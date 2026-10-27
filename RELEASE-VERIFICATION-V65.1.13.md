# SBC OS V65.1.13 — Release Verification

**Status: SOURCE CANDIDATE — NOT DEPLOY READY**

## Candidate identity

- Package: `sbc-business-command-center`
- Version: `65.1.13`
- Required Node runtime: `22.x`
- Start command: `node server.js`
- `server.js` SHA-256: `c41b56a0fdfcbb5295ddd95f9dd4acaad809fefe4d7ce36f9272d0d4f2c69a7a`

## Fresh checks run in the available build environment

- `npm run test:all`: **PASS**, exit code 0.
- JavaScript syntax audit: **PASS**, 592 `.js` files checked, 0 syntax failures.
- UI static audit: **PASS**, 138 asset references, 1 inline handler, 308 frontend API paths compared with 1,199 server route patterns, 0 reported problems.
- Recovery-write failure propagation: **PASS**, 4/4.
- `npm run predeploy:open-gate`: **BLOCKED**, 39 checks pass and the sole failing check is the missing `package-lock.json`.
- `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`: **NOT COMPLETED**; registry access timed out. A direct DNS check also failed to resolve `registry.npmjs.org` in this environment.
- Runtime boot / browser click-through: **NOT RUN**; dependencies could not be installed here.
- Live GoDaddy / production database: **NOT ACCESSED**.

## What changed in this packaging pass

- Repacked the source so `server.js`, `package.json`, and the app folders are at the ZIP root. The uploaded candidate previously nested them under `SBC-OS/`, which could lead to an incorrect extraction path in hosting.
- Updated this verification record to reflect the freshly observed 592-file syntax result and current release-gate output.
- Regenerated `CLEAN-DISTRIBUTION-MANIFEST.sha256` for the distributed file set.
- Runtime application code was not edited during this packaging pass. The `server.js` hash above matches the inspected candidate.

## Release blockers and production constraints

1. A genuine npm-generated `package-lock.json` matching the exact `package.json` is still required. Do not use hand-written hashes or a root-only historical lockfile.
2. Latest supplied production evidence reports 243 customer rows against a verified baseline of at least 248. The missing five records have not been reconstructed from authoritative data.
3. The recovery guard must remain engaged until the data discrepancy and production readiness are verified.
4. No production deployment or database mutation was performed by this build process.

## Release decision

**Do not deploy this ZIP yet.** It is a root-corrected, test-passing source candidate, not a certified production release. After obtaining the genuine lockfile, rerun `npm ci --ignore-scripts`, `npm run test:all`, and `npm run predeploy:open-gate`. Then perform staging/runtime checks and separately resolve the customer-data recovery before enabling revenue mutations.
