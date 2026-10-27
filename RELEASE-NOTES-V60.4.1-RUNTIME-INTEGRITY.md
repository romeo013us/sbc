# SBC V60.4.1 — Runtime Integrity Hotfix

## Purpose
Production hotfix for the GoDaddy/cPanel runtime observed on V60.4.0.

## Fixed
- Removed the mysql2/promise pool `connection` event hook that mixed callback-style connection APIs with the promise pool and could emit the runtime error:
  `You have tried to call .then(), .catch(), or invoked await on the result of query that is not a promise.`
- Kept MySQL access promise-native through `mysql2/promise`.
- Added one authoritative release identity: `60.4.1`.
- Added `/api/release-identity` for runtime/UI/diagnostic identity verification.
- Updated package and release gate versions to `60.4.1`.
- Added a runtime-integrity static gate covering MySQL interface and release identity.

## Deliberately unchanged
- Existing CRM/customer data model.
- Lead pool and lead recovery behavior.
- Square/Twilio/OpenAI integrations.
- Kim governance and State Kernel architecture.
- GoDaddy secret count and environment contract.
- Financial/refund controls.

## Deployment requirement
Deploy the flat ZIP contents as the application root. After restart, verify the startup banner reports `sbc-business-command-center@60.4.1` and the release identity endpoint reports `60.4.1`.
