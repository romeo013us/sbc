# SBC 9.5 — Build · SaaS · Company production certification

**Status: NOT CERTIFIED.** This is a release decision procedure, not an instruction to change GoDaddy Published. Protect working sites, Square provider data, live MySQL, the Office Box customer workspace, and tenant isolation.

## What this upgrade changes
- Adds `ecosystem/**` (Office Box settlement, signed outbox, activation, tenant safety) and `ui-overlays/**` (Kim Chief of Staff interface) to the **actual V66 runtime source fingerprint**. Previously their GitHub CI path filters watched for changes but the signed runtime fingerprint did not explicitly include these inputs.
- Extends cache/ZIP regression tests: any change in either folder must reject an older prebuilt, even when its ZIP hash and receipt are otherwise valid.
- Adds read-only `governance/production-95-three-track-preflight.cjs` that checks committed source/receipt integrity and SBC's **existing** V66.55 evidence rubric for three independent tracks. Empty or stale evidence is `NO_GO`.
- New workflow **SBC 9.5 Three-Track Evidence (diagnostic, NOT deployment)** prints a GitHub Step Summary with the three track statuses; it never calls a provider or publishes an artifact.

## Release-blocking source problem (2026-10-28)

At review start: GitHub `main=6902998d23a9cc111e31221e9e523cfbe358e25d`, committed prebuilt runtime records `sourceCommit=abd4cc832ad11f893f6910d2e26f43cdc98bf3bb`. Existing release is **source-stale**. The fingerprint extension in this draft will intentionally invalidate every older prebuilt ZIP. No hand-editing a fingerprint, disabling its check, or copying an unrelated compiled `server.js` is acceptable.

**Do not merge this PR directly into a branch that GoDaddy automatically deploys unless the exact-source rebuild and rollback promotion are prepared.** The manual `publish_verified_prebuilt_to_main` and `publish_deploy_branch` gates must remain off unless separately approved. Their workflow permissions and prebuilt-source comparisons must remain intact.

## Track A — Build engineering, target 95/100 minimum

Formal V66.55 evidence categories (all must meet 95 individually):
- Source-bound reproducible deployment and rollback: exact SHA, archive digest, source fingerprint, release receipt and previous known-good runtime.
- Published stability/performance: actual GoDaddy Published instance, on authenticated owner sessions, not screenshots of Preview.
- Authenticated desktop/mobile button and navigation regression; repeated sessions and deferred CSS mounts.
- Tenant isolation, owner financial holds, writer lease, backup recovery protections, webhooks and authenticated privacy checks.
- Independently restored live backup in a **separate** environment; fixture-only MySQL CI is insufficient.
- Real alerts, incident ownership, error monitoring and incident-response drill.

## Track B — Commercial SaaS, target 95/100 minimum

- Lorna and owner access enforced by API **and** UI; no blocked endpoint calls from normal navigation; all cross-tenant operations return 403.
- Demo viewer with synthetic data only, no live orders/contacts, read-only operations and owner-controlled account activation.
- Verified Square payment → durable order commit → scoped Office Box outbox → signed acknowledgment → actual account activation. Replay, refund/dispute, renewal and rollback tested with provider evidence.
- Approved Twilio Voice/SMS opt-in/STOP/HELP, call recordings and CRM logging policy, iPhone browser behavior and enforced budgets, no mass sending.
- Customer account creation and self-customization remain fully usable in Office Box.
- Clear billing, fulfillment exception response, onboarding and support ownership. Never count open orders as paid revenue.

## Track C — Operating company, target 95/100 minimum

- Count qualified contactable leads by one definition and approved tenant scope; record call attempts/outcomes without duplicates.
- Track actual seller activity and conversion to **settled** paid orders; do not mistake quotes or marketing attribution for closed sales.
- Reconcile Square captured gross, SBC ledger and accounting in integer cents. Record chargebacks, refunds and taxes separately.
- Reconcile monthly subscription income, GoDaddy reseller costs, Square/Twilio/AI spend and gross contribution margin.
- At least one real customer delivery acceptance with support/return/refund handling; no synthetic sale or fabricated testimonial.
- Track retention, renewals, service quality, customer support and business continuity with actual timestamps.

## Run read-only assessment

```bash
node governance/production-95-three-track-preflight.cjs
# Optionally submit LOCAL reference-only evidence; don't commit secrets or customer data:
node governance/production-95-three-track-preflight.cjs --evidence /safe/local/path/evidence.json
```

Output is `NO_GO` until the source is matched **and** the existing per-subsystem rubric's evidence is complete; even perfect submitted claims yield only `AWAITING_INDEPENDENT_LIVE_APPROVAL`, never an automatic certification or GoDaddy deployment.

## Final production release authorization

Before selecting **Publish to Live**, collect actual GoDaddy Published SHA and health, restorable backup, exact matching prebuilt archive, non-mutating integration checks, real Lorna/demo acceptance evidence, Square/Office Box end-to-end evidence, and a tested rollback ZIP. Approval for a code PR is **not** approval for schema migration, production payment, unrestricted Kim automation, or public customer onboarding. Any unresolved P0 or failed P1 means `NO_GO`.

**The goal remains 9.5+ in all three tracks, measured from evidence rather than a feature count.**
