# SBC OS V65.1.5 — Buyer Demo Stability Hotfix

## Goal
Targeted stability work for the Training Center and Customer 360 before a buyer demonstration. This release prioritizes truthful display and read-only safety over adding new infrastructure.

## Changes
- Training Center now uses the authorized admin course-library projection as a display fallback when assigned/available projections are empty. Course content still opens through the authenticated course endpoint.
- Customer normalization recognizes additional legacy CRM field names for IDs, business/contact names, phone, email, website, follow-up, assignment, notes, and status.
- Customer 360 performs an optional read-only relational lookup to fill missing profile fields and display related MySQL orders, quotes, and activities when that endpoint is available. If the selected record is a recovery-projection lead or the relational endpoint is unavailable, it falls back to the existing authorized read model.
- Existing duplicate related records are filtered by ID when merging relational and in-memory records.
- Release identity and static asset cache tokens are aligned to V65.1.5.
- Added a targeted buyer-demo stability regression test.

## Safety boundaries
- Recovery lock remains active; this release does not unlock recovery or alter recovery baselines.
- No production database was accessed or changed by this build.
- No records were fabricated, inserted, deleted, or restored.
- Customer 360 enrichment is GET-only and never restores a recovery-projection row into the authoritative CRM.
- Existing global recovery write guard remains in place.
- No secrets, provider credentials, payment settings, or autonomous financial controls were changed.
- No live payment transaction is created by tests.

## Verification
Run locally before deployment:
- `npm run test:all`
- JavaScript syntax check across shipped JS files
- ZIP integrity check

## Deployment status
This archive is a locally built release candidate and has **not** been deployed or verified on GoDaddy. Deploy using the existing GoDaddy/Airo workflow (`NODE_ENV=production npm start` per the last supplied deployment logs). After upload, verify the `/api/release-identity`, `/api/training`, and Customer 360 read-only flows in the live environment.

## Buyer demonstration guidance
Use clearly labeled demo/staging data for checkout and fulfillment demonstrations. Do not use a live charge merely to prove a workflow. Do not represent empty revenue/order counters, unconfigured notifications, or suspended automation as operational capability.
