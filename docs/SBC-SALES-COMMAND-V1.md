# SBC Sales Command V1 — owner operating guide

**Current state:** Source changes are committed to `a-sbc-master`. Registration is staged by the signed ZIP CI workflow. **Not deployed to GoDaddy Published; MySQL schema is not migrated; real payment acceptance is unverified.**

## Compensation agreements (proposed; must be signed)

| Tier | Base rate | Monthly collected sales quota | Monthly commission if quota reached |
|---|---:|---:|---|
| Standard account manager | $5/hour | $2,600 | 10% of eligible monthly gross profit |
| Senior account manager | $6/hour | $4,333 | 15% of eligible monthly gross profit |

30 hours/week per contractor is the current staffing budget assumption. Commission unlocks on all eligible monthly credited sales once the relevant monthly threshold is achieved. It is calculated only for verified, owner-reconciled paid sales, net of documented refunds/direct vendor costs, related delivery labor and processing fees. Unverified payments, QA orders and status-only paid flags do not count. Signed terms remain authoritative and must not be silently rewritten.

Team target: $600/day collected, approximately $13,000/month, **excluding founder sales**. Planning operating profit target ~$3,000/month is an estimate, not verified financial performance. No system auto-classifies workers as legally independent contractors.

## Existing rails reused

`enterprise/v6640-payment-evidence.cjs` supplies Square capture evidence classification (saved SBC metadata, **not independent bank reconciliation**). Existing assigned CRM portfolios remain authoritative for sales credit. Existing owner approval remains mandatory before order fulfillment. Managers may not order from suppliers. Existing MySQL writer/recovery and tenant permissions are retained.

`enterprise/sbc-sales-compensation-v1.cjs` is the deterministic quota & commission calculator; `routes/sbc-sales-command-v1.cjs` provides authenticated APIs; `migrations/20261122_001_sbc_sales_command.sql` defines sales credits, agreed terms, locked statements, and append-only event audit. Public assets live under mirrored `public/` and `browser_public/`. Release registration is staged using `scripts/v66160-stage-sales-command.cjs` and the existing signed, reproducible GoDaddy artifact workflow.

## Mandatory staging acceptance before deployment

1. Snapshot existing GoDaddy Published runtime and MySQL, verify rollback procedure and take a database backup.
2. Review Philippine contractor classification and both employment/contractor and commission agreement law with qualified local counsel. Sign written tier, commission, quota, cancellation and payment provisions before activating terms.
3. Apply `migrations/20261122_001_sbc_sales_command.sql` only against a separate writable **staging MySQL** database, after schema review. Never run schema-changing DDL in the read-only GoDaddy Preview.
4. Run `npm run test:sales-command` and main release safety checks. Build signed candidate ZIP; confirm new backend and owner/manager UI are included in its inventory; do not bypass SHA/receipt gates.
5. With two staging manager identities and an owner, verify owner-only endpoints, manager's personal commission read, cross-tenant access denials, and owner-approval-only mutations.
6. Create *sandbox* captured Square orders tied to assigned CRM accounts. Verify wrong tenant, missing signature/proof, duplicate order, QA sale, status-only payment, refund, cost evidence omission, and unassigned account fail closed.
7. Set signed commission terms by manager/month. Verify both monthly quotas, 10% and 15% conditional gross-profit rates, owner-assisted sales attribution, processing/labor costs, and timezone month boundaries.
8. Close an ended month into DRAFT; verify no commission can be marked APPROVED without explicit owner confirmation and no Paid status without an owner-recorded reference **after** an actual external transfer.
9. Confirm every paid customer fulfillment order still needs separate owner approval and no vendor or payout API can be invoked by contractor. Perform restart and restoration tests.
10. Owner reviews all evidence, validates verified artifact and only then promotes signed package to GoDaddy Published.

## Known V1 limitations and controls

The system **does not automatically initiate payments, contact leads, pay contractors, purchase from vendors or fulfill orders**. Source reconciles captured payments only after owner documents direct vendor and labor costs; this is deliberate until margins are known. A late refund/chargeback requires manual reconciliation **before** month close or a documented compensation adjustment under signed terms and applicable law. Owner-assisted deal credit must be reflected in authoritative CRM assignment or handled in an audited reconciliation process.

The dashboards do not yet compute actual net profit after all payroll, taxes, software, advertising, and owner time; they show **owner-attested deal-level gross profit** and estimated commission. Targets are not guarantees.

**Never represent the presence of source code on GitHub as production activation.**
