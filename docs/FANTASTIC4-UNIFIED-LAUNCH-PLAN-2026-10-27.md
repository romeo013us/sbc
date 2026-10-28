# SBC Fantastic 4 — unified customer journey and launch protocol
**October 27, 2026. Review candidate, not a deployed four-system integration.**

## One business, four systems
| System | Authority | Must not do |
|---|---|---|
| sbcmia.com | Brand, service inquiries, print/sign briefs, package discovery | Treat a checkout redirect as money |
| sbcwebsites.com | GoDaddy-authorized reseller products and provider checkout | Grant Office Box access from unrelated products |
| SBC Command Center | Canonical CRM ID, quote, provider-verified settlement, order, fulfillment, audit, staff RBAC | Trust browser PAID flags, bypass writer/recovery safeguards |
| Office Box | Tenant workspace, one-time activation and persistent entitlements | Enable writes until verified ACTIVE entitlement |

## The canonical journey
1. Collect visitor inquiry with source attribution and optional, separately documented marketing consent. Matching email must not grant ownership over an existing CRM account.
2. Command Center creates/links the correct customer and service-specific quote. Clearly distinguish setup and recurring charges, refund/cancellation exceptions, premium domains, shipping and third-party costs.
3. Complete checkout via approved Square/GoDaddy provider. **A success-page redirect is not a captured payment.** Reconcile processor-confirmed amount, USD currency, Square location, verified order/customer, and purchased service SKU.
4. Dispatch individual fulfillment work for domains/websites, printing/signage and Office Box. Only an explicitly purchased OFFICE_BOX_* SKU may create an Office Box invite.
5. After a persisted Square capture, enqueue one deterministic signed customer.subscription.paid event in a **durable single-writer outbox**; retry with bounded backoff and operator-visible dead letters.
6. Office Box verifies HMAC V2 timestamp and exact raw payload, atomically stores the event and a one-time token and acknowledges; deliver token only to verified purchaser email, never public logs.
7. Customer activates Office Box, creating a new server-generated tenant with PENDING_BILLING_SYNC read-only status. Command Center must learn actual tenant ID through a mutually authenticated reconciliation mechanism—never infer from email.
8. Command Center sends linked, verified, monotonic sbc.office-box.entitlement.v1 events. Only ACTIVE is writable; cancellation, expiration and billing failure are read-only without deleting customer records.
9. Customer receives coordinated account, order/status, renewals, service help and export/cancellation. Do not share cookies across unrelated domains as an SSO shortcut.

## P0 blockers as of audit
- Command Center paid handoff module, now merged via PR #191, **builds envelopes only**. Durable outbox, live delivery and entitlement producer are not implemented/proven.
- Office Box PR #2 is an unmerged draft, although source CI and MySQL tests passed.
- Activated Office Box tenant-to-Command Center feedback and signed ACTIVE/CANCELED reconciliation need proof; handoff does not equal billing activation.
- Public sbcmia.com policy/terms pages were not verified by the site inspection. Twilio A2P consent needs publicly accessible same-domain privacy and terms and two independent optional unchecked SMS consent choices.
- sbcwebsites.com redirects to the GoDaddy secure-server storefront; verify customer checkout, support links, product-specific policies and provider reconciliation.
- Website PHP HMAC bridge is separate from Command Center's Node release; confirm installed server-only secret and accepted lead exactly once.
- Owner, Lorna, Demo Viewer Published sessions; tenant security; mobile flows; MySQL backup restore and exact runtime fingerprint remain unverified.

## Strict launch gates
The canonical contract is ecosystem/fantastic4-manifest.json. Run:
    node scripts/fantastic4-readiness.cjs /path/to/reviewed-evidence.json
Empty evidence exits 2 with NO_GO. Evidence references are NOT independently verified by the script; a human verifies their relevance, timestamps and actual Published commit. READY_FOR_OWNER_APPROVAL is not production certification.

### Required test matrix
Invalid provider status, currency, location, amount, SKU, customer, duplicate/stale signed events; worker and DB outages; replay after restart; token collision/reuse; forged tenant link; cancellation/refund and renewal; role isolation for Lorna, Owner, Demo and customer; standalone package versus Office Box; mobile, accessibility, explicit consent and customer export.

## Safe release sequence
1. Freeze current Published deployment receipt, retain rollback ZIP and verify a restorable MySQL backup; never reset lead/tenant baseline or disable recovery gates.
2. Verify Office Box draft PR #2 in staging and merge only through normal owner-controlled review.
3. Build and test actual persistent Command Center dispatch and entitlement producer, including activation-to-tenant reconciliation; signed receipts and idempotency in disposable MySQL.
4. Publish counsel-reviewed same-domain sbcmia.com legal pages and opt-in controls. Deploy PHP bridge only with matching server-side key and a validated lead path.
5. Run complete staging journey, then a separately approved low-risk live commerce test if required. Keep production transactions distinct from synthetic tests.
6. Confirm desktop/iPhone owner/employee/demo/customer acceptance, /readyz, production fingerprint, refunds/cancellations and rollback. A failed P0/P1 means NO_GO.

Measure real collected revenue, gross margin after vendors, response times, close rate, reliable provisioning and retention—not vanity 9.5 claims.
