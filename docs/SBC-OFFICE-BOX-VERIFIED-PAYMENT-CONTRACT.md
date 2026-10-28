# SBC -> Office Box: Verified Square payment contract (staging)

This change introduces an **offline, non-dispatching** producer module at `enterprise/office-box-paid-handoff.cjs`.

## Trust boundary

- Caller MUST read the authoritative SBC order, persisted capture state and provider payment **server-side**, never accept the request payload from browser, Kim, or an untrusted webhook alone.
- Require `validateCompleted` (Square payment status COMPLETED, location, currency USD, exact amount and order match) **plus** `persistedCompletion` and matching paid payment record.
- Paid order must carry a trusted `officeBoxSku`, e.g. `OFFICE_BOX_BUSINESS`, and the requested plan must match.
- Customer ID and email MUST match the paid order before constructing a token invitation. No cross-customer email substitutions.
- The function returns a deterministic event ID and signed body. It makes **no** network request, database mutation or payment charge.

## Wire-up order (after review)

1. Map the actual Office Box SKU and customer identity on authoritative paid orders; do not synthesize or guess missing fields.
2. Confirm Square payment provider proof is durably committed before calling `buildPaidHandoff`.
3. Store a durable outbox item keyed by `correlationId` and send **only once** through the existing single-writer Command Center pipeline, using a bounded retry/backoff policy.
4. Use Office Box `/api/sbc/handoff` over configured HTTPS. Include both signature headers during migration. Never log signatures, signed payloads, activation tokens, or `SBC_WEBHOOK_SECRET`.
5. Persist the activation response and send invitation only through an approved customer-verified delivery channel; never deliver to arbitrary contact emails.
6. Customer activates; tenant starts `PENDING_BILLING_SYNC`. A separate signed `sbc.office-box.entitlement.v1` event from verified settlement must mark the linked subscription ACTIVE.
7. Test duplicate, refund, cancellation, stale payment, tenant mismatch, email substitution, rate limits and rollback in staging. Reconcile legitimate retries without minting new tokens.
8. Only after both signed sender and receiver pass staging should Office Box set `SBC_HANDOFF_V2_REQUIRED=true`.

## Explicit non-goals

**No live dispatch, no Square charges, no payment-webhook wiring, no automated tenant creation and no GoDaddy deployment in this pull request.** This contract alone does not constitute verified end-to-end readiness or a 9.5 production certification.
