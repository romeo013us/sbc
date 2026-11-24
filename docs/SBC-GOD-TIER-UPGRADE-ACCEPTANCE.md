# SUPER SBC — competitive upgrade acceptance program

Owner priority, 2026-11-24. Canonical source: a-sbc-master. Upgrade in place; preserve Academy 360 design, existing CRM records, established customer prices and least-privilege access. No new paid services without authorization. No self-certified ratings.

| Workstream | Acceptance evidence required |
|---|---|
| Reliability and release engineering | Immutable tested artifact, separate verified deployment ref after GoDaddy cutover, manifest parity, staging writer checks, rollback drill, independently restored backup, sustained load measurements. |
| Integration Hub | Named provider registry, separate authentication and readiness evidence, secret isolation, bounded retries, dead-letter and reconciliation, signed webhooks and tenant checks. |
| Marketing | Single publisher; 10 AM and 10 PM ET seven days; exact four approved SBC business identities, eight image-attached posts/day, real original logo, rights-cleared art, durable per-slot receipts, duplicate prevention and unknown-outcome reconciliation. No activation of client Social Studio as competing publisher. |
| Command Center | Authenticated owner and staff workflows; calling/consent, CRM, appointment, checkout, fulfillment and account renewal evidence; no destructive migration or duplicated CRM. |
| Office Box | Independent tenant onboarding, industry templates, bilingual UX, customer portal, signed handoff, verified provider billing and cancellation, export and restoration. |
| Hosting/reseller | Attributed storefront/cart, actual provisioning and reconciliation, renewal and SSL monitoring, off-provider backup restore. Do not claim an automated checkout when a public probe is blocked. |
| Public website | Real service pages and package data, mobile and accessibility tests, working inquiry/checkout routes, measured conversion attribution. |
| Kim operations intelligence | Existing automation consolidation, traceable actions, budget limits, owner approval for sensitive changes, fault isolation and verified recovery outcomes. |

## Current increment
A read-only operational readiness evaluator consumes the existing smoke report, independently verifies all required public endpoints (including reseller cart), rejects stale/missing/duplicate observations, separates release identity from availability, and leaves authenticated commercial readiness explicitly unverified. A green availability smoke cannot confer production certification. Existing availability behavior remains unchanged; the new report is not a deployment authorization.

Expected identity variables, when independently established: SBC_EXPECT_CC, SBC_EXPECT_OFFICE, SBC_EXPECT_SITE. Never infer expected build identities from the observation itself. For a strict public-only check after producing a smoke artifact, run node scripts/v66131-operational-readiness.cjs f4-published-smoke-results.json --strict-public.

## Next release boundary
Create and verify an immutable deployment branch/ref from a known tested release; confirm GoDaddy source cutover before changing the canonical build publisher. Keep rollback source, release manifests, ownership, customer data and Published unchanged until Preview validation. Do not bypass the checksum gate. A source-only commit is not a release.

The existing multi-client Social Studio is Facebook/Instagram scoped and is not evidence of a four-channel SBC publisher. Keep the active Windsor task as sole publisher until a tested durable handoff, verified account scope and owner-approved cutover. No duplicate scheduler.

Commercial metrics (collected revenue, paying subscribers, retention and unit economics) require real records; improvements are not a new competitive rating until validated.
