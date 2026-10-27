# SBC OS V65.1.26 — Premium Demo Studio

## Included
- Replaces the basic generated-demo confirmation with a responsive Demo Studio: customer preview, desktop/mobile viewport, copyable stable URL, open-full-page action, and alternate design direction generation.
- Adds an SBC-branded concept-preview ribbon to generated customer website pages while preserving the existing industry-aware website design engine and checkout flow.
- Adds owner-authorized email delivery through the existing communications API and consent-gated SMS delivery through the existing server-side SMS eligibility checks.
- Prevents concurrent duplicate sends within the active studio session and provides provider response IDs/status where available.
- Leaves payment, order, fulfillment, database schema, recovery state and owner veto unchanged.

## Validation boundaries
- Local static, syntax, generator, bootstrap and regression tests do not prove a live GoDaddy deploy or actual email/SMS delivery.
- SMS remains blocked unless explicit consent is recorded and suppression/opt-out checks pass server-side.
- No SQL import, new environment variables, Redis dependency, wildcard DNS or Nginx changes are required by this patch.
