# SBC connected customer journey — implementation scope

Extend the supplied V66 P0/P1 preview candidate and SBCMIA V4.4. Command Center is the authoritative commercial record. Reuse existing signed website authentication, tenant and assignment policy, single writer lease, MySQL persistence, Square signature/readback verification, and customer portal authentication.

Public seams for validation: signed POST /api/web-lead; assigned staff /api/sbc/journey endpoints; authenticated customer /api/portal/journey endpoints; the existing appointment API; existing Square processing callback; public PHP inquiry processing; staff and customer browser flows.

Requirements:
- Carry allowlisted service, package, intent, callback window, timezone and campaign source into one account journey; never infer booking, payment, or marketing consent from interest.
- Idempotent inquiry receipts, conservative contact matching, no replacement of verified contacts, no business-name-only merge; confidential responses with opaque inquiry receipts.
- Preserve an active assigned Account Manager or route the next task to an active tenant owner. Inactive assignments must remain visible for owner review.
- Persist journey data in existing relational customer JSON, order notes JSON, and workspace tasks. Failed saves restore changed in-memory state and never report success.
- Expose a scoped staff queue, next action, inquiry review, payment evidence and product-specific fulfillment checklist, including customer proof approval and owner release approval before delivery. No automatic vendor purchases or publishing.
- Feed verified existing Square capture into exactly one delivery plan; refund/dispute/pending states block progression. Do not add a public endpoint that sets payment state.
- Customers see only their authenticated tenant/account's public status, approvals, deliveries and appointments. Approvals require a current preview revision; reschedule requests await staff confirmation and preserve the original appointment until confirmed.
- Appointment reminder outbox checks explicit channel consent tied to the current destination, suppression, meeting validity, ET quiet hours, duplicate keys and durable claim before dispatch. Default dispatch off. Provider acceptance is distinct from delivery. Ambiguous attempts are held for reconciliation rather than retried automatically.
- Reuse live DB views so post-startup MySQL hydration is visible to bookings and journeys.
- Public service pages offer a call request and approved checkout or quote route. Callback requests are not confirmed calendar bookings. Keep source code and confidential keys out of public responses.

Release validation is local/synthetic. Actual GoDaddy staging, MySQL writer acceptance, provider delivery and production deployment require separate recorded acceptance; never imply they ran here.
