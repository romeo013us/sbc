# SBC V64.0.0 — OPEN-READY PRE-DEPLOYMENT GATE

## Deployment status

**BUILT + STATICALLY VALIDATED + PACKAGED**

This gate is designed to be run before uploading the release to GoDaddy.

## Required GoDaddy application contract

- Application root must contain `package.json` and `server.js` directly.
- `package.json` start script: `node server.js`.
- Node runtime: `22.x`.
- Do not add a 51st GoDaddy secret. V64 declares `newGoDaddySecrets=false`.
- Preserve the existing production environment variables/secrets.

## Pre-deployment gate

Run:

```bash
npm run test:v64
```

or, if npm scripts are unavailable:

```bash
node scripts/v640-release-integrity-test.js
node scripts/v640-enterprise-control-plane-test.js
node scripts/predeploy-open-gate.js
node scripts/predeploy-war-test.js
```

## What the gate checks

1. Release identity is V64.0.0.
2. GoDaddy startup contract is present.
3. Node 22.x contract is present.
4. `server.js` exists at the application root.
5. V64 control-plane files exist.
6. Kevin/Kim/owner governance remains bounded.
7. High-risk financial actions require owner approval.
8. No new GoDaddy secrets are required.
9. V64 API surfaces are wired.
10. Front-end V64 cockpit exists.
11. All JavaScript files pass `node --check`.
12. Relative local module references resolve.
13. Core revenue/communications/fulfillment/intelligence rails remain present.
14. No obvious plaintext credential material is present in release metadata.
15. ZIP root is deployable directly to GoDaddy.

## Important limitation

A local build environment without installed npm dependencies cannot prove a full runtime boot. The final GoDaddy environment must install the dependencies from `package.json` before `node server.js` can execute. This release intentionally does **not** ship the incomplete V61 `package-lock.json` that was present in the prior package; shipping that incomplete lock could cause `npm ci` to fail because its dependency tree was not populated.

## GoDaddy verification after upload

1. Start/restart the Node application.
2. Confirm the application reaches **Running/Healthy**.
3. Open the Command Center.
4. Confirm the release identity reports `64.0.0`.
5. Open `/sbc-god-tier` while authenticated as owner.
6. Confirm the cockpit loads.
7. Run the existing production diagnostics.
8. Confirm MySQL health.
9. Confirm Square/Twilio/email health using the existing configured credentials.
10. Run a non-destructive V64 control-plane status check.

**Do not create another paid Square transaction merely to prove startup.** Use the existing production test/reconciliation rails unless a real transaction is intentionally required.
