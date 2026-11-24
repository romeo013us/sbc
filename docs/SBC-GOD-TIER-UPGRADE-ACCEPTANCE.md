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

## Verified Preview and rollback sources

The stable GitHub branch `deploy/godaddy-verified-preview` advances only to a compiled canonical release whose tree matches the independent `release/verified-godaddy-<full source SHA>` ref. A rerun can reuse an identical tree. A conflicting tree leaves the original recovery ref intact. The existing publisher still maintains `a-sbc-master` while GoDaddy's source selection is managed independently.

Select the verified branch for GoDaddy Preview when ready for cutover. Compare the served `x-sbc-source-commit` and the staged inventory to the expected release. A stored ref demonstrates recoverable source. A timed GoDaddy rollback and a restore to a separate database require their own evidence.

## Provider and marketing evidence

In Integration Health or the Gateway Hub, the owner can select **Check Square and Twilio**. The checks read the configured Square location and Twilio account and compare each returned identifier and active status. A sandbox location is labeled sandbox. Payment capture, settlement, phone delivery and recurring charges each require an operation-specific receipt.

In Marketing Hub, **Publication receipts** reads the four approved SBC accounts for the selected Eastern date. Set the server-side `SBC_WINDSOR_API_KEY` through the existing hosting configuration to enable Command Center readback. The existing automation continues to use its own authorized connection. Scoped read requests include the following UTC date when needed for evening posts. The Instagram connector account and reporting ID are different for this approved account, and the readback checks the publishing handle as well.

The owner can record an attempted slot or attach a provider-returned ID. **Verify saved receipts** independently matches the ID, channel, Eastern date, provider link and image evidence before saving the verification in MySQL. Permission checks, a writable tenant and the writer lease apply to these writes. An ambiguous attempt or an accepted ID without readback stays pending. A repeat receipt cannot fill a second slot. The dashboard counts observed image posts and previously verified IDs and lists the designated morning/evening slot separately. Photo readback does not establish artwork rights, logo provenance, or a sale.

The corporate Marketing Hub timer and manual publisher yield to the incumbent automation. Client publishing continues for its own accounts. Receipt collection creates no provider posts. The automation-to-ledger handoff, live provider recovery drills, and collected-revenue attribution still require independent acceptance.
