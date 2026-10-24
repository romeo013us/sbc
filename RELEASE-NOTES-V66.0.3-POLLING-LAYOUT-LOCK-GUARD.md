# SBC OS V66.0.3 — Polling, Layout, and Automation Lock Guard

## Changes
- Revenue and ten-brain broadcast mounts append into the main workspace content instead of prepending into the #app root.
- Consultative revenue and God-Tier broadcast widgets have per-page singleton and in-flight guards; refreshes run only while visible and at a reduced cadence.
- Cinematic polling has a per-page singleton guard.
- Sequence automation makes a non-blocking distributed-lock attempt. A competing worker still owns the lock; lock acquisition exceptions reset the local re-entry guard, and contention logs are throttled.
- Added compact responsive layout rules for the broadcast panel and ten-brain strip.

## Safety
- No CRM records are seeded, edited, deleted, or migrated by this patch.
- Tenant isolation, MySQL recovery protections, and writer controls are unchanged.
- The distributed lock remains authoritative; a busy lock does not authorize work.

## Verification status
Static regression checks and source syntax checks are included. Full bootstrap verification and live endpoint latency must be run against the exact deployment bundle before release. This change has not been deployed to GoDaddy.
